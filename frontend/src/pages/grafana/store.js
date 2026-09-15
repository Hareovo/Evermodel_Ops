/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed } from 'mobx';
import { http } from 'libs';

class Store {
  @observable isFetching = false;
  @observable url = '';
  @observable anonymous = false;
  @observable message = '';
  @observable dashboards = [];

  @observable activeKey = '';

  fetch = () => {
    this.isFetching = true;
    http.get('/api/setting/grafana/')
      .then(res => {
        this.url = res.url || '';
        this.anonymous = !!res.anonymous;
        this.message = res.message || '';
        this.dashboards = res.dashboards || [];
        if (!this.activeKey || !this.dashboards.some(x => x.uid === this.activeKey)) {
          this.activeKey = this.dashboards.length ? this.dashboards[0].uid : ''
        }
      })
      .finally(() => this.isFetching = false)
  };

  // kiosk 隐藏 Grafana 自身的导航栏/侧边栏。
  // 页面上原先的深/浅色开关、刷新频率、重新加载三个控件已去掉，所以这里不再有可变状态：
  // theme 固定 light（与后台主题一致），要换配色直接改下面的字面量；
  // 不传 refresh 参数即「不自动刷新」，看板是否自刷由 Grafana 看板自身的配置决定。
  @computed get activeUrl() {
    const current = this.dashboards.find(x => x.uid === this.activeKey);
    if (!this.url || !current) return '';
    // hideLogo=1：Grafana 12.4 起 kiosk 模式会在视口底部叠一条「Powered by Grafana」白底署名，
    // 它会盖住该位置上面板的标题（看板看起来像丢了一行文字）。这个参数是官方给的关闭开关；
    // 低版本 Grafana 不认这个参数、会直接忽略，所以无需判断版本。
    const params = ['kiosk', 'hideLogo=1', 'theme=light'];
    const sep = current.path.includes('?') ? '&' : '?';
    return `${this.url}${current.path}${sep}${params.join('&')}`
  }
}

export default new Store()
