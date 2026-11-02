const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

const FILTERS = [
  { id: 'all', name: '全部' },
  { id: 'pending', name: '待支付' },
  { id: 'paid', name: '已支付' },
  { id: 'completed', name: '已完成' },
  { id: 'cancelled', name: '已取消' }
];

Page({
  data: {
    filters: FILTERS,
    filter: 'all',
    list: [],
    stats: null,
    loading: true
  },

  onShow() {
    if (!api.token()) {
      this.setData({ loading: false, list: [], stats: null, guest: true });
      return;
    }
    this.setData({ guest: false });
    this.refresh();
  },

  refresh() {
    ui.loading();
    return api.orders.list().then(res => {
      ui.hideLoading();
      this.setData({ loading: false });
      if (!res.ok) { ui.fail(res, '订单加载失败'); return; }
      const all = res.data || [];
      this.all = all;
      this.setData({ stats: logic.orderStats(all) });
      this.applyFilter();
    });
  },

  applyFilter() {
    const rows = (this.all || []).filter(o => this.data.filter === 'all' || o.status === this.data.filter);
    const services = getApp().globalData.services || [];
    this.setData({ list: rows.map(o => logic.orderView(o, services)) });
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.id });
    this.applyFilter();
  },

  pay(e) {
    const id = e.currentTarget.dataset.id;
    const order = (this.all || []).find(o => o.id === id);
    if (!order) return;
    wx.showModal({
      title: '确认支付',
      content: '订单金额 ¥' + order.amount + '，支付后将生成服务核销码。',
      confirmText: '支付',
      success: () => {
        ui.loading('支付中');
        api.orders.pay(id).then(res => {
          ui.hideLoading();
          if (!res.ok) { ui.fail(res, '支付失败'); return; }
          wx.showToast({ title: '支付成功', icon: 'success' });
          this.refresh();
        });
      }
    });
  },

  cancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '取消后该订单不可恢复，确认取消？',
      confirmText: '取消订单',
      success: () => {
        ui.loading('处理中');
        api.orders.cancel(id).then(res => {
          ui.hideLoading();
          if (!res.ok) { ui.fail(res, '取消失败'); return; }
          ui.toast('订单已取消');
          this.refresh();
        });
      }
    });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
