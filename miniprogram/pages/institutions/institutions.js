const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');

Page({
  data: {
    loading: true,
    keyword: '',
    all: [],
    list: []
  },

  onShow() {
    this.load();
  },

  load() {
    api.institutions.list().then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '机构目录加载失败');
        return;
      }
      const rows = (res.data || []).map(item => ({
        id: item.id,
        name: item.name,
        intro: item.intro || '',
        address: item.address || '',
        contact: item.contact || '',
        phone: item.phone || '',
        courseCount: item.courseCount || 0
      }));
      this.setData({ loading: false, all: rows, list: rows });
    });
  },

  onKeyword(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.apply(keyword);
  },

  apply(keyword) {
    const word = String(keyword || '').trim();
    const all = this.data.all || [];
    this.setData({
      list: word
        ? all.filter(row => (row.name + row.intro + row.address).indexOf(word) >= 0)
        : all
    });
  },

  openMerchant(e) {
    wx.navigateTo({ url: '/pages/merchant/merchant?name=' + encodeURIComponent(e.currentTarget.dataset.name) });
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  }
});
