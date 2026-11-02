const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const fmt = require('../../utils/format.js');

Page({
  data: {
    loading: true,
    org: null
  },

  onLoad(options) {
    this.institutionId = options.id ? decodeURIComponent(options.id) : '';
    this.institutionName = options.name ? decodeURIComponent(options.name) : '';
    this.load();
  },

  load() {
    const query = this.institutionId ? { id: this.institutionId } : { name: this.institutionName };
    api.institutions.detail(query).then(res => {
      if (!res.ok) {
        this.setData({ loading: false, org: null });
        ui.fail(res, '机构资料加载失败');
        return;
      }
      const org = this.decorate(res.data || {});
      this.setData({ loading: false, org });
      if (org.name) wx.setNavigationBarTitle({ title: org.name });
    });
  },

  /* 模板里不能调用方法，金额与课程价格先在这里算好 */
  decorate(raw) {
    const org = raw || {};
    return Object.assign({}, org, {
      stats: org.stats || { courseCount: 0, teacherCount: 0, packageCount: 0 },
      courses: (org.courses || []).map(course => Object.assign({}, course, {
        priceText: fmt.money(course.price)
      }))
    });
  },

  openCourse(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) });
  },

  callPhone() {
    const phone = this.data.org && this.data.org.phone;
    if (!phone) { ui.toast('暂未公开联系电话'); return; }
    wx.makePhoneCall({ phoneNumber: phone, fail: () => {} });
  },

  copyAddress() {
    const address = this.data.org && this.data.org.address;
    if (!address) { ui.toast('暂未公开机构地址'); return; }
    wx.setClipboardData({ data: address, success: () => ui.toast('地址已复制') });
  },

  goDirectory() {
    wx.redirectTo({ url: '/pages/institutions/institutions' });
  },

  onShareAppMessage() {
    const org = this.data.org;
    if (!org) return { title: '学鹭伴学 · 机构目录', path: '/pages/institutions/institutions' };
    return {
      title: org.name + ' · 学鹭伴学机构主页',
      path: '/pages/merchant/merchant?id=' + encodeURIComponent(org.id)
    };
  }
});
