/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
const dict = {
  // Menu / shared
  '首页': 'Home',
  '基本设置': 'Basic Settings',
  '安全设置': 'Security Settings',
  '密钥设置': 'SSH Key Settings',
  '报警服务设置': 'Alert Service Settings',
  '保存设置': 'Save Settings',
  '确认': 'Confirm',
  '设置成功': 'Saved successfully',

  // AlarmSetting.js
  '邮件服务连接成功': 'Email service connected successfully',
  '请完成邮件服务配置': 'Please complete the email service configuration',
  '邮件服务': 'Email Service',
  '用于通过邮件方式发送报警信息': 'Used to send alert notifications via email',
  '内置': 'Built-in',
  '自定义': 'Custom',
  '邮件服务器': 'SMTP Server',
  '例如：smtp.exmail.qq.com': 'e.g. smtp.exmail.qq.com',
  '例如：465': 'e.g. 465',
  '邮箱账号': 'Email Account',
  '例如：dev@exmail.com': 'e.g. dev@exmail.com',
  '密码/授权码': 'Password / Auth Code',
  '请输入对应的密码或授权码': 'Password or SMTP authorization code',
  '发件人昵称': 'Sender Name',
  '请输入发件人昵称': 'Sender display name',
  '测试邮件服务': 'Test Email Service',

  // KeySetting.js
  '密钥修改确认': 'Confirm key change',
  '请谨慎修改密钥对，修改密钥对可能会让现有的主机都无法进行验证，影响与主机相关的各项功能！': 'Be careful: changing the key pair may break authentication for all existing hosts and affect every host-related feature!',
  // The three entries below form one sentence around a highlighted span, keep the spaces.
  '修改密钥对需要': 'Changes to the key pair ',
  '重启服务后生效': 'take effect after the service is restarted',
  '，已添加的主机可能需要重新进行编辑验证后才可以正常连接。': ', and hosts already added may need to be edited and re-verified before they can connect again.',
  '在这里你可以上传并使用已有的密钥对，没有上传密钥的情况下，Spug会在首次添加主机时自动生成密钥对。': 'You can upload an existing key pair here. If none is uploaded, Evermodel Ops will generate one automatically when the first host is added.',
  '公钥': 'Public Key',
  '一般位于 ~/.ssh/id_rsa.pub': 'Usually located at ~/.ssh/id_rsa.pub',
  '请输入公钥': 'Enter the public key',
  '私钥': 'Private Key',
  '一般位于 ~/.ssh/id_rsa': 'Usually located at ~/.ssh/id_rsa',
  '请输入私钥内容': 'Enter the private key content',

  // About.js
  '操作系统': 'Operating System',

  // OpenService.js
  '访问凭据': 'Access Token',

  // SecuritySetting.js
  '访问IP校验': 'Client IP Verification',
  // Followed inline by the "Why is the real IP not detected?" link, keep the trailing space.
  '建议开启，校验是否获取了真实的访问者IP，防止因为增加的反向代理层导致基于IP的安全策略失效，当校验失败时会在登录时弹窗提醒。如果你在内网部署且仅在内网使用可以关闭该特性。': 'Recommended. Verifies that the real client IP is obtained, so IP-based security policies are not defeated by an extra reverse proxy layer. A popup will warn you at login when the check fails. If Evermodel Ops is deployed and used only on an internal network, you can turn this off. ',
  '为什么没有获取到真实IP？': 'Why is the real IP not detected?',
  '登录IP绑定': 'Login IP Binding',
  '强烈建议开启，当开启后会把登录凭证与IP进行绑定，当该登录凭证通过其他IP访问时将自动失效。如非必要，切勿关闭该特性！': 'Strongly recommended. When enabled, the login session is bound to the client IP and is invalidated automatically if used from another IP. Do not turn this off unless you really have to!',

  // GrafanaSetting.js
  'Grafana 地址': 'Grafana Address',
  'Grafana 站点根地址，不带结尾斜杠。注意这里填的地址是浏览器要访问的地址，iframe 是浏览器直连它的。': 'Root URL of the Grafana site, without a trailing slash. This must be the address the browser can reach — the iframe connects to Grafana directly.',
  '请求超时': 'Request Timeout',
  '后台探测 Grafana 的超时时间（秒），1 - 60。': 'How long the backend waits when probing Grafana, in seconds (1 - 60).',
  '看板白名单': 'Dashboard Whitelist',
  '留空表示自动显示 Grafana 里的全部看板。每行一个，格式为「看板UID 显示名称」，名称可省略；列表里没出现的看板不会显示，顺序按这里的先后。': 'Leave empty to show every dashboard in Grafana. One per line, formatted as "dashboard UID display name" (the name is optional). Dashboards missing from this list are hidden, and the order follows the list.',
  '测试连接': 'Test Connection',
  '请填写 Grafana 地址': 'Please enter the Grafana address',
  '地址需以 http:// 或 https:// 开头': 'The address must start with http:// or https://',
  '保存成功': 'Saved successfully',
  '连接失败': 'Connection failed',
  '还没有填写 Grafana 地址': 'Grafana address is not set yet',
  '填好上面的地址并保存后，这里会自动显示连接结果。': 'Fill in the address above and save — the connection result will appear here.',
  '已连接，但 Grafana 未开启匿名访问': 'Connected, but anonymous access is off in Grafana',
  '服务地址是通的，但看板在嵌入的窗口里会要求登录（iframe 带不上 Grafana 的登录态）。需要在 Grafana 侧放行匿名只读访问：': 'The address is reachable, but the embedded dashboard will ask for a login (an iframe cannot carry the Grafana session). Allow anonymous read-only access in Grafana:',
  '改完重启 Grafana 容器即可，不需要重启本平台。': 'Restart the Grafana container afterwards; this platform does not need a restart.',
  '连接正常，匿名只读已开启': 'Connected, anonymous read-only access is enabled',
  '共发现 {} 个看板，已自动铺成监控大屏顶部的标签页。': '{} dashboard(s) found — they are laid out as tabs at the top of the wall display.',
  '打开监控大屏': 'Open Monitoring',
};

export default dict;
