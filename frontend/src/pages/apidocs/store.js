/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed } from 'mobx';
import { http, includes } from 'libs';

// 展示顺序固定，避免按字典序出现 DELETE/GET/PATCH/POST/PUT 这种反直觉排列
export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// 请求方法与参数位置的配色，列表与详情抽屉共用
export const METHOD_COLOR = {GET: 'blue', POST: 'green', PUT: 'gold', PATCH: 'orange', DELETE: 'red'};
export const LOCATION_COLOR = {path: 'purple', query: 'cyan', body: 'blue', form: 'geekblue', file: 'magenta'};

class Store {
  @observable records = [];
  @observable isFetching = false;

  @observable f_keyword = '';
  @observable f_group = '';
  @observable f_method = '';

  // 分组选项由后端返回的数据反推，新增 app 后无需改前端
  @computed get groups() {
    const seen = new Map();
    for (const item of this.records) {
      if (!seen.has(item.group)) seen.set(item.group, item.group_name)
    }
    return [...seen.entries()].map(([value, label]) => ({value, label}))
  }

  @computed get dataSource() {
    let records = this.records;
    if (this.f_group) records = records.filter(x => x.group === this.f_group);
    if (this.f_method) records = records.filter(x => x.methods.includes(this.f_method));
    if (this.f_keyword) records = records.filter(x => includes([x.path, x.name, x.handler], this.f_keyword));
    return records
  }

  fetchRecords = () => {
    this.isFetching = true;
    http.get('/api/setting/apis/')
      .then(res => this.records = res)
      .finally(() => this.isFetching = false)
  };
}

export default new Store()
