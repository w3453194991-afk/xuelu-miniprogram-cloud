const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

const SORTS = [
  { id: 'line', name: '按分数线' },
  { id: 'ratio', name: '按竞争比' },
  { id: 'quota', name: '按招录人数' }
];

const BUCKETS = [
  { key: 'chong', name: '冲一冲' },
  { key: 'wen', name: '稳一稳' },
  { key: 'bao', name: '保一保' }
];

Page({
  data: {
    ready: false,
    tab: 'items',
    kinds: [],
    kind: 'gwy',
    kindMeta: null,
    regions: ['不限'],
    educations: ['不限'],
    categories: ['不限'],
    examTypes: ['不限'],
    regionIndex: 0,
    educationIndex: 0,
    categoryIndex: 0,
    examTypeIndex: 0,
    sorts: SORTS.map(s => s.name),
    sortIndex: 0,
    q: '',
    items: [],
    page: 1,
    pages: 1,
    total: 0,
    loading: false,
    scoreInput: '',
    match: { counts: null, groups: [] },
    matching: false,
    resources: null
  },

  onLoad() {
    api.exam.meta().then(res => {
      if (!res.ok) { ui.fail(res, '加载失败'); return; }
      const meta = res.data || {};
      this.meta = meta;
      const kinds = meta.kinds || [];
      this.setData({
        ready: true,
        kinds,
        kind: kinds[0] ? kinds[0].key : 'gwy',
        kindMeta: kinds[0] || null,
        regions: ['不限', ...(meta.regions || [])],
        educations: ['不限', ...(meta.educations || [])]
      });
      this.applyKindOptions();
      this.loadItems(true);
    });
  },

  applyKindOptions() {
    const meta = this.meta || {};
    const kind = this.data.kind;
    const categories = (meta.categories && meta.categories[kind]) || [];
    const examTypes = (meta.examTypes && meta.examTypes[kind]) || [];
    this.setData({
      categories: ['不限', ...categories],
      examTypes: ['不限', ...examTypes],
      categoryIndex: 0,
      examTypeIndex: 0,
      regionIndex: 0,
      educationIndex: 0
    });
  },

  onKind(e) {
    const kind = e.currentTarget.dataset.kind;
    if (kind === this.data.kind) return;
    const kindMeta = this.data.kinds.find(k => k.key === kind) || null;
    this.setData({ kind, kindMeta, items: [], match: { counts: null, groups: [] }, resources: null });
    this.applyKindOptions();
    this.loadItems(true);
    if (this.data.tab === 'data') this.loadResources();
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab });
    if (tab === 'data' && !this.data.resources) this.loadResources();
  },

  /* ---------- 筛选 ---------- */
  pickValue(list, index) { return index === 0 ? '' : list[index]; },

  onPicker(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: Number(e.detail.value) });
    if (field === 'sortIndex') this.loadItems(true);
  },

  onKeyword(e) { this.setData({ q: e.detail.value }); },

  onSearch() { this.loadItems(true); },

  /* ---------- 岗位列表 ---------- */
  loadItems(reset) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page + 1;
    if (!reset && page > this.data.pages) return;
    this.setData({ loading: true });
    api.exam.items({
      kind: this.data.kind,
      region: this.pickValue(this.data.regions, this.data.regionIndex),
      education: this.pickValue(this.data.educations, this.data.educationIndex),
      category: this.pickValue(this.data.categories, this.data.categoryIndex),
      examType: this.pickValue(this.data.examTypes, this.data.examTypeIndex),
      q: this.data.q,
      sort: SORTS[this.data.sortIndex].id,
      page,
      size: 12
    }).then(res => {
      this.setData({ loading: false });
      if (!res.ok) {
        if (reset) this.setData({ items: [] });
        ui.fail(res, '岗位加载失败');
        return;
      }
      const d = res.data || {};
      const rows = (d.items || []).map(logic.examItemView);
      this.setData({
        items: reset ? rows : this.data.items.concat(rows),
        page: d.page || page,
        pages: d.pages || 1,
        total: d.total || rows.length
      });
    });
  },

  onReachBottom() {
    if (this.data.tab === 'items') this.loadItems(false);
  },

  openItem(e) {
    wx.navigateTo({
      url: '/pages/exam-detail/exam-detail?kind=' + this.data.kind +
        '&id=' + encodeURIComponent(e.currentTarget.dataset.id)
    });
  },

  /* ---------- 匹配 ---------- */
  onScore(e) { this.setData({ scoreInput: e.detail.value }); },

  runMatch() {
    const full = this.data.kindMeta ? this.data.kindMeta.fullScore : 200;
    const score = Number(this.data.scoreInput);
    if (!this.data.scoreInput || !Number.isFinite(score) || score < 0 || score > full) {
      ui.toast('请输入 0–' + full + ' 之间的分数');
      return;
    }
    this.setData({ matching: true });
    api.exam.match({
      kind: this.data.kind,
      score,
      region: this.pickValue(this.data.regions, this.data.regionIndex),
      education: this.pickValue(this.data.educations, this.data.educationIndex),
      limit: 8
    }).then(res => {
      this.setData({ matching: false });
      if (!res.ok) { ui.fail(res, '匹配失败'); return; }
      const d = res.data || {};
      const buckets = d.buckets || {};
      const groups = BUCKETS.map(b => ({
        key: b.key,
        name: b.name,
        items: (buckets[b.key] || []).map(logic.examItemView)
      }));
      this.setData({ match: { counts: d.counts || null, groups } });
    });
  },

  /* ---------- 资料 ---------- */
  loadResources() {
    this.setData({ resources: null });
    api.exam.resources(this.data.kind, 0).then(res => {
      if (!res.ok) { ui.fail(res, '资料加载失败'); return; }
      const d = res.data || {};
      this.setData({
        resources: {
          orgs: d.orgs || [],
          courses: d.courses || [],
          books: d.books || []
        }
      });
    });
  }
});
