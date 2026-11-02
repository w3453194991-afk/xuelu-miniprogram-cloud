const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const fmt = require('../../utils/format.js');

const TOKEN_KEY = 'xuelu.cloud.adminToken';

Page({
  data: {
    token: '',
    authed: false,
    loading: false,
    tab: 'apps',
    apps: [],
    orders: [],
    stats: { orders: 0, paid: 0, pendingScan: 0, pendingApps: 0 },
    openApp: ''
  },

  onLoad() {
    let saved = '';
    try { saved = wx.getStorageSync(TOKEN_KEY) || ''; } catch (e) { saved = ''; }
    if (saved) {
      this.setData({ token: saved });
      this.loadAll();
    }
  },

  onToken(e) { this.setData({ token: e.detail.value }); },

  saveToken() {
    const token = this.data.token.trim();
    if (!token) { ui.toast('请输入管理令牌'); return; }
    try { wx.setStorageSync(TOKEN_KEY, token); } catch (e) { /* 存储不可用时仅本次有效 */ }
    this.loadAll();
  },

  loadAll() {
    const token = this.data.token.trim();
    if (!token) return;
    this.setData({ loading: true });
    Promise.all([api.applications.list(token), api.orders.adminList(token)]).then(([appRes, orderRes]) => {
      this.setData({ loading: false });
      if (!appRes.ok) {
        this.setData({ authed: false });
        ui.fail(appRes, '令牌无效或权限不足');
        return;
      }
      const apps = (appRes.data || []).map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        phone: row.phone,
        audienceText: row.type === '机构'
          ? (Array.isArray(row.audience) && row.audience.length ? row.audience.join(' / ') : '家长')
          : '',
        contact: row.contact || '',
        education: row.education || '',
        school: row.school || '',
        grade: row.grade || '',
        subjects: row.subjects || '',
        resume: row.resume || '',
        routeName: row.routeName || '',
        startPoint: row.startPoint || '',
        endPoint: row.endPoint || '',
        stops: Array.isArray(row.stops) ? row.stops : [],
        status: row.status,
        statusText: fmt.applicationStatusText(row.status),
        createdAt: fmt.dateTime(row.createdAt)
      }));
      const orderRows = (orderRes && orderRes.ok && orderRes.data) || [];
      const orders = orderRows.map(row => ({
        id: row.id,
        number: row.number,
        title: row.title,
        student: row.student,
        phone: row.phone,
        amount: row.amount,
        status: row.status,
        statusText: fmt.statusText(row.status),
        stage: fmt.statusTone(row.status),
        createdAt: fmt.dateTime(row.createdAt)
      }));
      const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'completed');
      this.setData({
        authed: true,
        apps,
        orders,
        stats: {
          orders: orders.length,
          paid: paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
          pendingScan: orders.filter(o => o.status === 'paid').length,
          pendingApps: apps.filter(a => a.status === 'pending').length
        }
      });
    });
  },

  onTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); },

  toggleApp(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ openApp: this.data.openApp === id ? '' : id });
  },

  approve(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '通过审核',
      content: '确认该入驻申请通过审核？通过后账号即可进入对应工作台。',
      success: r => {
        if (!r.confirm) return;
        api.applications.approve(id, this.data.token.trim()).then(res => {
          if (!res.ok) { ui.fail(res, '审核失败'); return; }
          ui.toast('已通过审核');
          this.loadAll();
        });
      }
    });
  },

  complete(e) {
    const id = e.currentTarget.dataset.id;
    api.orders.adminComplete(id, this.data.token.trim()).then(res => {
      if (!res.ok) { ui.fail(res, '核销失败'); return; }
      ui.toast('已核销');
      this.loadAll();
    });
  },

  callPhone(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone, fail: () => {} });
  }
});
