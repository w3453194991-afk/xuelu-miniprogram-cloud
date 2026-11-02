const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const fmt = require('../../utils/format.js');

Page({
  data: {
    logged: false,
    isTutor: false,
    loading: true,
    app: null,
    statusText: '',
    methods: []
  },

  onShow() {
    const user = getApp().globalData.user;
    if (!user) {
      this.setData({ logged: false, isTutor: false, loading: false });
      return;
    }
    this.setData({ logged: true, isTutor: user.role === 'tutor' });
    if (user.role !== 'tutor') {
      this.setData({ loading: false });
      return;
    }
    api.applications.mine().then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '资料加载失败');
        return;
      }
      const list = res.data || [];
      const latest = list.find(a => a.status === 'approved') || list[0] || null;
      this.setData({
        loading: false,
        app: latest,
        statusText: latest ? fmt.applicationStatusText(latest.status) : '',
        methods: latest && typeof latest.methods === 'string'
          ? latest.methods.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
          : []
      });
    });
  },

  goJoin() { wx.navigateTo({ url: '/pages/join/join' }); },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },

  openService(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) });
  }
});
