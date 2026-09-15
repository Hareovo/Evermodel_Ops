# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
"""接口清单

内省 Django URLConf 与视图源码，把系统对外暴露的全部 API 整理成一份可读的
在线文档，供前端「接口文档」页面展示。

所有内容都是请求时现算的，不维护任何手写清单：

- 路由 / 方法：遍历 URLConf，检查视图类真正实现了哪些 HTTP 方法；
- 请求参数：静态解析视图源码。Evermodel Ops 的参数校验是声明式的 ——
  ``JsonParser(Argument('name', type=int, required=False, help='...')).parse(request.body)``
  参数名、类型、是否必填、提示语都写在调用处，直接读出来即可；
  另外补扫 ``request.GET.get()`` / ``request.POST.get()`` / ``request.FILES[...]``
  这类未经 JsonParser 的直接读取；
- 路径参数：解析路由 pattern 里的 ``<int:xxx>`` 占位符。

对外路径统一带 ``/api`` 前缀，而 URLConf 内注册的是去掉该前缀后的内部路径
（``/api`` 由前端 nginx 反代时剥离），两者在此处重新拼回。
"""
import ast
import inspect
import re
import textwrap

from django.conf import settings as dj_settings
from django.urls import get_resolver
from django.urls.resolvers import URLPattern, URLResolver

from libs.utils import json_response

# 对外路径前缀，与前端 nginx 的 location /api/ 保持一致
API_PREFIX = '/api'

# 视图类中真正参与请求分发的业务方法（head/options/trace 由框架自动提供，
# 不作为业务接口在文档里罗列）
CONCRETE_METHODS = ('get', 'post', 'put', 'patch', 'delete')

# 一级路径前缀 -> 分组展示名。
# 刻意不叫 *_alias：TranslatorMiddleware 只会翻译 *_alias 结尾的字段，而这里的
# 分组名要交给前端 t() 翻译，才能和左侧菜单的叫法保持一致（后端词表只认
# 「任务计划 -> Cron」，前端词表是「任务计划 -> Scheduled Tasks」）。
GROUP_NAME = {
    'account': '账户管理',
    'host': '主机管理',
    'exec': '批量执行',
    'schedule': '任务计划',
    'monitor': '监控中心',
    'alarm': '报警中心',
    'setting': '系统设置',
    'home': '概览统计',
    'notify': '通知服务',
    'file': '文件管理',
}

# 路由 pattern 里的路径参数占位符，如 <int:t_id> / <str:name>
PATH_PARAM_RE = re.compile(r'<(?:(\w+):)?(\w+)>')

# 参数位置 -> 该位置参数在请求里的承载方式
LOCATION_LABEL = {
    'path': 'URL 路径',
    'query': 'Query 参数',
    'body': 'JSON 请求体',
    'form': '表单字段',
    'file': '上传文件',
}

# 示例值：按常见字段名给一个能直接跑通的取值，命中不了再按类型兜底
SAMPLE_BY_NAME = {
    'id': 1, 'pk': 1, 't_id': 1, 'host_id': 1, 'group_id': 1, 'task_id': 1,
    'user_id': 1, 'alarm_id': 1, 'template_id': 1,
    'host_ids': [1], 'group_ids': [1], 'ids': [1],
    'port': 22, 'hostname': '192.168.1.10', 'username': 'root',
    'password': '******', 'old_password': '******', 'new_password': '******',
    'name': 'demo', 'desc': '备注信息', 'path': '/tmp', 'dst_dir': '/tmp',
    'file': '/tmp/demo.txt', 'token': 'xxxxxxxx',
    'page': 1, 'page_size': 20, 'status': '0',
}


def _iter_urls(patterns, prefix=''):
    """深度优先展开 URLConf，产出 (内部路径, URLPattern)。"""
    for item in patterns:
        if isinstance(item, URLResolver):
            yield from _iter_urls(item.url_patterns, prefix + str(item.pattern))
        elif isinstance(item, URLPattern):
            yield prefix + str(item.pattern), item


def _view_class(callback):
    """`.as_view()` 返回的函数带有 view_class，函数视图则没有。"""
    return getattr(callback, 'view_class', None)


def _view_methods(callback):
    """推断接口支持的 HTTP 方法。"""
    view_class = _view_class(callback)
    if view_class is not None:
        allowed = getattr(view_class, 'http_method_names', CONCRETE_METHODS)
        methods = []
        for name in CONCRETE_METHODS:
            if name not in allowed:
                continue
            for klass in view_class.__mro__:
                if name in klass.__dict__:
                    # 跳过 Django 基类提供的通用实现，只认业务侧（含项目内基类）定义的
                    if not klass.__module__.startswith('django.'):
                        methods.append(name.upper())
                    break
        return methods

    # 函数视图：按源码里实际读取请求参数的方式推断
    name = getattr(callback, '__name__', '')
    source = _safe_source(callback)
    methods = []
    if 'request.GET' in source or re.search(r'''method\s*==\s*['"]GET['"]''', source):
        methods.append('GET')
    if 'request.body' in source or 'request.POST' in source \
            or re.search(r'''method\s*==\s*['"]POST['"]''', source):
        methods.append('POST')
    if not methods:
        # 既不读查询串也不读请求体时，按命名约定兜底：post_*/handle_* 视为写接口
        methods.append('POST' if name.startswith(('post_', 'handle_')) else 'GET')
    return methods


def _handler_name(callback):
    target = _view_class(callback) or callback
    module = getattr(target, '__module__', '')
    name = getattr(target, '__qualname__', None) or getattr(target, '__name__', repr(target))
    return f'{module}.{name}'


def _requires_auth(inner_path):
    """复刻 AuthenticationMiddleware 的白名单判定，标注接口是否需要登录。

    注意比对对象是 Django 视角的 request.path，即带前导斜杠、但不含 /api 前缀
    （nginx 反代时会剥掉 /api），例如 '/account/login/'。
    """
    path = f'/{inner_path.lstrip("/")}'
    for item in getattr(dj_settings, 'AUTHENTICATION_EXCLUDES', ()):
        if hasattr(item, 'match'):
            if item.match(path):
                return False
        elif item == path:
            return False
    return True


# ---------------------------------------------------------------------------
# 源码静态分析：从视图方法里提取请求参数
# ---------------------------------------------------------------------------

def _safe_source(func):
    try:
        return textwrap.dedent(inspect.getsource(func))
    except (OSError, TypeError):
        return ''


def _iter_method_sources(callback):
    """产出 (HTTP 方法, 源码)，源码用于解析该方法的请求参数。"""
    view_class = _view_class(callback)
    if view_class is None:
        source = _safe_source(callback)
        return [(name, source) for name in _view_methods(callback)]

    allowed = set(_view_methods(callback))
    found = []
    for name in CONCRETE_METHODS:
        method = name.upper()
        if method not in allowed:
            continue
        func = None
        for klass in view_class.__mro__:
            if name in klass.__dict__:
                if not klass.__module__.startswith('django.'):
                    func = klass.__dict__[name]
                break
        if func is not None:
            found.append((method, _safe_source(func)))
    return found


def _fstring_key(node):
    """把 f'file{index}' 这类 f-string 转成便于展示的 'file{N}'。"""
    parts = []
    for value in node.values:
        if isinstance(value, ast.Constant):
            parts.append(str(value.value))
        else:
            parts.append('{N}')
    return ''.join(parts)


def _request_locator(node):
    """解析表达式对应到请求的哪一部分。

    返回 ``(位置, 字段名)``，位置取 body / GET / POST / FILES；
    ``request.body`` 这类整体引用字段名为 None。
    """
    if isinstance(node, ast.Attribute):
        if isinstance(node.value, ast.Name) and node.value.id == 'request' \
                and node.attr in ('body', 'GET', 'POST', 'FILES'):
            return node.attr, None
        return None

    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) \
            and node.func.attr in ('get', 'getlist'):
        inner = _request_locator(node.func.value)
        if inner:
            key = None
            if node.args:
                arg = node.args[0]
                if isinstance(arg, ast.Constant):
                    key = arg.value
                elif isinstance(arg, ast.JoinedStr):
                    key = _fstring_key(arg)
            return inner[0], key
        return None

    if isinstance(node, ast.Subscript):
        inner = _request_locator(node.value)
        if inner:
            key = None
            if isinstance(node.slice, ast.Constant):
                key = node.slice.value
            elif isinstance(node.slice, ast.JoinedStr):
                key = _fstring_key(node.slice)
            return inner[0], key
        return None

    # json.loads(request.body) 之类
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) \
            and node.func.attr == 'loads' and node.args:
        return _request_locator(node.args[0])

    return None


def _collect_var_sources(tree):
    """收集 ``var = request.POST.get('data')`` 这类赋值。

    用于追踪 ``JsonParser(...).parse(var)`` 的数据来源 ——
    文件分发接口就是把 JSON 塞在表单字段里传的。
    """
    sources = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 \
                and isinstance(node.targets[0], ast.Name):
            locator = _request_locator(node.value)
            if locator:
                sources[node.targets[0].id] = locator
    return sources


def _parse_validator_call(node):
    """若 node 是 ``JsonParser(...).parse(<来源>)``，返回 (参数节点列表, 来源节点)。"""
    if not isinstance(node, ast.Call):
        return None
    func = node.func
    if not (isinstance(func, ast.Attribute) and func.attr == 'parse'):
        return None
    inner = func.value
    if not (isinstance(inner, ast.Call) and isinstance(inner.func, ast.Name)
            and inner.func.id.endswith('Parser')):
        return None
    source_node = node.args[0] if node.args else None
    return inner.args, source_node


def _type_name(node):
    """把 ``type=int`` / ``type=datetime`` 的 AST 节点转成可读的类型名。"""
    if node is None:
        return None
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Constant):
        return str(node.value)
    if isinstance(node, (ast.Tuple, ast.List)):
        return 'list'
    return None


def _extract_argument(node):
    """解析 ``Argument('name', type=int, required=False, help='...')``。"""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return {'name': node.value, 'type': None, 'required': True, 'default': None, 'help': None}
    if not (isinstance(node, ast.Call) and getattr(node.func, 'id', None) == 'Argument'):
        return None

    info = {'name': None, 'type': None, 'required': True, 'default': None, 'help': None}
    if node.args:
        first = node.args[0]
        if isinstance(first, ast.Constant):
            info['name'] = first.value
    for keyword in node.keywords:
        if keyword.arg is None:
            continue
        if keyword.arg == 'name' and isinstance(keyword.value, ast.Constant):
            info['name'] = keyword.value.value
        elif keyword.arg == 'type':
            info['type'] = _type_name(keyword.value)
        elif keyword.arg == 'required':
            info['required'] = bool(getattr(keyword.value, 'value', True))
        elif keyword.arg == 'default':
            try:
                info['default'] = ast.literal_eval(keyword.value)
            except (ValueError, SyntaxError):
                info['default'] = None
        elif keyword.arg == 'help' and isinstance(keyword.value, ast.Constant):
            info['help'] = keyword.value.value
    return info


def _sample_value(name, type_name, default):
    """给参数造一个能直接跑通的示例值。"""
    if default is not None:
        return default
    if name in SAMPLE_BY_NAME:
        return SAMPLE_BY_NAME[name]
    if type_name in ('int', 'float'):
        return 1
    if type_name == 'bool':
        return True
    if type_name in ('list', 'tuple'):
        return []
    if type_name in ('dict', 'AttrDict'):
        return {}
    return ''


def _resolve_location(source_node, var_sources):
    """判断校验器读取的是查询串、请求体还是表单。

    返回 ``(位置, 补充说明)``；位置为 None 表示无法识别（不产出参数）。
    """
    if source_node is None:
        return None, ''

    if isinstance(source_node, ast.Name) and source_node.id in var_sources:
        base, key = var_sources[source_node.id]
        if base == 'body':
            return 'body', ''
        if base == 'GET':
            return 'query', ''
        if base == 'POST':
            return 'form', f'下列参数需先 JSON 序列化，再放入表单字段 {key or "data"} 提交'
        return None, ''

    locator = _request_locator(source_node)
    if not locator:
        return None, ''
    base = locator[0]
    if base == 'body':
        return 'body', ''
    if base == 'GET':
        return 'query', ''
    if base == 'POST':
        return 'form', ''
    return None, ''


def _analyze_source(source):
    """解析单个视图方法的源码，产出它读取的全部请求参数。"""
    result = {'params': [], 'notes': []}
    if not source:
        return result
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return result

    var_sources = _collect_var_sources(tree)
    # 作为整体 JSON 字符串提交的表单字段名（如 transfer 的 data 字段），
    # 只有真正被校验器消费掉的变量才算，否则 group_id = request.POST.get('group_id')
    # 这种普通读取会被误判成包装字段而漏掉
    wrapped_keys = set()
    collected = {}

    def add(param):
        if param['name'] and param['name'] not in collected:
            collected[param['name']] = param

    # ① 声明式校验器：JsonParser(Argument(...), ...).parse(request.xxx)
    for node in ast.walk(tree):
        hit = _parse_validator_call(node)
        if not hit:
            continue
        arg_nodes, source_node = hit
        if isinstance(source_node, ast.Name) and source_node.id in var_sources:
            base, key = var_sources[source_node.id]
            if base == 'POST' and key:
                wrapped_keys.add(key)
        where, note = _resolve_location(source_node, var_sources)
        if not where:
            continue
        if note and note not in result['notes']:
            result['notes'].append(note)
        for arg_node in arg_nodes:
            info = _extract_argument(arg_node)
            if not info or not info['name']:
                continue
            add({
                'name': info['name'],
                'in': where,
                'type': info['type'],
                'required': info['required'],
                'help': info['help'] or '',
                'default': info['default'],
                'sample': _sample_value(info['name'], info['type'], info['default']),
            })

    # ② 未经校验器的直接读取：request.GET.get() / request.POST.get() / request.FILES[...]
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Call, ast.Subscript)):
            continue
        locator = _request_locator(node)
        if not locator:
            continue
        base, key = locator
        where = {'GET': 'query', 'POST': 'form', 'FILES': 'file'}.get(base)
        if not where or not key:
            continue
        if base == 'POST' and key in wrapped_keys:
            continue
        add({
            'name': key,
            'in': where,
            'type': None,
            'required': where == 'file',
            'help': '',
            'default': None,
            'sample': '/tmp/demo.txt' if where == 'file' else _sample_value(key, None, None),
        })

    result['params'] = list(collected.values())
    return result


def _content_type_of(params):
    """按参数构成推断请求体的 Content-Type。"""
    if any(x['in'] == 'file' for x in params):
        return 'multipart/form-data'
    if any(x['in'] == 'body' for x in params):
        return 'application/json'
    if any(x['in'] == 'form' for x in params):
        return 'application/x-www-form-urlencoded'
    return ''


def _path_params(inner_path):
    """从路由 pattern 里提取路径参数，如 <int:t_id>。"""
    params = []
    for type_name, name in PATH_PARAM_RE.findall(inner_path):
        params.append({
            'name': name,
            'in': 'path',
            'type': type_name or 'str',
            'required': True,
            'help': '',
            'default': None,
            'sample': _sample_value(name, type_name or 'str', None),
        })
    return params


def _build_endpoints(callback, inner_path):
    endpoints = []
    shared_path_params = _path_params(inner_path)
    for method, source in _iter_method_sources(callback):
        analysis = _analyze_source(source)
        params = shared_path_params + analysis['params']
        endpoints.append({
            'method': method,
            'content_type': _content_type_of(params),
            'params': params,
            'notes': analysis['notes'],
        })
    return endpoints


def get_apis(request):
    records = {}
    for inner_path, pattern in _iter_urls(get_resolver().url_patterns):
        callback = pattern.callback
        group = inner_path.split('/', 1)[0]
        full_path = f'{API_PREFIX}/{inner_path.lstrip("/")}'
        # 同一路径可能被不同 name 重复注册，按 (路径, name) 去重
        records[f'{full_path}#{pattern.name}'] = {
            'path': full_path,
            'name': pattern.name or '',
            'group': group,
            'group_name': GROUP_NAME.get(group, '其他'),
            'methods': _view_methods(callback),
            'handler': _handler_name(callback),
            'type': 'class' if _view_class(callback) else 'function',
            'auth': _requires_auth(inner_path),
            'endpoints': _build_endpoints(callback, inner_path),
        }
    data = sorted(records.values(), key=lambda x: (x['group'], x['path'], x['handler']))
    return json_response(data)
