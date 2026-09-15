/**
 * 根据种子（用户 id + 昵称）生成一个稳定的「随机」头像。
 *
 * 特点：
 *  - 纯本地生成，输出 SVG data URI，不依赖外网，也不需要额外的图片资源；
 *  - 同一个种子永远得到同一张头像（同一账号登录/刷新都一样）；
 *  - 不同用户配色和图案都不同，看起来是随机的。
 *
 * 想换风格只改下面的 PALETTE 和 SHAPES 即可。
 */

// [背景色, 图案色] 成对出现，图案色是背景色的浅色调
const PALETTE = [
  ['#2563fc', '#93b1fd'],
  ['#5ad8a6', '#b3efd2'],
  ['#f6bd16', '#fbdf8f'],
  ['#e8684a', '#f4ab99'],
  ['#6dc8ec', '#b3e4f6'],
  ['#9270ca', '#c6b2e6'],
  ['#ff9d4d', '#ffc79a'],
  ['#269a99', '#74c6c5'],
  ['#ff99c3', '#ffc9de'],
  ['#5d7092', '#9dabc0'],
];

// 4 种图案，按哈希取一个
const SHAPES = [
  // 大圆 + 小圆
  '<circle cx="23" cy="24" r="13"/><circle cx="43" cy="43" r="7" opacity=".75"/>',
  // 三角
  '<path d="M32 13 L53 51 L11 51 Z"/>',
  // 两条圆角横条
  '<rect x="13" y="17" width="38" height="9" rx="4.5"/><rect x="13" y="31" width="24" height="9" rx="4.5" opacity=".7"/>',
  // 半圆 + 小圆
  '<path d="M11 41 A21 21 0 0 1 53 41 Z"/><circle cx="32" cy="21" r="7" opacity=".7"/>',
];

function hashCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * @param {string} seed 种子，建议用 `${id}-${nickname}`
 * @returns {string} SVG 的 data URI，可直接给 antd <Avatar src={...}/>
 */
export function getAvatar(seed) {
  const key = String(seed || 'evermodel');
  const hash = hashCode(key);
  const [background, foreground] = PALETTE[hash % PALETTE.length];
  // 用哈希的高位再取一次图案，避免配色和图案强绑定
  const shape = SHAPES[Math.floor(hash / PALETTE.length) % SHAPES.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${background}"/>` +
    `<g fill="${foreground}">${shape}</g>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 取当前登录用户的头像（种子 = id + 昵称）
 */
export function currentUserAvatar() {
  const id = localStorage.getItem('id') || '';
  const nickname = localStorage.getItem('nickname') || '';
  return getAvatar(`${id}-${nickname}`);
}

export default getAvatar;
