const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

Page({
  data: {
    loading: true,
    tab: 'tutor',
    tabs: [
      { id: 'tutor', name: '伴学老师' },
      { id: 'bus', name: '安心校车' }
    ],
    tutors: [],
    buses: [],
    tip: ''
  },

  onShow() {
    this.load();
  },

  load() {
    if (!this.data.tutors.length && !this.data.buses.length) this.setData({ loading: true });
    api.services.list().then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '伴学服务加载失败');
        return;
      }
      getApp().cacheServices(res.data);
      const rows = Array.isArray(res.data) ? res.data : [];
      const view = list => list.map(item => {
        const slots = Array.isArray(item.calendar && item.calendar.slots) ? item.calendar.slots : [];
        return Object.assign(logic.listView(item), {
          description: item.description || '',
          slotText: slots.length ? slots.length + ' 个可约时段' : ''
        });
      });
      this.setData({
        loading: false,
        tutors: view(rows.filter(item => item.type === 'tutor')),
        buses: view(rows.filter(item => item.type === 'bus'))
      });
      this.syncTip();
    });
  },

  syncTip() {
    this.setData({
      tip: this.data.tab === 'tutor'
        ? '老师和家长互相选择：先看老师资料与可约时段，双方确认后再成单。'
        : '线路和上下车站点互相匹配：先选线路，再定上车点与下车点，按月订购。'
    });
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab });
    this.syncTip();
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) });
  },

  onPullDownRefresh() {
    this.setData({ tutors: [], buses: [] });
    this.load();
    wx.stopPullDownRefresh();
  }
});
