/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * 查看/复制当前登录账户的访问 Token（即请求头 X-Token 的值）。
 *
 * Token 就是登录成功后写入 localStorage 的那一个（pages/login/index.js），服务端在
 * AuthenticationMiddleware 里会把它的 token_expired 续到「当前时间 + TOKEN_TTL」——
 * 即滑动过期：只要还在使用就不会失效（TOKEN_TTL = 8 小时，见 evermodel_ops/settings.py）。
 * 退出登录、修改密码都会把 token_expired 置 0，Token 立即失效。
 */
import React from 'react';
import { Modal, Alert, Button, Divider } from 'antd';
import { KeyOutlined, CopyOutlined } from '@ant-design/icons';
// 直接引叶子模块而不走 'libs' 桶文件：桶文件会经 ./router 拉入整棵页面树，
// 而本组件位于 components 下、被 layout/Header 引用，走桶文件会绕回自身形成循环依赖。
import { t } from '../libs/i18n';
import { copyText } from '../libs/clipboard';

const MONO = {fontFamily: 'Menlo, Consolas, monospace'};
const LABEL = {color: 'rgba(0, 0, 0, .45)', marginBottom: 8};
const CODE = {
  ...MONO,
  fontSize: 12,
  background: '#f6f6f6',
  border: '1px solid #f0f0f0',
  borderRadius: 2,
  padding: '10px 12px',
  margin: '8px 0 0',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  color: 'rgba(0, 0, 0, .85)'
};

// 外部系统没有浏览器登录态，只能调登录接口换取 Token
const LOGIN_CURL = [
  "curl -X POST 'http://<host>/api/account/login/' \\",
  "  -H 'Content-Type: application/json' \\",
  '  -d \'{"username": "admin", "password": "<你的密码>"}\''
].join('\n');

export function getToken() {
  return localStorage.getItem('token') || ''
}

export default function (props) {
  const token = getToken();
  return (
    <Modal
      width={640}
      footer={null}
      title={<span><KeyOutlined style={{marginRight: 8}}/>{t('我的 Token')}</span>}
      visible={props.visible}
      onCancel={props.onClose}>
      {token ? (
        <React.Fragment>
          <Alert
            showIcon
            type="info"
            style={{marginBottom: 20}}
            message={t('这是当前登录账户的访问凭证')}
            description={t('调用本系统的 API 时放在请求头 X-Token 里，也支持查询参数 ?x-token=。有效期为 8 小时且每次请求都会自动续期，只要还在使用就不会失效；退出登录或修改密码会立即失效。')}/>
          <div style={LABEL}>{t('当前 Token')}</div>
          <div style={{display: 'flex', alignItems: 'flex-start'}}>
            <div style={{...MONO, flex: 1, wordBreak: 'break-all', lineHeight: '30px'}}>{token}</div>
            <Button
              size="small"
              type="primary"
              icon={<CopyOutlined/>}
              style={{marginLeft: 12, flex: 'none'}}
              onClick={() => copyText(token)}>{t('复制')}</Button>
          </div>
          <Divider style={{margin: '20px 0 16px'}}/>
          <div style={LABEL}>{t('脚本 / 其他系统怎么获取')}</div>
          <div>{t('它们没有浏览器登录态，调一次登录接口即可换取，响应里的 access_token 就是 Token：')}</div>
          <pre style={CODE}>{LOGIN_CURL}</pre>
        </React.Fragment>
      ) : (
        <Alert
          showIcon
          type="warning"
          message={t('未获取到 Token，请重新登录后再试。')}/>
      )}
    </Modal>
  )
}
