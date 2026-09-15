/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * API reference page. The endpoint list itself comes from the backend and is
 * language-neutral; only the surrounding chrome needs translating.
 */
const apidocs = {
  '接口文档': 'API Reference',
  '接口清单': 'API Endpoints',
  '方法': 'Method',
  '接口路径': 'Endpoint',
  '处理器': 'Handler',
  '认证': 'Auth',
  '需登录': 'Sign-in required',
  '公开': 'Public',
  '类视图': 'Class view',
  '函数视图': 'Function view',
  '关键字': 'Keyword',
  '请求方法': 'HTTP method',
  '请输入接口路径、名称或处理器': 'Search by endpoint, name or handler',
  '复制路径': 'Copy endpoint',
  '复制全部路径': 'Copy all endpoints',
  '复制示例命令': 'Copy sample command',
  '已复制到剪贴板': 'Copied to clipboard',
  '已复制全部接口路径': 'All endpoints copied',
  '复制失败，请手动选择复制': 'Copy failed, please select and copy manually',
  '共 {} 个接口': '{} endpoints',
  '操作': 'Actions',
  '使用说明': 'Usage',
  // Group labels: the backend returns Chinese, t() keeps them in sync with the sidebar
  '概览统计': 'Overview',
  '通知服务': 'Notifications',
  '其他': 'Other',
  // Endpoint detail
  '请求头': 'Request headers',
  '你的 Token': 'your token',
  '身份凭证，公开接口以外必须携带': 'Credential, required for every non-public endpoint',
  '可选，需要英文返回时携带': 'Optional, send it to get English responses',
  '可选，请求体为 JSON 时的默认方式': 'Optional, the default when the request body is JSON',
  '请求参数': 'Parameters',
  '参数名称': 'Name',
  '位置': 'Location',
  '必填': 'Required',
  '说明': 'Description',
  '示例值': 'Sample',
  '字符串': 'string',
  '必填参数': 'Required',
  '可选参数': 'Optional',
  '无参数': 'No parameters',
  '无请求体': 'No request body',
  '共 {} 个参数': '{} parameter(s)',
  '示例命令': 'Sample request',
  '已复制示例命令': 'Sample command copied',
  'URL 路径': 'Path',
  'Query 参数': 'Query',
  'JSON 请求体': 'JSON body',
  '表单字段': 'Form field',
  '上传文件': 'File',
  '响应体：error 为空表示成功，业务数据在 data 中。':
    'Response: an empty "error" means success, the payload is in "data".',
  '所有接口统一返回 {data, error} 结构': 'Every endpoint returns the same {data, error} envelope',
  // Usage panel
  '请求地址': 'Base URL',
  '认证方式': 'Authentication',
  '请求体': 'Request body',
  '语言': 'Language',
  '响应格式': 'Response format',
};

export default apidocs;
