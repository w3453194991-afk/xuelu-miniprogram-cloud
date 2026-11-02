const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');

Page({
  data: {
    kind: 'gwy',
    loading: true,
    row: null,
    series: [],
    adding: false
  },

  onLoad(options) {
    this.kind = options.kind || 'gwy';
    this.itemId = options.id ? decodeURIComponent(options.id) : '';
    this.setData({ kind: this.kind });
    this.load();
  },

  load() {
    api.exam.detail(this.kind, this.itemId, 2025).then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '条目加载失败');
        return;
      }
      const d = res.data || {};
      this.setData({
        loading: false,
        row: {
          id: d.id, org: d.org, title: d.title, region: d.region, city: d.city,
          category: d.category, examType: d.examType, quota: d.quota,
          applicants: d.applicants, ratio: d.ratio, heat: d.heat, line: d.line,
          requirements: d.requirements || {},
          lineLabel: d.lineLabel || '分数线',
          unitLabel: d.unitLabel || '招录单位',
          quotaLabel: d.quotaLabel || '招录人数',
          applicantLabel: d.applicantLabel || '报名人数',
          fullScore: d.fullScore || 200
        },
        series: d.series || []
      });
    });
  },

  addToList() {
    const row = this.data.row;
    if (!row) return;
    if (!api.token()) {
      wx.showModal({
        title: '需要登录',
        content: '登录后可以保存报考清单。',
        confirmText: '去登录',
        success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/login/login' }); }
      });
      return;
    }
    this.setData({ adding: true });
    api.lists.examGet().then(res => {
      if (!res.ok) { this.setData({ adding: false }); ui.fail(res, '清单加载失败'); return; }
      const rows = (res.data || []).map(r => ({
        id: r.id, kind: r.kind || this.kind, org: r.org || '', title: r.title || '',
        line: r.line === undefined ? null : r.line, note: r.note || ''
      }));
      if (rows.some(r => r.id === row.id)) {
        this.setData({ adding: false });
        ui.toast('已在报考清单中');
        return;
      }
      if (rows.length >= 60) { this.setData({ adding: false }); ui.toast('清单最多 60 条'); return; }
      rows.push({ id: row.id, kind: this.kind, org: row.org, title: row.title, line: row.line, note: '' });
      api.lists.examSave(rows).then(save => {
        this.setData({ adding: false });
        if (!save.ok) { ui.fail(save, '保存失败'); return; }
        ui.toast('已加入报考清单');
      });
    });
  }
});
