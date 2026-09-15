/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * Grafana wall-display page. Dashboard titles come from Grafana itself and are
 * left as-is; only this page's own chrome needs translating.
 */
const grafana = {
  '监控大屏': 'Monitoring Wall',
  '尚未配置 Grafana 地址': 'Grafana address is not configured',
  '请在「系统管理 / 系统设置 / 监控大屏」中填写 Grafana 地址。':
    'Set the Grafana address in System / System Settings / Monitoring Wall.',
  'Grafana 不可用': 'Grafana is unreachable',
  'Grafana 未开启匿名访问，看板在嵌入的窗口里会要求登录':
    'Anonymous access is off in Grafana — the embedded dashboard will ask for a login',
  'iframe 无法携带 Grafana 的登录态，需要在 Grafana 侧放行匿名只读访问：':
    'An iframe cannot carry the Grafana session, so anonymous read-only access has to be allowed in Grafana:',
  '改完重启 Grafana 容器即可，本页刷新后生效。':
    'Restart the Grafana container afterwards, then refresh this page.',
  '全屏': 'Fullscreen',
  '正在加载看板...': 'Loading dashboard...',
  'Grafana 中还没有可展示的看板': 'No dashboards to display yet',
  '在 Grafana 里建好看板后回到本页重新加载即可；也可以在「系统管理 / 系统设置 / 监控大屏」里手工指定要显示的看板。':
    'Create a dashboard in Grafana and reload this page, or list the ones you want explicitly in System / System Settings / Monitoring Wall.',
};

export default grafana;
