/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { Button, Form, Input, Space, message } from 'antd';
import styles from './index.module.css';
import { http, t } from 'libs';
import store from './store';

export default observer(function () {
  const [form] = Form.useForm();
  const setting = store.settings.mail_service || {};
  const [loading, setLoading] = useState(false);

  function handleEmailTest() {
    setLoading(true);
    const formData = form.getFieldsValue();
    http.post('/api/setting/email_test/', formData)
      .then(() => {
        message.success(t('邮件服务连接成功'))
      }).finally(() => setLoading(false))
  }

  function handleSubmit() {
    const formData = form.getFieldsValue();
    if (!formData.server || !formData.port || !formData.username || !formData.password) {
      return message.error(t('请完成邮件服务配置'));
    }
    store.loading = true;
    http.post('/api/setting/', {data: [{key: 'mail_service', value: formData}]})
      .then(() => {
        message.success(t('保存成功'));
        store.fetchSettings()
      })
      .finally(() => store.loading = false)
  }

  return (
    <React.Fragment>
      <div className={styles.title}>{t('报警服务设置')}</div>
      <div style={{maxWidth: 340}}>
        <Form.Item label={t('邮件服务')} labelCol={{span: 24}} style={{marginTop: 12}} extra={t('用于通过邮件方式发送报警信息')}>
          <Form form={form} initialValues={setting} labelCol={{span: 7}} wrapperCol={{span: 17}}>
            <Form.Item required name="server" label={t('邮件服务器')}>
              <Input placeholder={t('例如：smtp.exmail.qq.com')}/>
            </Form.Item>
            <Form.Item required name="port" label={t('端口')}>
              <Input placeholder={t('例如：465')}/>
            </Form.Item>
            <Form.Item required name="username" label={t('邮箱账号')}>
              <Input placeholder={t('例如：dev@exmail.com')}/>
            </Form.Item>
            <Form.Item required name="password" label={t('密码/授权码')}>
              <Input.Password placeholder={t('请输入对应的密码或授权码')}/>
            </Form.Item>
            <Form.Item name="nickname" label={t('发件人昵称')}>
              <Input placeholder={t('请输入发件人昵称')}/>
            </Form.Item>
          </Form>
        </Form.Item>
        <Space style={{marginTop: 24}}>
          <Button type="danger" loading={loading} onClick={handleEmailTest}>{t('测试邮件服务')}</Button>
          <Button type="primary" loading={store.loading} onClick={handleSubmit}>{t('保存设置')}</Button>
        </Space>
      </div>
    </React.Fragment>
  )
})
