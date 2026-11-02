const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const fmt = require('../../utils/format.js');

const STAGES = ['早教', '幼儿园', '小学', '初中', '高中'];

Page({
  data: {
    user: null,
    roleName: '',
    profile: null,
    students: [],
    /* 学员编辑弹窗 */
    editing: null,
    editName: '',
    editAge: '',
    editGender: '未填写',
    editGuardian: '',
    editRelation: '家长',
    editPhone: '',
    editStage: '',
    stages: STAGES,
    showEdit: false,
    feedbackCount: 0
  },

  onShow() {
    const user = getApp().globalData.user;
    this.setData({
      user: user || null,
      roleName: user ? ui.roleName(user.role) : '游客'
    });
    if (user) this.loadProfile();
  },

  loadProfile() {
    api.profile.get().then(res => {
      if (!res.ok) { ui.fail(res, '档案加载失败'); return; }
      const p = res.data || {};
      this.setData({
        profile: p,
        students: Array.isArray(p.students) ? p.students : [],
        feedbackCount: p.feedback || 0
      });
    });
  },

  noop() {},

  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录，确认退出？',
      success: () => {
        api.auth.logout().catch(() => {});
        getApp().logoutLocal();
        this.setData({ user: null, roleName: '游客', profile: null, students: [] });
        ui.toast('已退出登录');
      }
    });
  },

  /* ---------- 学员编辑 ---------- */
  addStudent() {
    this.setData({
      showEdit: true,
      editing: null,
      editName: '', editAge: '', editGender: '未填写',
      editGuardian: '', editRelation: '家长', editPhone: '', editStage: ''
    });
  },

  editStudent(e) {
    const index = Number(e.currentTarget.dataset.index);
    const s = this.data.students[index];
    if (!s) return;
    this.setData({
      showEdit: true,
      editing: index,
      editName: s.name || '',
      editAge: s.age == null ? '' : String(s.age),
      editGender: s.gender || '未填写',
      editGuardian: s.guardian || '',
      editRelation: s.relation || '家长',
      editPhone: s.phone || '',
      editStage: s.stage || ''
    });
  },

  closeEdit() { this.setData({ showEdit: false }); },

  onEditField(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onEditGender(e) {
    this.setData({ editGender: ['男', '女', '未填写'][Number(e.detail.value)] || '未填写' });
  },

  onEditRelation(e) {
    this.setData({ editRelation: ['父亲', '母亲', '家长', '祖父母', '其他监护人'][Number(e.detail.value)] || '家长' });
  },

  onEditStage(e) {
    this.setData({ editStage: STAGES[Number(e.detail.value)] || '' });
  },

  saveStudent() {
    const name = this.data.editName.trim();
    if (!name) { ui.toast('请填写学员姓名'); return; }
    const item = {
      name,
      age: this.data.editAge ? Number(this.data.editAge) : null,
      gender: this.data.editGender,
      guardian: this.data.editGuardian.trim(),
      relation: this.data.editRelation,
      phone: this.data.editPhone.trim(),
      stage: this.data.editStage
    };
    const students = this.data.students.slice();
    if (this.data.editing === null || this.data.editing === undefined) {
      if (students.length >= 5) { ui.toast('最多添加 5 名学员'); return; }
      students.push(item);
    } else {
      students[this.data.editing] = item;
    }
    ui.loading('保存中');
    api.profile.update({ students }).then(res => {
      ui.hideLoading();
      if (!res.ok) { ui.fail(res, '保存失败'); return; }
      this.setData({ showEdit: false, students: res.data.students || [] });
      ui.toast('已保存');
    });
  },

  removeStudent(e) {
    const index = Number(e.currentTarget.dataset.index);
    const students = this.data.students.slice();
    students.splice(index, 1);
    ui.loading('保存中');
    api.profile.update({ students }).then(res => {
      ui.hideLoading();
      if (!res.ok) { ui.fail(res, '删除失败'); return; }
      this.setData({ students: res.data.students || [] });
      ui.toast('已删除');
    });
  },

  /* ---------- 入口 ---------- */
  goInstitution() { wx.navigateTo({ url: '/pages/institution/institution' }); },
  goInstitutions() { wx.navigateTo({ url: '/pages/institutions/institutions' }); },
  goJoin() { wx.navigateTo({ url: '/pages/join/join' }); },
  goCompanion() { wx.navigateTo({ url: '/pages/companion/companion' }); },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }); },
  goHelp() { wx.navigateTo({ url: '/pages/help/help' }); },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }); },
  openAssistant() { wx.navigateTo({ url: '/pages/assistant/assistant' }); },
  goLearning() { wx.switchTab({ url: '/pages/learning/learning' }); }
});
