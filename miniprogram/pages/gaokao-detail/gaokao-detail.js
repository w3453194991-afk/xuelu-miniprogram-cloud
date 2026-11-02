const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');

Page({
  data: {
    tab: 'info',
    loading: true,
    uni: null,
    province: '黑龙江',
    year: 2025,
    majors: [],
    nationalLines: [],
    provinceLines: [],
    provinceRows: [],
    majorSeries: null,
    adding: false
  },

  onLoad(options) {
    this.uniId = options.id ? decodeURIComponent(options.id) : '';
    this.setData({
      province: options.province ? decodeURIComponent(options.province) : '黑龙江',
      year: Number(options.year) || 2025
    });
    this.load();
  },

  load() {
    api.gaokao.detail(this.uniId, this.data.province, this.data.year).then(res => {
      if (!res.ok) {
        this.setData({ loading: false });
        ui.fail(res, '院校资料加载失败');
        return;
      }
      const d = res.data || {};
      this.setData({
        loading: false,
        uni: {
          id: d.id,
          name: d.name,
          province: d.province,
          city: d.city,
          tier: d.tier,
          type: d.type,
          alliance: d.alliance || '',
          founded: d.founded,
          alumniRank: d.alumniRank,
          ruankeRank: d.ruankeRank,
          majorsCount: d.majorsCount,
          intro: d.intro || ''
        },
        majors: (d.majors || []).map((m, i) => ({
          key: m.name + '-' + i,
          name: m.name,
          category: m.category,
          heatText: Math.round((Number(m.heat) || 0) * 100) + '%',
          line: m.line,
          rank: m.rank,
          plan: m.plan,
          gap: m.gap,
          gapText: m.gap > 0 ? '高于校线 ' + m.gap : '低于校线 ' + Math.abs(m.gap)
        })),
        nationalLines: (d.lines && d.lines.national) || [],
        provinceLines: (d.lines && d.lines.provinceSeries) || [],
        provinceRows: (d.provinceLines && d.provinceLines.rows) || []
      });
    });
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab, majorSeries: null });
  },

  openMajor(e) {
    const name = e.currentTarget.dataset.name;
    ui.loading('加载专业趋势');
    api.gaokao.majorSeries(this.uniId, name, this.data.province).then(res => {
      ui.hideLoading();
      if (!res.ok) { ui.fail(res, '趋势加载失败'); return; }
      const d = res.data || {};
      this.setData({
        majorSeries: { name: d.major, series: d.series || [] },
        'uni.majorPick': d.major
      });
    });
  },

  closeMajor() { this.setData({ majorSeries: null }); },

  addWish() {
    if (!api.token()) {
      wx.showModal({
        title: '需要登录',
        content: '登录后可以把院校加入志愿表。',
        confirmText: '去登录',
        success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/login/login' }); }
      });
      return;
    }
    const uni = this.data.uni;
    if (!uni) return;
    this.setData({ adding: true });
    api.lists.admissionGet().then(res => {
      if (!res.ok) { this.setData({ adding: false }); ui.fail(res, '加载志愿表失败'); return; }
      const rows = (res.data || []).map(r => ({
        id: r.id, name: r.name, major: r.major || '',
        line: r.line === undefined ? null : r.line,
        probability: r.probability === undefined ? null : r.probability,
        note: r.note || ''
      }));
      if (rows.some(r => r.id === uni.id)) {
        this.setData({ adding: false });
        ui.toast('已在志愿表中');
        return;
      }
      const major = this.data.majorSeries ? this.data.majorSeries.name : '';
      rows.push({
        id: uni.id, name: uni.name, major,
        line: major && this.data.majorSeries.series.length
          ? this.data.majorSeries.series[this.data.majorSeries.series.length - 1].line
          : null,
        probability: null, note: ''
      });
      api.lists.admissionSave(rows).then(save => {
        this.setData({ adding: false });
        if (!save.ok) { ui.fail(save, '保存失败'); return; }
        ui.toast('已加入志愿表');
      });
    });
  },

  goWishlist() { wx.navigateTo({ url: '/pages/gaokao/gaokao' }); }
});
