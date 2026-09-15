/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
const dict = {
  // Login page
  '灵活、强大、易用的开源运维平台': 'A flexible, powerful and easy-to-use open source DevOps platform',
  '欢迎回来': 'Welcome back',
  '请输入账户信息以继续': 'Please enter your credentials to continue',
  '账户': 'Username',
  '普通登录': 'Password',
  '请输入账户': 'Username',
  '请输入密码': 'Password',
  '请输入验证码': 'Verification code',
  '获取验证码': 'Send code',
  '{} 秒后重新获取': 'Resend in {}s',
  '登录': 'Sign in',
  '登录中...': 'Signing in...',
  '登录失败，请稍后重试': 'Sign-in failed, please try again later',
  '安全警告': 'Security warning',
  '未能获取到访问者的真实IP，无法提供基于请求来源IP的合法性验证。':
    'Could not detect the real client IP, so IP-based access validation is unavailable.',
  '未能获取到访问者的真实IP，无法提供基于请求来源IP的合法性验证，详细信息请参考':
    'Could not detect the real client IP, so IP-based access validation is unavailable. See the ',
  '官方文档': 'documentation',
  '官网': 'Website',
  '文档': 'Docs',
  '会话过期，请重新登录': 'Session expired, please sign in again',
  '无效的数据格式': 'Invalid response format',
  '请求失败: {}': 'Request failed: {}',
  '请求异常: {}': 'Request error: {}',

  // Layout / notifications
  // 官方安装脚本创建的默认管理员昵称，右上角与欢迎页按语言显示
  '管理员': 'Administrator',
  '知道了': 'Got it',
  '全部 已读': 'Mark all as read',
  '检测到您在移动设备上访问，请使用横屏模式。': 'Mobile device detected, please use landscape mode.',
  '抱歉，你访问的页面不存在': 'Sorry, the page you visited does not exist',

  // Shared components
  '输入检索': 'Search',
  '已选择': 'Selected',
  '项': 'item(s)',

  // Token modal (components/TokenModal.js)
  '当前 Token': 'Current token',
  '复制': 'Copy',
  '这是当前登录账户的访问凭证': 'This is the access credential of the current account',
  '调用本系统的 API 时放在请求头 X-Token 里，也支持查询参数 ?x-token=。有效期为 8 小时且每次请求都会自动续期，只要还在使用就不会失效；退出登录或修改密码会立即失效。':
    'Pass it in the X-Token request header when calling the API; the ?x-token= query parameter works too. It lasts 8 hours and is renewed on every request, so it stays valid as long as it keeps being used. Signing out or changing the password invalidates it immediately.',
  '脚本 / 其他系统怎么获取': 'How scripts and other systems get one',
  '它们没有浏览器登录态，调一次登录接口即可换取，响应里的 access_token 就是 Token：':
    'They have no browser session, so call the login endpoint once — the access_token in the response is the token:',
  '未获取到 Token，请重新登录后再试。': 'No token found, please sign in again.',
  // backend notifications pushed over WebSocket (Chinese text is the key)
  '通知发送失败': 'Failed to send the notification',
  '发送报警信息失败': 'Failed to send the alert',
  '未配置邮件服务，请在系统管理/系统设置/报警服务设置中配置。': 'The email service is not configured, please set it in System / System Settings / Alert Service.',
  '未找到可用的通知对象，请确保设置了相关报警联系人的钉钉。': 'No available recipient, please make sure the alert contacts have DingTalk configured.',
  '未找到可用的通知对象，请确保设置了相关报警联系人的邮件地址。': 'No available recipient, please make sure the alert contacts have an email address configured.',
  '未找到可用的通知对象，请确保设置了相关报警联系人的企业微信。': 'No available recipient, please make sure the alert contacts have WeChat Work configured.',
  '请检查监控、任务计划或批量执行等避免长耗时任务，必要时可重启服务清空队列。': 'Check monitoring, scheduled tasks and batch execution for long-running jobs, restart the service to drain the queue if necessary.',
};

export default dict;
