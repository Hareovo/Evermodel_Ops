/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * English translation dictionaries, keyed by the original Chinese text.
 * The per-module dictionaries are merged first, then the base glossary is
 * applied last so that shared terms stay consistent across the app.
 */
import base from './base';
import layout from './layout';
import welcome from './welcome';
import host from './host';
import exec from './exec';
import schedule from './schedule';
import monitor from './monitor';
import grafana from './grafana';
import alarm from './alarm';
import system from './system';
import systemSetting from './system_setting';
import apidocs from './apidocs';
import ssh from './ssh';

export default Object.assign(
  {},
  layout,
  welcome,
  host,
  exec,
  schedule,
  monitor,
  grafana,
  alarm,
  system,
  systemSetting,
  apidocs,
  ssh,
  base,
);
