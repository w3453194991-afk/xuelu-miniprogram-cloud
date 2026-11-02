const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

Page({
  data: {
    tabs: logic.BUS_SECTIONS,
    active: 'route',
    hint: '',
    rows: [],
    safety: [
      { icon: '🪪', text: '实名核验 · 无犯罪记录承诺' },
      { icon: '🧒', text: '私家车车主须同时接送自家孩子' },
      { icon: '💺', text: '乘车系好安全带，配儿童安全座椅' },
      { icon: '📍', text: '只在学校与住址两点往返，不绕路不停留' }
    ]
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    ui.loading();
    return api.services.list().then(res => {
      ui.hideLoading();
      if (!res.ok) { ui.fail(res, '接送服务加载失败'); return; }
      this.all = (res.data || []).filter(item => item.type === 'bus');
      this.applyTab();
    });
  },

  applyTab() {
    const active = this.data.active;
    const sectionOf = logic.busSection;
    const rows = this.all
      .filter(item => sectionOf(item) === active)
      .map(item => {
        const view = logic.listView(item);
        const detail = item.pickupDetail || item.busDetail || {};
        const routes = Array.isArray(detail.routes) ? detail.routes : [];
        const first = routes[0] || {};
        const last = routes[routes.length - 1] || {};
        view.routeText = first.name && last.name ? first.name + ' → ' + last.name : (item.location || '');
        view.timeText = first.departure && last.departure
          ? '早 ' + first.departure + ' · 晚 ' + last.departure
          : (detail.timeText || '');
        return view;
      });
    const picked = this.data.tabs.find(t => t.id === active);
    this.setData({ rows, hint: picked ? picked.hint : '' });
  },

  onTab(e) {
    this.setData({ active: e.currentTarget.dataset.id });
    this.applyTab();
  },

  openDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) });
  },

  /* 私家车入驻：必须是同时接送自家孩子的家长 */
  goJoin() { wx.navigateTo({ url: '/pages/join/join?type=driver' }); }
});
