const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const fmt = require('../../utils/format.js');

const GENDERS = ['男', '女', '暂不填写'];
/* 服务人群：家长看课程页，大学生看学习资源页；默认勾选家长 */
const AUDIENCE_OPTIONS = [
  { value: '家长', hint: '课程展示在家长课程页', on: true },
  { value: '大学生', hint: '课程展示在大学生学习资源页', on: false }
];

Page({
  data: {
    logged: false,
    role: '',
    type: '',
    typeName: '',
    status: '',
    statusText: '',
    statusTone: '',
    submittedAt: '',
    form: {
      name: '',
      contact: '',
      phone: '',
      education: '',
      school: '',
      grade: '',
      subjects: '',
      major: '',
      resume: '',
      hourlyRate: '',
      gender: '暂不填写',
      photo: '',
      photoPreview: '',
      area: '',
      childGrade: '',
      vehicle: '',
      timeText: '',
      years: '',
      seat: ''
    },
    genders: GENDERS,
    genderIndex: 2,
    audienceOptions: AUDIENCE_OPTIONS.map(o => Object.assign({}, o)),
    safety: false,
    submitting: false,
    needLogin: false
  },

  /* 支持 ?type=driver 直接进入「私家车车主」入驻 */
  onLoad(query) {
    this.driverEntry = !!(query && query.type === 'driver');
  },

  onShow() {
    const user = getApp().globalData.user;
    if (!user) {
      this.setData({ logged: false, needLogin: true, status: '', statusText: '' });
      return;
    }
    if (this.driverEntry) {
      const form = Object.assign({}, this.data.form, { phone: user.phone || this.data.form.phone });
      this.setData({ logged: true, needLogin: false, role: user.role, type: '接送', typeName: '私家车车主', form });
      this.loadStatus();
      return;
    }
    const type = user.role === 'institution' ? '机构' : user.role === 'tutor' ? '伴学' : '';
    if (!type) {
      this.setData({
        logged: true,
        needLogin: false,
        role: user.role,
        type: '',
        typeName: '',
        statusText: ''
      });
      return;
    }
    const form = Object.assign({}, this.data.form, { phone: user.phone || this.data.form.phone });
    this.setData({ logged: true, needLogin: false, role: user.role, type, typeName: type, form });
    this.loadStatus();
  },

  loadStatus() {
    api.applications.mine().then(res => {
      if (!res.ok) return;
      const list = res.data || [];
      const latest = list[0];
      if (!latest) {
        this.setData({ status: '', statusText: '', statusTone: '' });
        return;
      }
      this.setData({
        status: latest.status,
        statusText: fmt.applicationStatusText(latest.status),
        statusTone: latest.status === 'approved' ? 'ok' : latest.status === 'pending' ? 'warn' : 'muted',
        submittedAt: fmt.dateTime(latest.createdAt)
      });
    });
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onGender(e) {
    const index = Number(e.detail.value);
    this.setData({ genderIndex: index, 'form.gender': GENDERS[index] || '暂不填写' });
  },

  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: res => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        wx.compressImage({
          src: file.tempFilePath,
          quality: 55,
          success: img => this.readPhoto(img.tempFilePath),
          fail: () => this.readPhoto(file.tempFilePath)
        });
      }
    });
  },

  readPhoto(path) {
    wx.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: res => {
        const data = 'data:image/jpeg;base64,' + res.data;
        if (data.length > 300000) {
          ui.toast('照片过大，请换一张或重新拍摄');
          return;
        }
        this.setData({ 'form.photo': data, 'form.photoPreview': path });
      },
      fail: () => ui.toast('照片读取失败，请重试')
    });
  },

  toggleAudience(e) {
    const value = e.currentTarget.dataset.value;
    const list = (this.data.audienceOptions || []).map(item =>
      item.value === value ? Object.assign({}, item, { on: !item.on }) : item
    );
    this.setData({ audienceOptions: list });
  },

  pickedAudience() {
    return (this.data.audienceOptions || []).filter(i => i.on).map(i => i.value);
  },

  toggleSafety() { this.setData({ safety: !this.data.safety }); },

  submit() {
    if (this.data.submitting) return;
    const f = this.data.form;
    const type = this.data.type;
    if (!type) { ui.toast('当前账号类型暂不支持入驻'); return; }
    if (!f.name.trim()) { ui.toast(type === '机构' ? '请填写机构名称' : '请填写姓名'); return; }
    if (!/^1\d{10}$/.test(f.phone.trim())) { ui.toast('请填写 11 位手机号'); return; }
    if (f.phone.trim() !== (getApp().globalData.user && getApp().globalData.user.phone)) {
      ui.toast('申请手机号须与账号手机号一致');
      return;
    }
    const payload = { type, name: f.name.trim(), phone: f.phone.trim() };
    if (type === '接送') {
      for (const [key, label] of [
        ['area', '接送区域'], ['school', '孩子就读学校'],
        ['childGrade', '自家孩子年级'], ['vehicle', '车型与安全配置'], ['timeText', '可接时段']
      ]) {
        if (!f[key].trim()) { ui.toast('请填写' + label); return; }
        if (f[key].trim().length > 100) { ui.toast(label + '过长'); return; }
        payload[key] = f[key].trim();
      }
      const seat = Number(f.seat);
      if (!Number.isInteger(seat) || seat < 1 || seat > 6) { ui.toast('可接孩子数须为 1–6 的整数'); return; }
      payload.seat = seat;
      const years = Number(f.years || 0);
      if (!Number.isInteger(years) || years < 0 || years > 60) { ui.toast('接送年数不正确'); return; }
      payload.years = years;
      if (!this.data.safety) { ui.toast('请先阅读并勾选安全承诺'); return; }
      payload.safety = true;
    } else if (type === '机构') {
      if (!f.contact.trim()) { ui.toast('请填写联系人'); return; }
      payload.contact = f.contact.trim();
      const audience = this.pickedAudience();
      if (!audience.length) { ui.toast('请至少选择一个服务人群：家长 / 大学生'); return; }
      payload.audience = audience;
    } else {
      for (const [key, label, max] of [['education', '学历', 100], ['school', '就读学校', 100], ['grade', '年级', 100], ['subjects', '伴学方向', 100]]) {
        if (!f[key].trim()) { ui.toast('请填写' + label); return; }
        if (f[key].trim().length > max) { ui.toast(label + '过长'); return; }
        payload[key] = f[key].trim();
      }
      if (!f.resume.trim()) { ui.toast('请填写简历'); return; }
      payload.resume = f.resume.trim();
      if (!/^\d{1,5}(\.\d{1,2})?$/.test(f.hourlyRate) || Number(f.hourlyRate) <= 0) {
        ui.toast('课时费须为 0.01–10000 元');
        return;
      }
      payload.hourlyRate = Number(f.hourlyRate);
      if (!f.photo) { ui.toast('请上传正脸照片'); return; }
      payload.photo = f.photo;
      if (f.gender && f.gender !== '暂不填写') payload.gender = f.gender;
      if (f.major.trim()) payload.major = f.major.trim();
    }
    this.setData({ submitting: true });
    api.applications.submit(payload).then(res => {
      this.setData({ submitting: false });
      if (!res.ok) { ui.fail(res, '提交失败'); return; }
      ui.toast('申请已提交');
      this.loadStatus();
      wx.showModal({
        title: '已提交',
        content: '平台会在审核后开通相应权限，你可以在本页查看进度。',
        showCancel: false
      });
    });
  },

  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },

  goWorkspace() { wx.navigateTo({ url: '/pages/institution/institution' }); },
  goCompanion() { wx.navigateTo({ url: '/pages/companion/companion' }); }
});
