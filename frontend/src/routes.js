/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { t } from 'libs';
import {
  CloudServerOutlined,
  CodeOutlined,
  ScheduleOutlined,
  MonitorOutlined,
  AreaChartOutlined,
  AlertOutlined,
  ApiOutlined,
  SettingOutlined
} from '@ant-design/icons';

import HostIndex from './pages/host';
import ExecTask from './pages/exec/task';
import ExecTemplate from './pages/exec/template';
import ExecTransfer from './pages/exec/transfer';
import ScheduleIndex from './pages/schedule';
import MonitorIndex from './pages/monitor';
import GrafanaIndex from './pages/grafana';
import AlarmIndex from './pages/alarm/alarm';
import AlarmGroup from './pages/alarm/group';
import AlarmContact from './pages/alarm/contact';
import SystemAccount from './pages/system/account';
import SystemSetting from './pages/system/setting';
import SystemLogin from './pages/system/login';
import ApidocsIndex from './pages/apidocs';
import WelcomeIndex from './pages/welcome/index';
import WelcomeInfo from './pages/welcome/info';

export default [
  {icon: <CloudServerOutlined/>, title: t('主机管理'), path: '/host', component: HostIndex},
  {
    icon: <CodeOutlined/>, title: t('批量执行'), child: [
      {title: t('执行任务'), path: '/exec/task', component: ExecTask},
      {title: t('模板管理'), path: '/exec/template', component: ExecTemplate},
      {title: t('文件分发'), path: '/exec/transfer', component: ExecTransfer},
    ]
  },
  {icon: <ScheduleOutlined/>, title: t('任务计划'), path: '/schedule', component: ScheduleIndex},
  {icon: <MonitorOutlined/>, title: t('监控中心'), path: '/monitor', component: MonitorIndex},
  {icon: <AreaChartOutlined/>, title: t('监控大屏'), path: '/grafana', component: GrafanaIndex},
  {
    icon: <AlertOutlined/>, title: t('报警中心'), child: [
      {title: t('报警历史'), path: '/alarm/alarm', component: AlarmIndex},
      {title: t('报警联系人'), path: '/alarm/contact', component: AlarmContact},
      {title: t('报警联系组'), path: '/alarm/group', component: AlarmGroup},
    ]
  },
  {
    icon: <SettingOutlined/>, title: t('系统管理'), child: [
      {title: t('登录日志'), path: '/system/login', component: SystemLogin},
      {title: t('账户管理'), path: '/system/account', component: SystemAccount},
      {title: t('系统设置'), path: '/system/setting', component: SystemSetting},
    ]
  },
  {icon: <ApiOutlined/>, title: t('接口文档'), path: '/apidocs', component: ApidocsIndex},
  {path: '/welcome/index', component: WelcomeIndex},
  {path: '/welcome/info', component: WelcomeInfo},
]
