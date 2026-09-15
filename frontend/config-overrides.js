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
        '@primary-color': '#2563fc'
      }
    }
  }),
  removeWorkboxServiceWorker(),
);
