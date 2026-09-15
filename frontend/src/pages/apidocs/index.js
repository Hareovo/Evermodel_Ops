/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { observer } from 'mobx-react';
import { Input, Select } from 'antd';
import { Breadcrumb, SearchForm } from 'components';
import { t } from 'libs';
import ComTable from './Table';
import store, { METHODS } from './store';

export default observer(function () {
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>{t('首页')}</Breadcrumb.Item>
        <Breadcrumb.Item>{t('接口文档')}</Breadcrumb.Item>
      </Breadcrumb>
      <SearchForm gutter={16}>
        <SearchForm.Item span={8} title={t('关键字')}>
          <Input
            allowClear
            value={store.f_keyword}
            placeholder={t('请输入接口路径、名称或处理器')}
            onChange={e => store.f_keyword = e.target.value}/>
        </SearchForm.Item>
        <SearchForm.Item span={8} title={t('分组')}>
          <Select
            allowClear
            style={{width: '100%'}}
            value={store.f_group || undefined}
            placeholder={t('全部')}
            onChange={value => store.f_group = value || ''}>
            {store.groups.map(item => (
              <Select.Option key={item.value} value={item.value}>{t(item.label)}</Select.Option>
            ))}
          </Select>
        </SearchForm.Item>
        <SearchForm.Item span={8} title={t('请求方法')}>
          <Select
            allowClear
            style={{width: '100%'}}
            value={store.f_method || undefined}
            placeholder={t('全部')}
            onChange={value => store.f_method = value || ''}>
            {METHODS.map(item => <Select.Option key={item} value={item}>{item}</Select.Option>)}
          </Select>
        </SearchForm.Item>
      </SearchForm>
      <ComTable/>
    </div>
  )
})
