/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { Drawer, Tag, Tabs, Table, Alert, Button, Space, Descriptions, Tooltip } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { t, copyText } from 'libs';
import { buildCurl } from './curl';
import { METHOD_COLOR, LOCATION_COLOR } from './store';

// 参数位置的中文名，取值与后端 apis.py 的 LOCATION_LABEL 对应
const LOCATION_LABEL = {
  path: 'URL 路径',
  query: 'Query 参数',
  body: 'JSON 请求体',
  form: '表单字段',
  file: '上传文件',
};

function CodeBlock({text}) {
  return (
    <pre style={{
      margin: 0,
      padding: '10px 12px',
      background: '#fafafa',
      border: '1px solid #f0f0f0',
      borderRadius: 2,
      fontFamily: 'Menlo, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.7,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all'
    }}>{text}</pre>
  )
}

function ParamsTable({params}) {
  const columns = [{
    title: t('参数名称'),
    width: 150,
    dataIndex: 'name',
    render: name => <span style={{fontFamily: 'Menlo, Consolas, monospace'}}>{name}</span>
  }, {
    title: t('位置'),
    width: 116,
    dataIndex: 'in',
    render: value => <Tag color={LOCATION_COLOR[value]}>{t(LOCATION_LABEL[value] || value)}</Tag>
  }, {
    title: t('类型'),
    width: 80,
    dataIndex: 'type',
    render: type => type || t('字符串')
  }, {
    title: t('必填'),
    width: 70,
    dataIndex: 'required',
    render: required => required
      ? <Tag color="red">{t('是')}</Tag>
      : <Tag>{t('否')}</Tag>
  }, {
    title: t('说明'),
    dataIndex: 'help',
    render: (help, record) => {
      // 校验器里的 help 常写成“参数错误”这类无信息量的兜底文案，此时按类型补一句
      const text = help && help !== '参数错误' ? help : '';
      if (text) return text;
      return record.required
        ? t('必填参数')
        : <span style={{color: '#bfbfbf'}}>{t('可选参数')}</span>
    }
  }, {
    title: t('示例值'),
    width: 150,
    dataIndex: 'sample',
    render: sample => {
      const text = sample === null || sample === undefined
        ? ''
        : (typeof sample === 'object' ? JSON.stringify(sample) : String(sample));
      return text === ''
        ? <span style={{color: '#bfbfbf'}}>-</span>
        : <span style={{fontFamily: 'Menlo, Consolas, monospace', color: '#8c8c8c'}}>{text}</span>
    }
  }];
  return (
    <Table
      size="small"
      rowKey={record => `${record.in}#${record.name}`}
      columns={columns}
      dataSource={params}
      pagination={false}/>
  )
}

function Endpoint({api, endpoint}) {
  const curl = buildCurl(api, endpoint);
  return (
    <div>
      <Space size={8} style={{marginBottom: 12}} wrap>
        <Tag color={METHOD_COLOR[endpoint.method]}>{endpoint.method}</Tag>
        {endpoint.content_type
          ? <Tag>{`Content-Type: ${endpoint.content_type}`}</Tag>
          : <span style={{color: '#8c8c8c'}}>{t('无请求体')}</span>}
        <span style={{color: '#8c8c8c'}}>
          {endpoint.params.length ? t('共 {} 个参数', endpoint.params.length) : t('无参数')}
        </span>
      </Space>
      {(endpoint.notes || []).map(note => (
        <Alert key={note} type="warning" showIcon message={note} style={{marginBottom: 12}}/>
      ))}
      {endpoint.params.length > 0 && (
        <div style={{marginBottom: 16}}>
          <div style={{marginBottom: 8, fontWeight: 500}}>{t('请求参数')}</div>
          <ParamsTable params={endpoint.params}/>
        </div>
      )}
      <div style={{marginBottom: 8, fontWeight: 500, display: 'flex', justifyContent: 'space-between'}}>
        <span>{t('示例命令')}</span>
        <Button
          type="link"
          size="small"
          style={{padding: 0, height: 'auto'}}
          icon={<CopyOutlined/>}
          onClick={() => copyText(curl, t('已复制示例命令'))}>{t('复制')}</Button>
      </div>
      <CodeBlock text={curl}/>
    </div>
  )
}

export default function Detail({record, onClose}) {
  const endpoints = (record && record.endpoints) || [];
  return (
    <Drawer
      width={900}
      visible={!!record}
      onClose={onClose}
      destroyOnClose
      title={record ? (
        <span style={{fontFamily: 'Menlo, Consolas, monospace', fontSize: 14}}>
          {(record.methods || []).map(x => <Tag key={x} color={METHOD_COLOR[x]}>{x}</Tag>)}
          {record.path}
        </span>
      ) : ''}>
      {record && (
        <React.Fragment>
          <Descriptions size="small" column={2} style={{marginBottom: 8}}>
            <Descriptions.Item label={t('分组')}>{t(record.group_name)}</Descriptions.Item>
            <Descriptions.Item label={t('认证')}>
              {record.auth
                ? <Tag color="orange">{t('需登录')}</Tag>
                : <Tag>{t('公开')}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label={t('处理器')} span={2}>
              <span style={{color: '#8c8c8c'}}>{record.handler}</span>
            </Descriptions.Item>
          </Descriptions>
          <Alert
            type="info"
            showIcon
            style={{marginBottom: 16}}
            message={t('请求头')}
            description={
              <div style={{fontSize: 12, lineHeight: 2}}>
                {record.auth && (
                  <div>
                    <code>X-Token: &lt;{t('你的 Token')}&gt;</code>
                    <span style={{marginLeft: 8, color: '#8c8c8c'}}>{t('身份凭证，公开接口以外必须携带')}</span>
                  </div>
                )}
                <div>
                  <code>X-Language: en</code>
                  <span style={{marginLeft: 8, color: '#8c8c8c'}}>{t('可选，需要英文返回时携带')}</span>
                </div>
                <div>
                  <code>{'Content-Type: application/json'}</code>
                  <span style={{marginLeft: 8, color: '#8c8c8c'}}>{t('可选，请求体为 JSON 时的默认方式')}</span>
                </div>
              </div>
            }/>
          {endpoints.length <= 1 ? (
            endpoints.map(x => <Endpoint key={x.method} api={record} endpoint={x}/>)
          ) : (
            <Tabs
              type="card"
              items={endpoints.map(x => ({
                key: x.method,
                label: <Tag color={METHOD_COLOR[x.method]}>{x.method}</Tag>,
                children: <Endpoint api={record} endpoint={x}/>
              }))}/>
          )}
          <div style={{marginTop: 16, color: '#8c8c8c', fontSize: 12}}>
            <Tooltip title={t('所有接口统一返回 {data, error} 结构')}>
              <span>{t('响应体：error 为空表示成功，业务数据在 data 中。')}</span>
            </Tooltip>
          </div>
        </React.Fragment>
      )}
    </Drawer>
  )
}
