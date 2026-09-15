/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import { observable, computed } from 'mobx';
import { http } from 'libs';

// 刷新频率选项，值是直接透传给 Grafana 的 refresh 参数
export const REFRESH_OPTIONS = [
  {value: '', label: '不自动刷新'},
  {value: '30s', label: '30 秒'},
  {value: '1m', label: '1 分钟'},
  {value: '5m', label: '5 分钟'},
  {value: '15m', label: '15 分钟'},
];

class Store {
  @observable isFetching = false;
  @observable url = '';
  @observable anonymous = false;
  @observable message = '';
  @observable dashboards = [];

  @observable activeKey = '';
  @observable theme = 'light';
  @observable refresh = '';
  // 自增即触发 iframe 重新加载：每次点击「重新加载」+1，避免直接改 src 被浏览器缓存
  @observable reloadToken = 0;

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

  // kiosk 隐藏 Grafana 自身的导航栏/侧边栏，theme 跟随这里的深浅色开关
  @computed get activeUrl() {
    const current = this.dashboards.find(x => x.uid === this.activeKey);
    if (!this.url || !current) return '';
    // hideLogo=1：Grafana 12.4 起 kiosk 模式会在视口底部叠一条「Powered by Grafana」白底署名，
    // 它会盖住该位置上面板的标题（看板看起来像丢了一行文字）。这个参数是官方给的关闭开关；
    // 低版本 Grafana 不认这个参数、会直接忽略，所以无需判断版本。
    const params = ['kiosk', 'hideLogo=1', `theme=${this.theme}`];
    if (this.refresh) params.push(`refresh=${this.refresh}`);
    const sep = current.path.includes('?') ? '&' : '?';
    return `${this.url}${current.path}${sep}${params.join('&')}`
  }
}

export default new Store()
