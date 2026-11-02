const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');

const TABS = [
  { key: 'profile', name: '学生档案' },
  { key: 'curve', name: '学业曲线' },
  { key: 'path', name: '路径规划' },
  { key: 'subjects', name: '选科建议' },
  { key: 'pathways', name: '多元升学' },
  { key: 'timeline', name: '关键节点' }
];

const STAGE_STATUS = { done: '已完成', current: '当前阶段', todo: '待开启' };
const PATHWAY_STATUS = {
  eligible: { text: '基本符合', tone: 'ok' },
  manual: { text: '需人工确认', tone: 'warn' },
  ineligible: { text: '暂不符合', tone: 'off' }
};

function today() {
  const d = new Date();
  const p = n => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
/* 一位小数，空值显示为「—」 */
function n1(v) {
  if (v === null || v === undefined || v === '') return '—';
  const num = Number(v);
  if (!Number.isFinite(num)) return '—';
  return Math.abs(num % 1) < 0.05 ? String(Math.round(num)) : num.toFixed(1);
}

Page({
  data: {
    tab: 'profile',
    tabs: TABS,
    loading: true,
    saving: false,
    error: '',
    disclaimer: '',
    profile: null,
    meta: { grades: [], provinces: [], firstSubjects: [], secondSubjects: [], tiers: [], interests: [] },
    gap: null,
    gapCards: [],
    stages: [],
    currentStage: '',
    stageNote: '',
    nodes: [],
    timelineMeta: { count: 0, passed: 0, from: '', to: '', note: '' },
    examStats: null,
    examRows: [],
    subject: null,
    comboRows: [],
    coverageText: '—',
    pathways: null,
    pathwayRows: [],
    profileForm: {
      grade: '高一',
      province: '浙江',
      provinceIndex: 0,
      first: '物理',
      second: [],
      targetTier: '本科',
      interest: []
    },
    examForm: { name: '', date: '', total: '' },
    pwForm: { grade: '', score: '', rank: '', award: '' },
    provinceTotal: 750,
    updatedText: ''
  },

  onLoad() {
    this.setData({ 'examForm.date': today() });
    this.load();
  },

  onShow() {
    if (!this.data.loading && this.data.profile) this.load(true);
  },

  onPullDownRefresh() {
    this.load(true);
    wx.stopPullDownRefresh();
  },

  /* ---------------- 读取 ---------------- */
  load(silent) {
    if (!silent) this.setData({ loading: true, error: '' });
    api.plan.overview().then(res => {
      if (!res.ok) {
        this.setData({ loading: false, error: res.error || '升学规划加载失败' });
        if (!silent) ui.fail(res, '升学规划加载失败');
        return;
      }
      this.apply(res.data || {});
    });
  },

  apply(data) {
    const profile = data.profile || {};
    const meta = data.meta || this.data.meta;
    const gap = data.gap || {};
    const provinces = meta.provinces || [];
    const provinceIndex = Math.max(0, provinces.indexOf(profile.province));
    const total = gap.total || 750;
    const nextScore = data.exams && data.exams.average !== null && data.exams.average !== undefined
      ? String(data.exams.average)
      : '';

    this.setData({
      loading: false,
      error: '',
      profile,
      meta,
      gap,
      gapCards: this.buildGapCards(gap),
      stages: this.buildStages(this.rawStages = data.stages || []),
      currentStage: data.currentStage || '',
      stageNote: data.stageNote || '',
      nodes: this.buildNodes(data.timeline || {}),
      timelineMeta: {
        count: data.timeline ? data.timeline.count : 0,
        passed: data.timeline ? data.timeline.passed : 0,
        from: data.timeline ? data.timeline.from : '',
        to: data.timeline ? data.timeline.to : '',
        note: data.timeline ? data.timeline.note : ''
      },
      examStats: data.exams || null,
      examRows: ((data.exams && data.exams.items) || []).slice().reverse(),
      subject: data.subjects || null,
      comboRows: this.buildCombos(data.subjects),
      coverageText: data.subjects ? n1(data.subjects.coverage) : '—',
      disclaimer: data.disclaimer || '',
      provinceTotal: total,
      updatedText: profile.updatedAt ? this.dateText(profile.updatedAt) : '',
      profileForm: {
        grade: profile.grade || '高一',
        province: profile.province || '浙江',
        provinceIndex,
        first: profile.first || '物理',
        second: (profile.second || []).slice(0, 2),
        targetTier: profile.targetTier || '本科',
        interest: (profile.interest || []).slice(0, 3)
      },
      'pwForm.score': nextScore || this.data.pwForm.score
    });
  },

  buildStages(stages) {
    const expanded = this.expanded || {};
    return stages.map(s => {
      const tasks = Array.isArray(s.tasks) ? s.tasks : [];
      const open = !!expanded[s.key];
      return {
        key: s.key,
        name: s.name,
        range: s.range,
        goal: s.goal,
        status: s.status,
        statusText: STAGE_STATUS[s.status] || s.status,
        tasks: open ? tasks : tasks.slice(0, 4),
        moreCount: tasks.length > 4 ? tasks.length - 4 : 0,
        expanded: open
      };
    });
  },

  toggleStage(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || !this.rawStages) return;
    this.expanded = this.expanded || {};
    this.expanded[key] = !this.expanded[key];
    this.setData({ stages: this.buildStages(this.rawStages) });
  },

  buildGapCards(gap) {
    const noScore = gap.avgScore === null || gap.avgScore === undefined;
    const noGap = gap.gap === null || gap.gap === undefined;
    return [
      { key: 'avg', label: '当前均分', value: n1(gap.avgScore), hint: noScore ? '先录入考试' : '最近 6 次均分', tone: '' },
      { key: 'line', label: '目标线', value: n1(gap.targetLine), hint: gap.targetTier ? ('目标 ' + gap.targetTier) : '目标层次未设置', tone: '' },
      {
        key: 'gap',
        label: '差距',
        value: noGap ? '—' : (gap.gap > 0 ? '+' + n1(gap.gap) : n1(gap.gap)),
        hint: noGap ? '先录入考试' : (gap.onTrack ? '已高于目标线' : '目标线 − 当前均分'),
        tone: noGap ? '' : (gap.gap > 0 ? 'neg' : 'pos')
      },
      {
        key: 'per',
        label: '每学期需提升',
        value: n1(gap.perSemester),
        hint: gap.semesters ? ('剩余约 ' + gap.monthsToMilestone + ' 个月 / ' + gap.semesters + ' 个学期') : '学期数待定',
        tone: ''
      }
    ];
  },

  buildNodes(timeline) {
    const rows = Array.isArray(timeline.nodes) ? timeline.nodes : [];
    return rows.map(n => ({
      date: n.date,
      name: n.name,
      detail: n.detail,
      type: n.type || 'other',
      grade: n.grade || '',
      passed: !!n.passed,
      daysText: n.passed ? '已过' : (n.daysUntil === 0 ? '就在今天' : ('还有 ' + n.daysUntil + ' 天'))
    }));
  },

  buildCombos(subject) {
    if (!subject || !Array.isArray(subject.combos)) return [];
    const current = subject.combination || '';
    return subject.combos.map(c => ({
      combination: c.combination,
      coverage: n1(c.coverage),
      allowed: c.allowed,
      total: c.total,
      rank: c.rank,
      current: c.combination === current
    }));
  },

  dateText(iso) {
    const s = String(iso || '');
    if (s.length < 10) return '';
    return s.slice(0, 10).replace(/-/g, '/');
  },

  /* ---------------- 切换板块 ---------------- */
  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab });
    if (tab === 'pathways' && !this.data.pathways) this.loadPathways();
  },

  /* ---------------- 学生档案 ---------------- */
  onGrade(e) {
    this.setData({ 'profileForm.grade': e.currentTarget.dataset.value });
  },

  onProvince(e) {
    const index = Number(e.detail.value);
    const name = this.data.meta.provinces[index] || this.data.profileForm.province;
    this.setData({ 'profileForm.provinceIndex': index, 'profileForm.province': name });
  },

  onFirst(e) {
    this.setData({ 'profileForm.first': e.currentTarget.dataset.value });
  },

  onSecond(e) {
    const value = e.currentTarget.dataset.value;
    const picked = (this.data.profileForm.second || []).slice();
    const at = picked.indexOf(value);
    if (at >= 0) picked.splice(at, 1);
    else if (picked.length < 2) picked.push(value);
    else { ui.toast('再选科目只能选 2 门'); return; }
    this.setData({ 'profileForm.second': picked });
  },

  onTier(e) {
    this.setData({ 'profileForm.targetTier': e.currentTarget.dataset.value });
  },

  onInterest(e) {
    const value = e.currentTarget.dataset.value;
    const picked = (this.data.profileForm.interest || []).slice();
    const at = picked.indexOf(value);
    if (at >= 0) picked.splice(at, 1);
    else if (picked.length < 3) picked.push(value);
    else { ui.toast('兴趣方向最多选 3 个'); return; }
    this.setData({ 'profileForm.interest': picked });
  },

  saveProfile() {
    if (this.data.saving) return;
    const form = this.data.profileForm;
    if ((form.second || []).length !== 2) { ui.toast('再选科目需选满 2 门'); return; }
    this.setData({ saving: true });
    api.plan.profileSave({
      grade: form.grade,
      province: form.province,
      first: form.first,
      second: form.second,
      targetTier: form.targetTier,
      interest: form.interest
    }).then(res => {
      this.setData({ saving: false });
      if (!res.ok) { ui.fail(res, '档案保存失败'); return; }
      ui.toast('档案已保存');
      this.load(true);
    });
  },

  /* ---------------- 学业曲线 ---------------- */
  onExamName(e) { this.setData({ 'examForm.name': e.detail.value }); },
  onExamDate(e) { this.setData({ 'examForm.date': e.detail.value }); },
  onExamTotal(e) { this.setData({ 'examForm.total': e.detail.value }); },

  addExam() {
    if (this.data.saving) return;
    const form = this.data.examForm;
    if (!form.name || !String(form.name).trim()) { ui.toast('请填写考试名称'); return; }
    const total = Number(form.total);
    if (!Number.isFinite(total) || total <= 0) { ui.toast('请填写有效总分'); return; }
    this.setData({ saving: true });
    api.plan.examAdd({ name: form.name, date: form.date || today(), total }).then(res => {
      this.setData({ saving: false });
      if (!res.ok) { ui.fail(res, '录入失败'); return; }
      ui.toast('已记录本次考试');
      this.setData({ examForm: { name: '', date: today(), total: '' } });
      this.load(true);
    });
  },

  removeExam(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除这条成绩',
      content: '删除后均分与差距会重新计算。',
      confirmText: '删除',
      success: r => {
        if (!r.confirm) return;
        api.plan.examRemove(id).then(res => {
          if (!res.ok) { ui.fail(res, '删除失败'); return; }
          ui.toast('已删除');
          this.load(true);
        });
      }
    });
  },

  /* ---------------- 多元升学 ---------------- */
  onPwGrade(e) {
    this.setData({ 'pwForm.grade': e.currentTarget.dataset.value || '' });
    this.loadPathways();
  },

  onPwScore(e) { this.setData({ 'pwForm.score': e.detail.value }); },
  onPwRank(e) { this.setData({ 'pwForm.rank': e.detail.value }); },
  onPwAward(e) { this.setData({ 'pwForm.award': e.detail.value }); },

  loadPathways() {
    const form = this.data.pwForm;
    api.plan.pathways({ grade: form.grade, score: form.score, rank: form.rank, award: form.award }).then(res => {
      if (!res.ok) { ui.fail(res, '自查失败'); return; }
      const data = res.data || {};
      this.setData({
        pathways: data,
        pathwayRows: (data.pathways || []).map(p => {
          const status = PATHWAY_STATUS[p.status] || { text: p.status, tone: 'off' };
          return {
            key: p.key,
            name: p.name,
            tag: p.tag,
            summary: p.summary,
            statusText: status.text,
            tone: status.tone,
            checks: (p.checks || []).map(c => ({
              item: c.item,
              required: c.required,
              actual: c.actual,
              pass: !!c.pass,
              optional: !!c.optional
            }))
          };
        })
      });
    });
  },

  /* ---------------- 跳转 ---------------- */
  openSchools() {
    wx.navigateTo({ url: '/pages/gaokao-schools/gaokao-schools' });
  }
});
