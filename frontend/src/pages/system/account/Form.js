/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState } from 'react';
import { observer } from 'mobx-react';
import { Modal, Form, Input, message } from 'antd';
import http from 'libs/http';
import { t } from 'libs';
import store from './store';


export default observer(function () {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  function handleSubmit() {
    setLoading(true);
    const formData = form.getFieldsValue();
    formData.id = store.record.id;
    http.post('/api/account/user/', formData)
      .then(() => {
        message.success(t('操作成功'));
        store.formVisible = false;
        store.fetchRecords()
      }, () => setLoading(false))
  }

  return (
    <Modal
      open
      width={700}
      maskClosable={false}
      title={store.record.id ? t('编辑账户') : t('新建账户')}
      onCancel={() => store.formVisible = false}
      confirmLoading={loading}
      onOk={handleSubmit}>
      <Form form={form} initialValues={store.record} labelCol={{span: 6}} wrapperCol={{span: 14}}>
        <Form.Item required name="username" label={t('登录名')}>
          <Input placeholder={t('请输入登录名')}/>
        </Form.Item>
        <Form.Item required name="nickname" label={t('姓名')}>
          <Input placeholder={t('请输入姓名')}/>
        </Form.Item>
        <Form.Item required hidden={store.record.id} name="password" label={t('密码')} extra={t('至少8位包含数字、小写和大写字母。')}>
          <Input.Password placeholder={t('请输入密码')}/>
        </Form.Item>
      </Form>
    </Modal>
  )
})
