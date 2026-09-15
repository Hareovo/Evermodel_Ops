/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * 监控大屏的配置入口。Grafana 地址/超时/看板白名单保存在 settings 表里，
 * 改完立即生效，不需要改代码或重启后端。
 */
import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { Alert, Button, Form, Input, InputNumber, Space, Tag, message } from 'antd';
import styles from './index.module.css';
import { http, t } from 'libs';
import { GRAFANA_INI } from 'pages/grafana/ini';
import store from './store';

export default observer(function () {
  const [form] = Form.useForm();
  const setting = store.settings.grafana || {};
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    form.setFieldsValue({
      url: setting.url || '',
      timeout: setting.timeout || 5,
      dashboards: setting.dashboards || '',
    })
  }, [setting.url, setting.timeout, setting.dashboards, form]);

  // 进页面就探一次，省的还要点一下才知道通没通
  useEffect(() => {
    handleTest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTest() {
    setTesting(true);
    http.get('/api/setting/grafana/')
      .then(res => setResult(res))
      .finally(() => setTesting(false))
  }

  function handleSubmit() {
    const {url, timeout, dashboards} = form.getFieldsValue();
    if (!url || !url.trim()) return message.error(t('请填写 Grafana 地址'));
    if (!/^https?:\/\//i.test(url.trim())) return message.error(t('地址需以 http:// 或 https:// 开头'));
    const value = {
      url: url.trim().replace(/\/+$/, ''),
      timeout: timeout || 5,
      dashboards: dashboards || '',
    };
    setSaving(true);
    http.post('/api/setting/', {data: [{key: 'grafana', value}]})
      .then(() => {
        message.success(t('保存成功'));
        form.setFieldsValue(value);
        store.fetchSettings();
        handleTest();
      })
      .finally(() => setSaving(false))
  }

  function renderResult() {
    if (!result) return null;
    if (!result.url) {
      return (
        <Alert
          showIcon
          type="warning"
          style={{marginTop: 16}}
          message={t('还没有填写 Grafana 地址')}
          description={t('填好上面的地址并保存后，这里会自动显示连接结果。')}/>
      )
    }
    if (result.message) {
      return (
        <Alert
          showIcon
          type="error"
          style={{marginTop: 16}}
          message={t('连接失败')}
          description={result.message}/>
      )
    }
    if (!result.anonymous) {
      return (
        <Alert
          showIcon
          type="warning"
          style={{marginTop: 16}}
          message={t('已连接，但 Grafana 未开启匿名访问')}
          description={
            <div>
              <div>{t('服务地址是通的，但看板在嵌入的窗口里会要求登录（iframe 带不上 Grafana 的登录态）。需要在 Grafana 侧放行匿名只读访问：')}</div>
              <pre className={styles.keyText} style={{margin: '8px 0'}}>{GRAFANA_INI}</pre>
              <div>{t('改完重启 Grafana 容器即可，不需要重启本平台。')}</div>
            </div>
          }/>
      )
    }
    return (
      <Alert
        showIcon
        type="success"
        style={{marginTop: 16}}
        message={t('连接正常，匿名只读已开启')}
        description={
          <div>
            <div>{t('共发现 {} 个看板，已自动铺成监控大屏顶部的标签页。', result.dashboards.length)}</div>
            {result.dashboards.length > 0 && (
              <div style={{marginTop: 8}}>
                <Space size={[8, 8]} wrap>
                  {result.dashboards.map(item => <Tag key={item.uid}>{item.title}</Tag>)}
                </Space>
              </div>
            )}
            <Button
              size="small"
              type="link"
              style={{paddingLeft: 0, marginTop: 4}}
              onClick={() => window.open('/grafana')}>
              {t('打开监控大屏')}
            </Button>
          </div>
        }/>
    )
  }

  return (
    <React.Fragment>
      <div className={styles.title}>{t('监控大屏')}</div>
      <div style={{maxWidth: 420}}>
        <Form layout="vertical" form={form}>
          <Form.Item
            required
            name="url"
            label={t('Grafana 地址')}
            extra={t('Grafana 站点根地址，不带结尾斜杠。注意这里填的地址是浏览器要访问的地址，iframe 是浏览器直连它的。')}>
            <Input placeholder="http://192.168.200.201:3000"/>
          </Form.Item>
          <Form.Item
            name="timeout"
            label={t('请求超时')}
            extra={t('后台探测 Grafana 的超时时间（秒），1 - 60。')}>
            <InputNumber min={1} max={60} style={{width: 120}}/>
          </Form.Item>
          <Form.Item
            name="dashboards"
            label={t('看板白名单')}
            extra={t('留空表示自动显示 Grafana 里的全部看板。每行一个，格式为「看板UID 显示名称」，名称可省略；列表里没出现的看板不会显示，顺序按这里的先后。')}>
            <Input.TextArea rows={4}/>
          </Form.Item>
        </Form>
        <Space style={{marginTop: 24}}>
          <Button loading={testing} onClick={handleTest}>{t('测试连接')}</Button>
          <Button type="primary" loading={saving} onClick={handleSubmit}>{t('保存设置')}</Button>
        </Space>
        {renderResult()}
      </div>
    </React.Fragment>
  )
})
