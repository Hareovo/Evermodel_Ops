/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { observer } from 'mobx-react';
import { Input, Select } from 'antd';
import { SearchForm, Breadcrumb } from 'components';
import { t } from 'libs';
import ComTable from './Table';
import Info from './Info';
import Record from './Record';
import ComForm from './Form';
import store from './store';

export default observer(function () {
  return (
    <div>
      <Breadcrumb>
        <Breadcrumb.Item>{t('首页')}</Breadcrumb.Item>
        <Breadcrumb.Item>{t('任务计划')}</Breadcrumb.Item>
      </Breadcrumb>
      <SearchForm>
        <SearchForm.Item span={6} title={t('状态')}>
          <Select allowClear value={store.f_status} onChange={v => store.f_status = v} placeholder={t('请选择')}>
            <Select.Option value={-1}>{t('待调度')}</Select.Option>
            <Select.Option value={0}>{t('执行中')}</Select.Option>
            <Select.Option value={1}>{t('成功')}</Select.Option>
            <Select.Option value={2}>{t('失败')}</Select.Option>
          </Select>
        </SearchForm.Item>
        <SearchForm.Item span={6} title={t('类型')}>
          <Select allowClear value={store.f_type} onChange={v => store.f_type = v} placeholder={t('请选择')}>
            {store.types.map(item => (
              <Select.Option value={item} key={item}>{item}</Select.Option>
            ))}
          </Select>
        </SearchForm.Item>
        <SearchForm.Item span={6} title={t('名称')}>
          <Input allowClear value={store.f_name} onChange={e => store.f_name = e.target.value} placeholder={t('请输入')}/>
        </SearchForm.Item>
      </SearchForm>
      <ComTable/>
      {store.formVisible && <ComForm/>}
      {store.infoVisible && <Info/>}
      {store.recordVisible && <Record/>}
    </div>
  )
})
