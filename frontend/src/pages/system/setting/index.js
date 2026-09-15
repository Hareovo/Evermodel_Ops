/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { Menu } from 'antd';
import { Breadcrumb } from 'components';
import { t } from 'libs';
import AlarmSetting from './AlarmSetting';
import GrafanaSetting from './GrafanaSetting';
import KeySetting from './KeySetting';
import SecuritySetting from './SecuritySetting';
import styles from './index.module.css';
import store from './store';


class Index extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedKeys: ['security']
    }
  }

  componentDidMount() {
    store.fetchSettings()
  }

  render() {
    const {selectedKeys} = this.state;
    return (
      <div>
        <Breadcrumb>
          <Breadcrumb.Item>{t('首页')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('系统管理')}</Breadcrumb.Item>
          <Breadcrumb.Item>{t('系统设置')}</Breadcrumb.Item>
        </Breadcrumb>
        <div className={styles.container}>
          <div className={styles.left}>
            <Menu
              mode="inline"
              selectedKeys={selectedKeys}
              style={{border: 'none'}}
              onSelect={({selectedKeys}) => this.setState({selectedKeys})}
              items={[
                {key: 'security', label: t('安全设置')},
                {key: 'key', label: t('密钥设置')},
                {key: 'alarm', label: t('报警服务设置')},
                {key: 'grafana', label: t('监控大屏')}
              ]}/>
          </div>
          <div className={styles.right}>
            {selectedKeys[0] === 'security' && <SecuritySetting/>}
            {selectedKeys[0] === 'alarm' && <AlarmSetting/>}
            {selectedKeys[0] === 'key' && <KeySetting/>}
            {selectedKeys[0] === 'grafana' && <GrafanaSetting/>}
          </div>
        </div>
      </div>
    )
  }
}

export default Index
