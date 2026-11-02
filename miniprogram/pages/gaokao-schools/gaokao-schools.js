const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

const SORTS = [
  { id: 'rank', name: '按排名' },
  { id: 'line-desc', name: '分数线从高到低' },
  { id: 'line-asc', name: '分数线从低到高' }
];

Page({
  data: {
    tab: 'library',
    ready: false,
    provinces: [],
    provinceIndex: 0,
    province: '黑龙江',
    years: [],
    yearIndex: 0,
    year: 2025,
    tiers: ['不限'],
    tierIndex: 0,
    types: ['不限'],
    typeIndex: 0,
    sorts: SORTS.map(s => s.name),
    sortIndex: 0,
    q: '',
    library: { items: [], page: 1, pages: 1, total: 0, loading: false },
    wishlist: [],
    wishLoaded: false,
    logged: false
  },

  onLoad() {
    this.setData({ logged: !!api.token() });
    api.gaokao.meta().then(res => {
      if (!res.ok) { ui.fail(res, '加载失败'); return; }
      const meta = res.data || {};
      const provinces = (meta.provinces || []).map(p => p.name);
      const provinceIndex = Math.max(0, provinces.indexOf('黑龙江'));
      const years = (meta.years || []).slice().reverse();
      this.meta = meta;
      this.setData({
        ready: true,
        provinces,
        provinceIndex,
        province: provinces[provinceIndex] || '黑龙江',
        years,
        year: years[0] || 2025,
        yearIndex: 0,
        tiers: ['不限', ...(meta.tiers || [])],
        types: ['不限', ...(meta.types || [])]
      });
      this.loadLibrary(true);
    });
  },

  onShow() {
    this.setData({ logged: !!api.token() });
    if (this.data.tab === 'wish' && api.token()) this.loadWishlist();
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab });
    if (tab === 'wish') {
      if (api.token()) this.loadWishlist();
      else this.setData({ wishlist: [] });
    }
  },

  onProvince(e) {
    const index = Number(e.detail.value);
    this.setData({ provinceIndex: index, province: this.data.provinces[index] || '黑龙江' });
    this.loadLibrary(true);
  },

  onYear(e) {
    const index = Number(e.detail.value);
    this.setData({ yearIndex: index, year: this.data.years[index] });
    this.loadLibrary(true);
  },

  onTier(e) {
    this.setData({ tierIndex: Number(e.detail.value) });
    this.loadLibrary(true);
  },

  onType(e) {
    this.setData({ typeIndex: Number(e.detail.value) });
    this.loadLibrary(true);
  },

  onSort(e) {
    this.setData({ sortIndex: Number(e.detail.value) });
    this.loadLibrary(true);
  },

  onKeyword(e) { this.setData({ q: e.detail.value }); },
  onSearch() { this.loadLibrary(true); },

  tierValue() { return this.data.tierIndex === 0 ? '' : this.data.tiers[this.data.tierIndex]; },
  typeValue() { return this.data.typeIndex === 0 ? '' : this.data.types[this.data.typeIndex]; },

  /* ---------- 院校库 ---------- */
  loadLibrary(reset) {
    const lib = this.data.library;
    if (lib.loading) return;
    const page = reset ? 1 : lib.page + 1;
    if (!reset && page > lib.pages) return;
    this.setData({ 'library.loading': true });
    api.gaokao.universities({
      q: this.data.q,
      tier: this.tierValue(),
      type: this.typeValue(),
      sort: SORTS[this.data.sortIndex].id,
      page,
      size: 20,
      scoreProvince: this.data.province,
      year: this.data.year
    }).then(res => {
      this.setData({ 'library.loading': false });
      if (!res.ok) { ui.fail(res, '院校加载失败'); return; }
      const data = res.data || {};
      const rows = (data.items || []).map(logic.universityView);
      this.setData({
        library: {
          items: reset ? rows : lib.items.concat(rows),
          page: data.page || page,
          pages: data.pages || 1,
          total: data.total || rows.length,
          loading: false
        }
      });
    });
  },

  onReachBottom() {
    if (this.data.tab === 'library') this.loadLibrary(false);
  },

  openUni(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/gaokao-detail/gaokao-detail?id=' + encodeURIComponent(id) +
        '&province=' + encodeURIComponent(this.data.province) +
        '&year=' + this.data.year
    });
  },

  /* ---------- 志愿表 ---------- */
  loadWishlist() {
    api.lists.admissionGet().then(res => {
      if (!res.ok) { ui.fail(res, '志愿表加载失败'); return; }
      this.setData({ wishlist: (res.data || []).map(logic.admissionRowView), wishLoaded: true });
    });
  },

  addWish(e) {
    if (!api.token()) {
      wx.showModal({
        title: '需要登录',
        content: '登录后可以把院校加入志愿表，随时对照调整。',
        confirmText: '去登录',
        success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/login/login' }); }
      });
      return;
    }
    const row = this.data.library.items[Number(e.currentTarget.dataset.index)];
    if (!row || !row.id) return;
    const rows = this.data.wishlist.slice();
    if (rows.some(item => item.id === row.id)) { ui.toast('已在志愿表中'); return; }
    if (rows.length >= 60) { ui.toast('志愿表最多 60 条'); return; }
    rows.push({
      key: row.id + '|', id: row.id, name: row.name, major: '',
      line: row.line, probability: '', note: ''
    });
    this.saveWishlist(rows, '已加入志愿表');
  },

  removeWish(e) {
    const rows = this.data.wishlist.slice();
    rows.splice(Number(e.currentTarget.dataset.index), 1);
    this.saveWishlist(rows, '已移出志愿表');
  },

  updateNote(e) {
    const rows = this.data.wishlist.slice();
    if (!rows[Number(e.currentTarget.dataset.index)]) return;
    rows[Number(e.currentTarget.dataset.index)].note = e.detail.value;
    this.setData({ wishlist: rows });
  },

  saveNotes() {
    if (!this.data.wishlist.length) return;
    this.saveWishlist(this.data.wishlist, '');
  },

  saveWishlist(rows, message) {
    const payload = rows.map(r => ({
      id: r.id, name: r.name, major: r.major || '',
      line: r.line === '' ? null : r.line,
      probability: r.probability === '' ? null : r.probability,
      note: r.note || ''
    }));
    api.lists.admissionSave(payload).then(res => {
      if (!res.ok) { ui.fail(res, '保存失败'); return; }
      this.setData({ wishlist: (res.data || []).map(logic.admissionRowView) });
      if (message) ui.toast(message);
    });
  },

  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); }
});
