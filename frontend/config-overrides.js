/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
const {override, addDecoratorsLegacy, addLessLoader} = require('customize-cra');

/**
 * 去掉 CRA 默认的 Workbox service worker 生成插件。
 * 两个原因：
 *  1) 入口 src/index.js 调用的是 serviceWorker.unregister()，本项目本来就没启用 SW；
 *  2) 当前 npm 源里的 lodash.template 是被改坏的版本（4.18.0，正常最新版是 4.5.0），
 *     会让 workbox-build@4.3.1 报
 *     "Unable to generate service worker from template. 'assignWith is not defined'"
 *     导致 `npm run build` 直接失败。因此这里显式移除该插件，不要把它加回来。
 */
const removeWorkboxServiceWorker = () => config => {
  config.plugins = (config.plugins || []).filter(
    plugin => !(plugin && plugin.constructor && plugin.constructor.name === 'GenerateSW')
  );
  return config;
};

module.exports = override(
  addDecoratorsLegacy(),
  addLessLoader({
    lessOptions: {
      javascriptEnabled: true,
      modifyVars: {
        // ---- 现代化主题变量（antd 4）----
        // 主色：微调为更现代的亮蓝
        '@primary-color': '#3b6ef6',
        '@info-color': '#3b6ef6',
        '@success-color': '#22c55e',
        '@warning-color': '#f59e0b',
        '@error-color': '#ef4444',

        // 文字色阶（中性灰，更有层次）
        '@heading-color': 'rgba(15, 23, 42, 0.92)',
        '@text-color': 'rgba(30, 41, 59, 0.88)',
        '@text-color-secondary': 'rgba(51, 65, 85, 0.55)',

        // 圆角系统：整体放大
        '@border-radius-base': '6px',
        '@border-radius-sm': '4px',

        // 边框与分割
        '@border-color-base': '#e2e8f0',
        '@border-color-split': '#eef2f6',

        // 背景
        '@background-color-light': '#f8fafc',
        '@body-background': '#f2f4f7',
        '@layout-body-background': '#f2f4f7',
        '@layout-header-background': '#ffffff',
        '@layout-sider-background': '#0b1220',
        '@menu-dark-bg': '#0b1220',
        '@menu-dark-submenu-bg': '#0a0f1a',
        '@menu-dark-item-active-bg': '#3b6ef6',

        // 表格
        '@table-header-bg': '#f8fafc',
        '@table-header-color': 'rgba(51, 65, 85, 0.75)',
        '@table-row-hover-bg': '#f6f9ff',
        '@table-padding-vertical': '14px',
        '@table-padding-horizontal': '16px',

        // 卡片
        '@card-padding-base': '20px',
        '@card-head-padding': '14px',
        '@card-radius': '10px',

        // 阴影
        '@shadow-1-down': '0 6px 16px -8px rgba(15, 23, 42, 0.08), 0 9px 28px 0 rgba(15, 23, 42, 0.05), 0 12px 48px 16px rgba(15, 23, 42, 0.03)',
        '@shadow-2': '0 12px 32px rgba(15, 23, 42, 0.12)',
      }
    }
  }),
  removeWorkboxServiceWorker(),
);
