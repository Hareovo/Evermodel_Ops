# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
"""Grafana 监控大屏。

把外部 Grafana 的看板清单吐给前端，前端用 iframe 嵌进后台（`/grafana` 页面）。

设计要点
--------
1. **配置在界面上，不在代码里**：地址/超时/看板白名单存在 `settings` 表的 `grafana` 键里
   （「系统管理 / 系统设置 / 监控大屏」），改完立即生效、不用重启后端。
   库里没配过时回落到 `evermodel_ops/overrides.py` 的 `GRAFANA_*`，方便用环境变量做首次部署。
2. **看板清单不手写**：默认向 Grafana 的 `/api/search?type=dash-db` 拉取全部看板；
   配了白名单则只显示白名单里的，并按配置顺序排列。
3. **顺手探测匿名访问**：Grafana 没开匿名访问时 `/api/search` 返回 401，
   iframe 里会直接弹出 Grafana 登录页。这里把结论回给前端，
   让页面自己把「该怎么配」提示出来，而不是给用户一个白板。
4. **Grafana 挂了不能把接口打挂**：连接失败/超时一律降级成 `message` 文案 + 空清单。

注意：iframe 是**浏览器直连** Grafana 的，所以要求「用户浏览器能访问 GRAFANA_URL」，
而后端探测走的是「Django 所在机器能访问」，两者网络位置不同，排查时别搞混。
"""
import requests
from django.conf import settings
from apps.setting.utils import AppSetting
from libs import json_response

DEFAULT_TIMEOUT = 5
SEARCH_PATH = '/api/search'


def _parse_dashboards(text):
    """把界面上填的多行文本解析成白名单，每行 `uid` 或 `uid 标题`。

    返回 None 表示「没配过白名单」（调用方回落到 overrides.py 的 GRAFANA_DASHBOARDS）；
    返回空列表表示配了但内容为空 —— 效果等同于不限制。
    """
    if text is None:
        return None
    if isinstance(text, (list, tuple)):
        return list(text)
    result = []
    for line in str(text).splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split(None, 1)
        item = {'uid': parts[0]}
        if len(parts) > 1:
            item['title'] = parts[1].strip()
        result.append(item)
    return result


def _conf():
    """读配置，返回 (base_url, timeout, whitelist)。

    系统设置里存过就以库里的为准；没存过回落到 `evermodel_ops/overrides.py` 的 GRAFANA_*。
    """
    conf = AppSetting.get_default('grafana') or {}
    if not isinstance(conf, dict):
        conf = {}
    base = (conf.get('url') or getattr(settings, 'GRAFANA_URL', '') or '').strip().rstrip('/')
    timeout = conf.get('timeout') or getattr(settings, 'GRAFANA_TIMEOUT', DEFAULT_TIMEOUT)
    try:
        # 界面上是输入框，兜一下极端值，别让一个手滑把后端卡死
        timeout = max(1, min(int(timeout), 60))
    except (TypeError, ValueError):
        timeout = DEFAULT_TIMEOUT
    whitelist = _parse_dashboards(conf.get('dashboards'))
    if whitelist is None:
        whitelist = list(getattr(settings, 'GRAFANA_DASHBOARDS', ()) or ())
    return base, timeout, whitelist


def _fetch_dashboards(base, timeout):
    """拉取看板清单，返回 (dashboards, anonymous, message)。"""
    try:
        resp = requests.get(
            f'{base}{SEARCH_PATH}',
            params={'type': 'dash-db', 'limit': 500},
            timeout=timeout,
        )
    except requests.RequestException as e:
        return [], False, f'无法连接 Grafana（{base}）：{e}'

    if resp.status_code == 401:
        # 401 说明服务是通的，只是没开匿名访问 —— 交给调用方拼配置提示
        return [], False, ''
    if resp.status_code != 200:
        return [], False, f'Grafana 返回异常状态码 {resp.status_code}，请确认地址是否指向 Grafana 根地址。'

    try:
        rows = resp.json()
    except ValueError:
        return [], True, 'Grafana 返回的内容不是 JSON，请确认地址指向的是 Grafana 而不是其它服务。'
    if not isinstance(rows, list):
        return [], True, 'Grafana 搜索接口返回结构异常，预期是数组。'

    dashboards = []
    for row in rows:
        if not isinstance(row, dict) or row.get('type') != 'dash-db':
            continue
        uid = row.get('uid') or ''
        if not uid:
            continue
        dashboards.append({
            'uid': uid,
            'title': row.get('title') or uid,
            # Grafana 给的就是 /d/<uid>/<slug>，直接拿来用，省得自己拼 slug
            'path': row.get('url') or f'/d/{uid}',
            'tags': row.get('tags') or [],
            'folder': row.get('folderTitle') or '',
        })
    return dashboards, True, ''


def _apply_whitelist(whitelist, fetched):
    """按白名单过滤/排序；白名单项既可以是 uid 字符串，也可以是 {uid, title} 字典。"""
    by_uid = {item['uid']: item for item in fetched}
    result = []
    for entry in whitelist:
        if isinstance(entry, str):
            uid, title = entry, ''
        elif isinstance(entry, dict):
            uid, title = entry.get('uid', ''), entry.get('title', '')
        else:
            continue
        if not uid:
            continue
        item = dict(by_uid.get(uid) or {'uid': uid, 'path': f'/d/{uid}', 'tags': [], 'folder': ''})
        # 手工指定的标题优先，方便把 "公司集群" 这类业务叫法写在前端
        if title:
            item['title'] = title
        item.setdefault('title', uid)
        result.append(item)
    return result


def get_grafana(request):
    base, timeout, whitelist = _conf()
    if not base:
        return json_response({
            'url': '',
            'anonymous': False,
            'dashboards': [],
            'message': '尚未配置 Grafana 地址：请在「系统管理 / 系统设置 / 监控大屏」中填写后重试。',
        })

    fetched, anonymous, message = _fetch_dashboards(base, timeout)
    dashboards = _apply_whitelist(whitelist, fetched) if whitelist else fetched

    return json_response({
        'url': base,
        'anonymous': anonymous,
        'dashboards': dashboards,
        'message': message,
    })
