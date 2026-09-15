/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { Form, Switch, message } from 'antd';
import styles from './index.module.css';
import http from 'libs/http';
import { t } from 'libs';
import store from './store';

export default observer(function () {
  const [verify_ip, setVerifyIP] = useState(store.settings.verify_ip);
  const [bind_ip, setBindIP] = useState(store.settings.bind_ip);

  function handleChangeVerifyIP(v) {
    setVerifyIP(v);
    http.post('/api/setting/', {data: [{key: 'verify_ip', value: v}]})
      .then(() => {
        message.success(t('设置成功'));
        store.fetchSettings()
      })
  }

  function handleChangeBindIP(v) {
    setBindIP(v);
    http.post('/api/setting/', {data: [{key: 'bind_ip', value: v}]})
      .then(() => {
        message.success(t('设置成功'));
        store.fetchSettings()
      })
  }

  return (
    <React.Fragment>
      <div className={styles.title}>{t('安全设置')}</div>
      <Form layout="vertical" style={{maxWidth: 500}}>
        <Form.Item
          label={t('访问IP校验')}
          extra={t('建议开启，校验是否获取了真实的访问者IP，防止因为增加的反向代理层导致基于IP的安全策略失效，当校验失败时会在登录时弹窗提醒。如果你在内网部署且仅在内网使用可以关闭该特性。')}>
          <Switch
            checkedChildren={t('开启')}
            unCheckedChildren={t('关闭')}
            onChange={handleChangeVerifyIP}
            checked={verify_ip}/>
        </Form.Item>
        <Form.Item
          label={t('登录IP绑定')}
          extra={t('强烈建议开启，当开启后会把登录凭证与IP进行绑定，当该登录凭证通过其他IP访问时将自动失效。如非必要，切勿关闭该特性！')}>
          <Switch
            checkedChildren={t('开启')}
            unCheckedChildren={t('关闭')}
            onChange={handleChangeBindIP}
            checked={bind_ip}/>
        </Form.Item>
      </Form>
    </React.Fragment>
  )
})
