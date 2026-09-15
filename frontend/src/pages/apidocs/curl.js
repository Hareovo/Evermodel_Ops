/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */

// 路径参数没有示例值时的兜底取值
const PATH_SAMPLE = {int: '1', str: 'demo', uuid: 'xxxxxxxx'};

// 把 /api/schedule/<int:t_id>/ 里的占位符替换成示例值
export function fillPath(path, params) {
  return path.replace(/<(?:(\w+):)?(\w+)>/g, (raw, type, name) => {
    const param = (params || []).find(x => x.in === 'path' && x.name === name);
    let value = param ? param.sample : '';
    if (value === '' || value === null || value === undefined) value = PATH_SAMPLE[type] || 'demo';
    return encodeURIComponent(String(value))
  })
}

function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value)
}

/**
 * 生成一份可直接粘贴执行的示例命令。
 * query 只带必填项（可选参数按需补充，避免 URL 长得没法看），
 * 请求体与表单则完整给出，保证示例能一次跑通。
 */
export function buildCurl(api, endpoint) {
  const params = endpoint.params || [];
  const url = `${window.location.origin}${fillPath(api.path, params)}`;
  const query = params.filter(x => x.in === 'query' && x.required);
  const search = query.length
    ? '?' + query.map(x => `${x.name}=${encodeURIComponent(toText(x.sample))}`).join('&')
    : '';
  const args = [`curl -X ${endpoint.method} '${url}${search}'`];

  if (api.auth) args.push("-H 'X-Token: <你的 Token>'");
  if (endpoint.content_type) args.push(`-H 'Content-Type: ${endpoint.content_type}'`);

  const body = params.filter(x => x.in === 'body');
  if (body.length) {
    const payload = {};
    for (const item of body) payload[item.name] = item.sample;
    args.push(`-d '${JSON.stringify(payload, null, 2)}'`)
  }
  for (const item of params.filter(x => x.in === 'form')) {
    args.push(`-F '${item.name}=${toText(item.sample)}'`)
  }
  for (const item of params.filter(x => x.in === 'file')) {
    const name = item.name.replace('{N}', '0');
    args.push(`-F '${name}=@${toText(item.sample) || '/tmp/demo.txt'}'`)
  }
  return args.join(' \\\n  ')
}
