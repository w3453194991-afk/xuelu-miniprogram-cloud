const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

Page({
  data: {
    view: null,
    kindName: '',
    subject: '',
    loading: true
  },

  onLoad(options) {
    this.serviceId = options.id ? decodeURIComponent(options.id) : '';
    this.kindName = options.kindName ? decodeURIComponent(options.kindName) : '';
    this.subject = options.subject ? decodeURIComponent(options.subject) : '';
  },

  onShow() {
    this.load();
  },

  load() {
    const cached = getApp().findService(this.serviceId);
    if (cached) {
      this.render(cached);
      return;
    }
    api.services.list().then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '课程加载失败');
        return;
      }
      getApp().cacheServices(res.data);
      const svc = getApp().findService(this.serviceId);
      if (!svc) {
        this.setData({ loading: false });
        ui.toast('课程不存在或已下架');
        setTimeout(() => wx.navigateBack(), 700);
        return;
      }
      this.render(svc);
    });
  },

  render(svc) {
    const view = logic.detailView(svc);
    const learning = svc.learning || {};
    const kinds = { gwy: '考公', ky: '考研', sb: '考编' };
    this.setData({
      view,
      kindName: this.kindName || kinds[learning.kind] || '',
      subject: this.subject || learning.subject || '',
      loading: false
    });
  },

  goBooking() {
    wx.navigateTo({ url: '/pages/booking/booking?id=' + encodeURIComponent(this.serviceId) });
  },

  goMerchant() {
    const view = this.data.view;
    if (!view || !view.merchant || !view.merchant.name) return;
    wx.navigateTo({ url: '/pages/merchant/merchant?name=' + encodeURIComponent(view.merchant.name) });
  },

  callPhone() {
    const phone = this.data.view && this.data.view.merchant && this.data.view.merchant.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone, fail: () => {} });
  },

  onShareAppMessage() {
    const view = this.data.view;
    return { title: view ? view.title : '学鹭伴学', path: '/pages/learning/learning' };
  }
});
