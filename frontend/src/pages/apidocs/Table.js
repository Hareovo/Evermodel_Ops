/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { observer } from 'mobx-react';
import { Tag, Space, Tooltip, Button } from 'antd';
import { CopyOutlined, KeyOutlined } from '@ant-design/icons';
import { TableCard, TokenModal } from 'components';
import { t, copyText } from 'libs';
import store, { METHOD_COLOR } from './store';
import Detail from './Detail';

@observer
class ComTable extends React.Component {
  state = {tokenVisible: false, current: null};

  componentDidMount() {
    store.fetchRecords()
  }

  columns = [{
    title: t('方法'),
    width: 132,
    dataIndex: 'methods',
    render: methods => (
      <Space size={4} wrap>
        {methods.map(x => <Tag key={x} color={METHOD_COLOR[x]}>{x}</Tag>)}
      </Space>
    )
  }, {
    title: t('接口路径'),
    width: 380,
    dataIndex: 'path',
    render: path => (
      <span style={{fontFamily: 'Menlo, Consolas, monospace'}}>
        {path}
        <Tooltip title={t('复制路径')}>
          <CopyOutlined
            style={{marginLeft: 8, color: '#8c8c8c', cursor: 'pointer'}}
            onClick={e => {
              e.stopPropagation();
              copyText(path)
            }}/>
        </Tooltip>
      </span>
    )
  }, {
    title: t('分组'),
    width: 110,
    dataIndex: 'group_name',
    render: name => <Tag>{t(name)}</Tag>
  }, {
    title: t('处理器'),
    ellipsis: true,
    dataIndex: 'handler',
    render: handler => <span style={{color: '#8c8c8c'}}>{handler}</span>
  }, {
    title: t('认证'),
    width: 100,
    dataIndex: 'auth',
    render: auth => auth
      ? <Tag color="orange">{t('需登录')}</Tag>
      : <Tag color="default">{t('公开')}</Tag>
  }, {
    title: t('操作'),
    width: 110,
    render: (_, record) => (
      <Button type="link" size="small" style={{padding: 0}} onClick={e => {
        e.stopPropagation();
        this.setState({current: record})
      }}>{t('使用说明')}</Button>
    )
  }];

  render() {
    return (
      <React.Fragment>
        <TableCard
          tKey="ad"
          title={t('接口清单')}
          loading={store.isFetching}
          dataSource={store.dataSource}
          onReload={store.fetchRecords}
          rowKey={record => `${record.path}#${record.name}`}
          onRow={record => ({
            onClick: () => this.setState({current: record}),
            style: {cursor: 'pointer'}
          })}
          actions={[
            <span key="total" style={{color: '#8c8c8c'}}>{t('共 {} 个接口', store.dataSource.length)}</span>,
            <Button
              key="token"
              size="small"
              icon={<KeyOutlined/>}
              onClick={() => this.setState({tokenVisible: true})}>
              {t('我的 Token')}
            </Button>,
            <Button
              key="copy"
              size="small"
              icon={<CopyOutlined/>}
              onClick={() => copyText(store.dataSource.map(x => x.path).join('\n'), t('已复制全部接口路径'))}>
              {t('复制全部路径')}
            </Button>
          ]}
          pagination={{
            showSizeChanger: true,
            showLessItems: true,
            showTotal: total => t('共 {} 条', total),
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          columns={this.columns}/>
        <Detail record={this.state.current} onClose={() => this.setState({current: null})}/>
        <TokenModal
          visible={this.state.tokenVisible}
          onClose={() => this.setState({tokenVisible: false})}/>
      </React.Fragment>
    )
  }
}

export default ComTable
