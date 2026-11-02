const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

/* 各方向的一句说明，大学生与在职成人都能看懂 */
const KIND_TIPS = {
  gwy: '行测、申论、面试按模块开课，在职晚班与周末班可选',
  ky: '政治、英语、数学、专业课，按报考方向分班',
  sb: '公基、职测、综合应用，含面试模拟',
  zk: '面向大学生与在职成人，按证种分班：教师、财会、建工、社工、健康、人力、计算机等级',
  other: '机构开设的通识与技能类课程'
};

Page({
  data: {
    loading: true,
    kinds: [],
    kind: 'gwy',
    kindName: '',
    kindTip: '',
    subjects: [],
    subject: '全部',
    items: [],
    quick: [
      { page: '/pages/gaokao/gaokao', icon: '🎓', name: '升学规划', desc: '档案、曲线与关键节点' },
      { page: '/pages/exam/exam', icon: '📚', name: '公考研训', desc: '岗位库与进面线' },
      { page: '/pages/institutions/institutions', icon: '🏛️', name: '机构目录', desc: '本地机构与开设课程' }
    ]
  },

  onShow() {
    /* 首页「职考技能」入口会带一个默认分类过来 */
    const app = getApp();
    const pending = app.globalData.learningKind;
    if (pending) {
      app.globalData.learningKind = '';
      this.all = [];
      this.setData({ kind: pending, subject: '全部', items: [], loading: true });
    }
    this.load();
  },

  load() {
    if (!this.data.items.length) this.setData({ loading: true });
    api.learning.resources(this.data.kind, '').then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '学习资源加载失败');
        return;
      }
      const data = res.data || {};
      const kind = data.kind || 'gwy';
      this.all = (data.items || []).map(logic.learningItemView);
      this.setData({
        kinds: data.kinds || [],
        kind,
        kindName: data.kindName || '',
        kindTip: KIND_TIPS[kind] || '',
        subjects: data.subjects || [],
        loading: false
      });
      this.applySubject();
    });
  },

  onKind(e) {
    const kind = e.currentTarget.dataset.kind;
    if (kind === this.data.kind) return;
    this.setData({ kind, subject: '全部', items: [], loading: true });
    this.load();
  },

  onSubject(e) {
    this.setData({ subject: e.currentTarget.dataset.subject });
    this.applySubject();
  },

  applySubject() {
    const subject = this.data.subject;
    const all = this.all || [];
    this.setData({ items: subject === '全部' ? all : all.filter(row => row.subject === subject) });
  },

  openItem(e) {
    wx.navigateTo({
      url: '/pages/learning-detail/learning-detail?id=' + encodeURIComponent(e.currentTarget.dataset.id)
    });
  },

  openQuick(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.page });
  },

  onPullDownRefresh() {
    this.all = [];
    this.load();
    wx.stopPullDownRefresh();
  }
});
