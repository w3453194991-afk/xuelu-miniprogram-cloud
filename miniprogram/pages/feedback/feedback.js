const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const fmt = require('../../utils/format.js');

const CATEGORIES = ['课程', '伴学', '校车', '订单', '账号', '其他'];

Page({
  data: {
    categories: CATEGORIES,
    category: '其他',
    content: '',
    contact: '',
    orderNumber: '',
    rating: 0,
    stars: [1, 2, 3, 4, 5],
    submitting: false,
    list: [],
    logged: false,
    count: 0
  },

  onShow() {
    this.setData({ logged: !!api.token() });
    this.loadList();
  },

  loadList() {
    if (!api.token()) { this.setData({ list: [] }); return; }
    api.feedback.list().then(res => {
      if (!res.ok) return;
      const list = (res.data || []).map(row => ({
        id: row.id,
        category: row.category,
        content: row.content,
        rating: row.rating,
        reply: row.reply || '',
        statusText: row.status === 'replied' ? '已回复' : '已收到',
        createdAt: fmt.dateTime(row.createdAt)
      }));
      this.setData({ list, count: list.length });
    });
  },

  onCategory(e) {
    this.setData({ category: e.currentTarget.dataset.value });
  },

  onField(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onRating(e) {
    const value = Number(e.currentTarget.dataset.value);
    this.setData({ rating: this.data.rating === value ? 0 : value });
  },

  submit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    if (content.length < 5) { ui.toast('反馈内容请填写 5–500 字'); return; }
    const payload = {
      category: this.data.category,
      content,
      contact: this.data.contact.trim(),
      orderNumber: this.data.orderNumber.trim()
    };
    if (this.data.rating) payload.rating = this.data.rating;
    this.setData({ submitting: true });
    api.feedback.submit(payload).then(res => {
      this.setData({ submitting: false });
      if (!res.ok) { ui.fail(res, '提交失败'); return; }
      ui.toast('已提交，感谢你的反馈');
      this.setData({ content: '', orderNumber: '', rating: 0 });
      this.loadList();
    });
  },

  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); }
});
