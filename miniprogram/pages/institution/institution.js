const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const fmt = require('../../utils/format.js');

const LEARNING = [
  { id: '', name: '不设置', subjects: [] },
  { id: 'gwy', name: '考公', subjects: ['行政职业能力测验', '申论', '面试'] },
  { id: 'ky', name: '考研', subjects: ['政治', '英语', '数学', '专业课'] },
  { id: 'sb', name: '考编', subjects: ['公共基础知识', '职业能力测验', '综合应用能力', '面试'] },
  { id: 'zk', name: '职考技能', subjects: ['教师资格', '会计实务', '建筑工程', '社会工作', '健康管理', '人力资源', '计算机等级'] }
];

const emptyPackage = () => ({ name: '', price: '', lessons: '', description: '', videoUrl: '' });

/* 服务人群：可多选，默认家长；决定课程进家长课程页还是大学生学习资源页 */
const AUDIENCE_OPTIONS = [
  { value: '家长', hint: '课程展示在家长课程页', on: true },
  { value: '大学生', hint: '课程展示在大学生学习资源页', on: false }
];
function audienceOptionsOf(picked) {
  const list = Array.isArray(picked) && picked.length ? picked : ['家长'];
  return AUDIENCE_OPTIONS.map(item => Object.assign({}, item, { on: list.includes(item.value) }));
}

Page({
  data: {
    ready: false,
    logged: false,
    isInstitution: false,
    status: '',
    statusText: '',
    org: null,
    courses: [],
    /* 机构资料编辑 */
    showOrg: false,
    orgForm: { intro: '', address: '', contact: '', phone: '' },
    orgAudience: audienceOptionsOf(['家长']),
    savingOrg: false,
    /* 课程编辑 */
    showForm: false,
    creating: true,
    saving: false,
    learningNames: LEARNING.map(item => item.name),
    learningKindIndex: 0,
    subjects: [],
    subjectIndex: 0,
    form: {
      id: '', title: '', category: '', price: '', unit: '课时', tag: '',
      description: '', location: '', remaining: '10',
      packages: [emptyPackage()]
    }
  },

  onShow() {
    const user = getApp().globalData.user;
    this.setData({ logged: !!user, isInstitution: !!user && user.role === 'institution' });
    if (!user || user.role !== 'institution') {
      this.setData({ ready: true });
      return;
    }
    this.loadAll();
  },

  loadAll() {
    Promise.all([api.applications.mine(), api.institutions.list()]).then(([appRes, orgRes]) => {
      const appList = (appRes.ok && appRes.data) || [];
      const latest = appList[0] || null;
      this.approved = !!(latest && latest.status === 'approved');
      const orgList = (orgRes.ok && orgRes.data) || [];
      const org = orgList[0] || null;
      this.setData({
        ready: true,
        status: latest ? latest.status : '',
        statusText: latest ? fmt.applicationStatusText(latest.status) : '未提交',
        org: org || null,
        orgAudience: audienceOptionsOf(org && org.audience),
        orgForm: org ? {
          intro: org.intro || '',
          address: org.address || '',
          contact: org.contact || '',
          phone: org.phone || ''
        } : this.data.orgForm
      });
      if (this.approved) this.loadCourses();
    });
  },

  loadCourses() {
    const org = this.data.org;
    if (!org) return;
    api.services.list().then(res => {
      if (!res.ok) { ui.fail(res, '课程加载失败'); return; }
      getApp().cacheServices(res.data);
      const rows = (res.data || []).filter(item => item.merchant === org.name && item.type === 'course');
      this.setData({
        courses: rows.map(item => ({
          id: item.id,
          title: item.title,
          category: item.category || '',
          price: item.price,
          unit: item.unit || '',
          remaining: item.remaining,
          packageCount: Array.isArray(item.packages) ? item.packages.length : 0,
          learning: item.learning || null,
          learningName: (() => {
            if (!item.learning) return '';
            const found = LEARNING.find(l => l.id === item.learning.kind);
            return found ? found.name + ' · ' + item.learning.subject : '';
          })()
        }))
      });
    });
  },

  noop() {},

  goJoin() { wx.navigateTo({ url: '/pages/join/join' }); },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },

  /* ---------- 机构资料 ---------- */
  openOrg() {
    if (!this.data.org) return;
    this.setData({
      showOrg: true,
      orgAudience: audienceOptionsOf(this.data.org.audience)
    });
  },
  closeOrg() { this.setData({ showOrg: false }); },
  onOrgField(e) {
    this.setData({ ['orgForm.' + e.currentTarget.dataset.field]: e.detail.value });
  },
  toggleOrgAudience(e) {
    const value = e.currentTarget.dataset.value;
    const list = (this.data.orgAudience || []).map(item =>
      item.value === value ? Object.assign({}, item, { on: !item.on }) : item
    );
    this.setData({ orgAudience: list });
  },
  saveOrg() {
    const org = this.data.org;
    if (!org || this.data.savingOrg) return;
    const f = this.data.orgForm;
    const payload = {};
    for (const key of ['intro', 'address', 'contact', 'phone']) {
      const value = (f[key] || '').trim();
      if (value) payload[key] = value;
    }
    const audience = (this.data.orgAudience || []).filter(i => i.on).map(i => i.value);
    if (!audience.length) { ui.toast('请至少选择一个服务人群：家长 / 大学生'); return; }
    payload.audience = audience;
    this.setData({ savingOrg: true });
    api.institutions.update(org.id, payload).then(res => {
      this.setData({ savingOrg: false });
      if (!res.ok) { ui.fail(res, '保存失败'); return; }
      this.setData({ showOrg: false, org: res.data, orgAudience: audienceOptionsOf(res.data && res.data.audience) });
      ui.toast('机构资料已更新');
      getApp().globalData.services = [];
    });
  },

  /* ---------- 课程 ---------- */
  openCreate() {
    this.setData({
      showForm: true,
      creating: true,
      learningKindIndex: 0,
      subjects: [],
      subjectIndex: 0,
      form: {
        id: '', title: '', category: '', price: '', unit: '课时', tag: '',
        description: '', location: '', remaining: '10',
        packages: [emptyPackage()]
      }
    });
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const svc = (getApp().globalData.services || []).find(row => row.id === id);
    if (!svc) { ui.toast('课程资料已更新，请重新进入'); return; }
    const kindIndex = Math.max(0, LEARNING.findIndex(item => svc.learning && item.id === svc.learning.kind));
    const subjects = LEARNING[kindIndex].subjects;
    const subjectIndex = svc.learning ? Math.max(0, subjects.indexOf(svc.learning.subject)) : 0;
    this.setData({
      showForm: true,
      creating: false,
      learningKindIndex: kindIndex,
      subjects,
      subjectIndex,
      form: {
        id: svc.id,
        title: svc.title || '',
        category: svc.category || '',
        price: String(svc.price == null ? '' : svc.price),
        unit: svc.unit || '课时',
        tag: svc.tag || '',
        description: svc.description || '',
        location: svc.location || '',
        remaining: String(svc.remaining == null ? 10 : svc.remaining),
        packages: (svc.packages || []).map(p => ({
          id: p.id || '',
          name: p.name || '',
          price: String(p.price == null ? '' : p.price),
          lessons: String(p.lessons == null ? '' : p.lessons),
          description: p.description || '',
          videoUrl: p.videoUrl || ''
        }))
      }
    });
    if (!this.data.form.packages.length) this.setData({ 'form.packages': [emptyPackage()] });
  },

  closeForm() { this.setData({ showForm: false }); },

  onField(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value });
  },

  onLearningKind(e) {
    const index = Number(e.detail.value);
    const subjects = LEARNING[index].subjects;
    this.setData({ learningKindIndex: index, subjects, subjectIndex: 0 });
  },

  onSubject(e) { this.setData({ subjectIndex: Number(e.detail.value) }); },

  onPackageField(e) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    const packages = this.data.form.packages.slice();
    if (!packages[index]) return;
    packages[index][field] = e.detail.value;
    this.setData({ 'form.packages': packages });
  },

  addPackage() {
    const packages = this.data.form.packages.slice();
    if (packages.length >= 5) { ui.toast('最多 5 个套餐'); return; }
    packages.push(emptyPackage());
    this.setData({ 'form.packages': packages });
  },

  removePackage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const packages = this.data.form.packages.slice();
    packages.splice(index, 1);
    this.setData({ 'form.packages': packages.length ? packages : [emptyPackage()] });
  },

  saveCourse() {
    if (this.data.saving) return;
    const f = this.data.form;
    if (!f.title.trim()) { ui.toast('请填写课程名称'); return; }
    if (!f.category.trim()) { ui.toast('请填写课程分类'); return; }
    const price = Number(f.price);
    if (!Number.isFinite(price) || price <= 0) { ui.toast('请填写有效价格'); return; }
    if (!f.unit.trim()) { ui.toast('请填写计价单位'); return; }
    if (!f.description.trim()) { ui.toast('请填写课程介绍'); return; }

    const learning = LEARNING[this.data.learningKindIndex];
    const payload = {
      title: f.title.trim(),
      category: f.category.trim(),
      price,
      unit: f.unit.trim(),
      description: f.description.trim()
    };
    if (f.tag.trim()) payload.tag = f.tag.trim();
    if (f.location.trim()) payload.location = f.location.trim();
    if (f.remaining !== '' && Number.isInteger(Number(f.remaining))) payload.remaining = Number(f.remaining);
    if (learning.id) payload.learning = { kind: learning.id, subject: learning.subjects[this.data.subjectIndex] };
    else if (!this.data.creating) payload.learning = null;

    const filled = f.packages.filter(p => p.name.trim() || p.price || p.lessons);
    if (filled.length) {
      const packages = [];
      for (const row of filled) {
        const name = row.name.trim();
        const p = Number(row.price);
        const lessons = Number(row.lessons);
        if (!name) { ui.toast('请填写套餐名称'); return; }
        if (!Number.isFinite(p) || p <= 0) { ui.toast('套餐价格须大于 0'); return; }
        if (!Number.isInteger(lessons) || lessons < 1) { ui.toast('套餐课时须为正整数'); return; }
        const item = { name, price: p, lessons, description: row.description.trim() };
        if (row.id) item.id = row.id;
        if (row.videoUrl.trim()) item.videoUrl = row.videoUrl.trim();
        packages.push(item);
      }
      payload.packages = packages;
    } else if (!this.data.creating) {
      payload.packages = [];
    }

    this.setData({ saving: true });
    const req = this.data.creating
      ? api.services.create(Object.assign({ type: 'course' }, payload))
      : api.services.update(f.id, payload);
    req.then(res => {
      this.setData({ saving: false });
      if (!res.ok) { ui.fail(res, '保存失败'); return; }
      this.setData({ showForm: false });
      ui.toast(this.data.creating ? '课程已发布' : '课程已更新');
      getApp().globalData.services = [];
      this.loadCourses();
    });
  },

  previewCourse(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) });
  }
});
