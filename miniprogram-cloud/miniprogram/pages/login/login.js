const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');

const ROLES = [
  { id: 'parent', name: '家长', desc: '找课程 / 伴学 / 校车' },
  { id: 'tutor', name: '大学生', desc: '伴学入驻 / 学习资源 / 备考' },
  { id: 'institution', name: '机构', desc: '发布课程与套餐' }
];

Page({
  data: {
    roles: ROLES,
    role: 'parent',
    mode: 'login',
    phone: '',
    password: '',
    submitting: false
  },

  onLoad() {
    const user = getApp().globalData.user;
    if (user) this.setData({ role: user.role });
  },

  switchRole(e) {
    this.setData({ role: e.currentTarget.dataset.id });
  },

  switchMode() {
    this.setData({ mode: this.data.mode === 'login' ? 'register' : 'login' });
  },

  onField(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  submit() {
    if (this.data.submitting) return;
    const phone = this.data.phone.trim();
    const password = this.data.password;
    if (!/^1\d{10}$/.test(phone)) { ui.toast('请填写 11 位手机号'); return; }
    if (this.data.mode === 'register' && (password.length < 8 || password.length > 128)) {
      ui.toast('密码长度须为 8–128 位');
      return;
    }
    if (this.data.mode === 'login' && !password) { ui.toast('请填写密码'); return; }
    this.setData({ submitting: true });
    const call = this.data.mode === 'login'
      ? api.auth.login(phone, password)
      : api.auth.register(phone, password, this.data.role);
    call.then(res => {
      this.setData({ submitting: false });
      if (!res.ok) { ui.fail(res, this.data.mode === 'login' ? '登录失败' : '注册失败'); return; }
      api.setToken(res.data.token);
      getApp().setSession(res.data.user);
      wx.showToast({ title: this.data.mode === 'login' ? '登录成功' : '注册成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    });
  },

  /* 微信一键登录：openid 已绑定账号时直接进入 */
  wxLogin() {
    ui.loading('登录中');
    api.auth.wxLogin().then(res => {
      ui.hideLoading();
      if (res.ok && res.data && res.data.authenticated && res.data.token) {
        api.setToken(res.data.token);
        getApp().setSession(res.data.user);
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
        return;
      }
      ui.toast('请先用手机号登录或注册');
    });
  }
});
