const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');

Page({
  data: {
    loading: true,
    about: null,
    contact: null,
    faq: [],
    categories: [],
    openIndex: -1
  },

  onLoad() {
    api.content.all().then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '帮助内容加载失败');
        return;
      }
      const d = res.data || {};
      this.setData({
        loading: false,
        about: d.about || null,
        contact: d.contact || null,
        faq: (d.faq || []).map((row, i) => ({ key: row.id || 'f' + i, category: row.category, question: row.question, answer: row.answer })),
        categories: d.categories || []
      });
    });
  },

  toggle(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ openIndex: this.data.openIndex === index ? -1 : index });
  },

  callPhone() {
    const phone = this.data.contact && this.data.contact.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone, fail: () => {} });
  },

  copyWechat() {
    const wechat = this.data.contact && this.data.contact.wechat;
    if (!wechat) return;
    wx.setClipboardData({ data: wechat, success: () => ui.toast('已复制微信号') });
  },

  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }); }
});
