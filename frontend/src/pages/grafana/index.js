/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { Alert, Button, Spin, Tabs } from 'antd';
import { FullscreenOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'components';
import { t } from 'libs';
import store from './store';
import { GRAFANA_INI } from './ini';
import styles from './index.module.less';

export default observer(function () {
  const [loading, setLoading] = useState(true);
  const frameWrap = useRef(null);

  useEffect(() => {
    store.fetch()
  }, []);

  const onFullscreen = () => {
    const node = frameWrap.current;
    if (!node) return;
    // 大屏场景常靠浏览器全屏去掉地址栏，requestFullscreen 需要用户手势，放在按钮里正合适
    if (document.fullscreenElement) document.exitFullscreen();
    else if (node.requestFullscreen) node.requestFullscreen();
  };

  const dashboards = store.dashboards;
  const hasContent = !!store.activeUrl;

  return (
    <div className={styles.page}>
      <Breadcrumb>
        <Breadcrumb.Item>{t('首页')}</Breadcrumb.Item>
        <Breadcrumb.Item>{t('监控大屏')}</Breadcrumb.Item>
      </Breadcrumb>

      {!store.isFetching && !store.url && (
        <Alert
          showIcon
          type="error"
          className={styles.alertWrap}
          message={t('尚未配置 Grafana 地址')}
          description={store.message || t('请在「系统管理 / 系统设置 / 监控大屏」中填写 Grafana 地址。')}/>
      )}

      {!!store.url && !!store.message && (
        <Alert
          showIcon
          type="error"
          className={styles.alertWrap}
          message={t('Grafana 不可用')}
          description={store.message}/>
      )}

      {!!store.url && !store.anonymous && !store.message && (
        <Alert
          showIcon
          type="warning"
          className={styles.alertWrap}
          message={t('Grafana 未开启匿名访问，看板在嵌入的窗口里会要求登录')}
          description={
            <div>
              <div>{t('iframe 无法携带 Grafana 的登录态，需要在 Grafana 侧放行匿名只读访问：')}</div>
              <pre className={styles.ini}>{GRAFANA_INI}</pre>
              <div>{t('改完重启 Grafana 容器即可，本页刷新后生效。')}</div>
            </div>
          }/>
      )}

      <div className={styles.tabsWrap}>
        <Tabs
          activeKey={store.activeKey}
          onChange={key => {
            setLoading(true);
            store.activeKey = key;
          }}
          items={dashboards.map(item => ({key: item.uid, label: item.title}))}
          tabBarExtraContent={
            <Button size="small" icon={<FullscreenOutlined/>} onClick={onFullscreen}>
              {t('全屏')}
            </Button>
          }/>
      </div>

      <div className={styles.frameWrap} ref={frameWrap}>
        {hasContent ? (
          <React.Fragment>
            {loading && (
              <div className={styles.mask}>
                <Spin size="large"/>
                <div className={styles.maskText}>{t('正在加载看板...')}</div>
              </div>
            )}
            <iframe
              key={store.activeKey}
              className={styles.frame}
              title={store.activeKey}
              src={store.activeUrl}
              onLoad={() => setLoading(false)}/>
          </React.Fragment>
        ) : (
          !store.isFetching && !!store.url && store.anonymous && (
            <div className={styles.empty}>
              <Alert
                showIcon
                type="info"
                message={t('Grafana 中还没有可展示的看板')}
                description={t('在 Grafana 里建好看板后回到本页重新加载即可；也可以在「系统管理 / 系统设置 / 监控大屏」里手工指定要显示的看板。')}/>
            </div>
          )
        )}
      </div>
    </div>
  )
})
