# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
from apps.alarm.models import Group, Contact
from apps.setting.utils import AppSetting
from libs.mail import Mail
from libs.utils import human_datetime
from libs.webhook import gen_dd_sign, gen_fs_sign
from urllib.parse import urlencode
import requests
import logging
import json


class Notification:
    def __init__(self, grp, event, target, title, message, duration):
        self.grp = grp
        self.event = event
        self.title = title
        self.target = target
        self.message = message
        self.duration = duration
        self.u_ids = []

    @staticmethod
    def handle_request(url, data, mode=None):
        try:
            res = requests.post(url, json=data, timeout=15)
        except Exception as e:
            return logging.warning(f'通知发送失败，接口调用异常: {e}')
        if res.status_code != 200:
            return logging.warning(f'通知发送失败，返回状态码：{res.status_code}, 请求URL：{res.url}')

        if mode in ['dd', 'wx']:
            res = res.json()
            if res.get('errcode') == 0:
                return
        elif mode == 'fs':
            res = res.json()
            if res.get('StatusCode') == 0:
                return
        else:
            raise NotImplementedError
        logging.warning(f'通知发送失败，返回数据：{res}')

    def monitor_by_email(self, users):
        mail_service = AppSetting.get_default('mail_service', {})
        body = [
            f'告警名称：{self.title}',
            f'告警对象：{self.target}',
            f'{"告警" if self.event == "1" else "恢复"}时间：{human_datetime()}',
            f'告警描述：{self.message}'
        ]
        if self.event == '2':
            body.append('故障持续：' + self.duration)
        if not mail_service.get('server'):
            logging.warning('发送报警信息失败，未配置邮件服务，请在系统管理/系统设置/报警服务设置中配置。')
            return
        event_map = {'1': '监控告警通知', '2': '告警恢复通知'}
        subject = f'{event_map[self.event]}-{self.title}'
        mail = Mail(**mail_service)
        mail.send_text_mail(users, subject, '\r\n'.join(body) + '\r\n\r\n自动发送，请勿回复。')

    def monitor_by_dd(self, users):
        texts = [
            '## %s ## ' % ('监控告警通知' if self.event == '1' else '告警恢复通知'),
            f'**告警名称：** <font color="#{"f90202" if self.event == "1" else "008000"}">{self.title}</font> ',
            f'**告警对象：** {self.target} ',
            f'**{"告警" if self.event == "1" else "恢复"}时间：** {human_datetime()} ',
            f'**告警描述：** {self.message} ',
        ]
        if self.event == '2':
            texts.append(f'**持续时间：** {self.duration} ')
        data = {
            'msgtype': 'markdown',
            'markdown': {
                'title': '监控告警通知',
                'text': '\n\n'.join(texts) + '\n\n> ###### 来自 Evermodel运维平台'
            },
            'at': {
                'isAtAll': True
            }
        }
        for url, secret in users:
            if secret:
                timestamp, sign = gen_dd_sign(secret)
                sep = '&' if '?' in url else '?'
                url = f'{url}{sep}{urlencode({"timestamp": timestamp, "sign": sign})}'
            self.handle_request(url, data, 'dd')

    def monitor_by_fs(self, users):
        title = '监控告警通知' if self.event == '1' else '告警恢复通知'
        content = [
            [{'tag': 'text', 'text': f'告警名称：{self.title}'}],
            [{'tag': 'text', 'text': f'告警对象：{self.target}'}],
            [{'tag': 'text', 'text': f'{"告警" if self.event == "1" else "恢复"}时间：{human_datetime()}'}],
            [{'tag': 'text', 'text': f'告警描述：{self.message}'}],
        ]
        if self.event == '2':
            content.append([{'tag': 'text', 'text': f'持续时间：{self.duration}'}])
        content.append([{'tag': 'text', 'text': '来自 Evermodel运维平台'}])
        for url, secret in users:
            data = {
                'msg_type': 'post',
                'content': {'post': {'zh_cn': {'title': title, 'content': content}}}
            }
            if secret:
                # 飞书的 timestamp/sign 放在请求体里，与钉钉放 query 不同
                timestamp, sign = gen_fs_sign(secret)
                data['timestamp'] = timestamp
                data['sign'] = sign
            self.handle_request(url, data, 'fs')

    def monitor_by_qy_wx(self, users):
        color, title = ('warning', '监控告警通知') if self.event == '1' else ('info', '告警恢复通知')
        texts = [
            f'## {title}',
            f'**告警名称：** <font color="{color}">{self.title}</font> ',
            f'**告警对象：** {self.target}',
            f'**{"告警" if self.event == "1" else "恢复"}时间：** {human_datetime()} ',
            f'**告警描述：** {self.message} ',
        ]
        if self.event == '2':
            texts.append(f'**持续时间：** {self.duration} ')
        data = {
            'msgtype': 'markdown',
            'markdown': {
                'content': '\n'.join(texts) + '\n> 来自 Evermodel运维平台'
            }
        }
        for url in users:
            self.handle_request(url, data, 'wx')

    def _webhook_targets(self, field):
        """取该渠道的 [(webhook地址, 加签密钥)]，密钥可能为空（机器人未开启加签）。"""
        targets = []
        for c in Contact.objects.filter(**{'id__in': self.u_ids, f'{field}__isnull': False}):
            url = getattr(c, field)
            if not url:
                continue
            secret = None
            if c.secret:
                try:
                    secret = json.loads(c.secret).get(field)
                except (ValueError, AttributeError):
                    secret = None
            targets.append((url, secret))
        return targets

    def dispatch_monitor(self, modes):
        self.u_ids = sum([json.loads(x.contacts) for x in Group.objects.filter(id__in=self.grp)], [])
        for mode in modes:
            if mode == '3':
                users = self._webhook_targets('ding')
                if not users:
                    logging.warning('发送报警信息失败，未找到可用的通知对象，请确保设置了相关报警联系人的钉钉。')
                    continue
                self.monitor_by_dd(users)
            elif mode == '4':
                users = set(x.email for x in Contact.objects.filter(id__in=self.u_ids, email__isnull=False))
                if not users:
                    logging.warning('发送报警信息失败，未找到可用的通知对象，请确保设置了相关报警联系人的邮件地址。')
                    continue
                self.monitor_by_email(users)
            elif mode == '5':
                users = set(x.qy_wx for x in Contact.objects.filter(id__in=self.u_ids, qy_wx__isnull=False))
                if not users:
                    logging.warning('发送报警信息失败，未找到可用的通知对象，请确保设置了相关报警联系人的企业微信。')
                    continue
                self.monitor_by_qy_wx(users)
            elif mode == '7':
                users = self._webhook_targets('feishu')
                if not users:
                    logging.warning('发送报警信息失败，未找到可用的通知对象，请确保设置了相关报警联系人的飞书。')
                    continue
                self.monitor_by_fs(users)
