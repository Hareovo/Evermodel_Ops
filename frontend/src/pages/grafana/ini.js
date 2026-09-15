/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * Grafana 侧需要放行的两件事。监控大屏页和「系统设置 / 监控大屏」都要贴这段，
 * 抽出来放一处，避免两处文本各自漂移。
 */
export const GRAFANA_INI = `[security]
allow_embedding = true

[auth.anonymous]
enabled = true
org_name = Main Org.
org_role = Viewer`;

export default GRAFANA_INI;
