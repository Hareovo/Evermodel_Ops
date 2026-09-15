/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * 复制到剪贴板。navigator.clipboard 只在安全上下文（https / localhost）可用，
 * 通过内网 IP 以 http 访问时拿不到，因此保留 execCommand 兜底。
 */
import { message } from 'antd';
import { t } from './i18n';

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.top = '-1000px';
  el.setAttribute('readonly', 'readonly');
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, text.length);
  try {
    document.execCommand('copy');
    return true
  } catch (e) {
    return false
  } finally {
    document.body.removeChild(el);
  }
}

export function copyText(text, tip) {
  const success = () => message.success(tip || t('已复制到剪贴板'));
  const failed = () => message.error(t('复制失败，请手动选择复制'));
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(success).catch(() => {
      fallbackCopy(text) ? success() : failed()
    })
  } else {
    fallbackCopy(text) ? success() : failed()
  }
}
