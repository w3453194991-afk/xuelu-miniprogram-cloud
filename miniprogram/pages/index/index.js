const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');

Page({
  data: {
    city: '哈尔滨',
    keyword: '',
    type: 'all',
    sub: 'all',
    types: [
      { id: 'all', name: '精选' },
      { id: 'course', name: '课程' },
      { id: 'tutor', name: '伴学' },
      { id: 'bus', name: '接送' }
    ],
    subTabs: [],
    subHint: '',
    featured: [],
    list: [],
    quick: [
      { key: 'learning', icon: '📖', name: '学习资源', desc: '考公 · 考研 · 考编 · 职考' },
      { key: 'gaokao', icon: '🎓', name: '升学规划', desc: '档案 · 曲线 · 选科 · 节点' },
      { key: 'transport', icon: '🚕', name: '接送', desc: '固定线路 · 帮忙接 · 私家车' },
      { key: 'exam', icon: '📚', name: '公考研训', desc: '岗位库 · 进面线 · 备考' },
      { key: 'zk', icon: '🔨', name: '职考技能', desc: '教师资格 · 会计 · 社工' },
      { key: 'tutor', icon: '🚐', name: '伴学服务', desc: '伴学老师 · 上门辅导' }
    ]
  },

  onShow() {
    this.refresh();
    const user = getApp().globalData.user;
    this.setData({ role: user ? user.role : '' });
    /* 助手等入口可带 Tab 意图（如课程推荐直达「课程」Tab） */
    const app = getApp();
    if (app && app.globalData.indexTab) {
      const tab = app.globalData.indexTab;
      app.globalData.indexTab = '';
      if (this.data.types.some(t => t.id === tab)) this.setData({ type: tab, sub: 'all' });
    }
  },

  refresh() {
    ui.loading();
    return api.services.list().then(res => {
      ui.hideLoading();
      if (!res.ok) { ui.fail(res, '目录加载失败'); return; }
      this.all = res.data;
      this.applyFilter();
    });
  },

  /* 列表统一加一层视图字段：校车补线路摘要，其余只补子分类名 */
  toRows(rows) {
    return (rows || []).map(item => {
      const view = logic.listView(item);
      view.section = logic.sectionOf(item);
      if (item.type === 'bus') {
        const detail = item.pickupDetail || item.busDetail || {};
        const routes = Array.isArray(detail.routes) ? detail.routes : [];
        const first = routes[0] || {};
        const last = routes[routes.length - 1] || {};
        view.routeText = first.name && last.name ? first.name + ' → ' + last.name : (item.location || '');
        view.stops = routes.length;
        view.timeText = first.departure && last.departure
          ? '早 ' + first.departure + ' · 晚 ' + last.departure
          : '';
        view.vehicle = detail.vehicle || '';
        if (item.pickupDetail) {
          view.school = item.pickupDetail.school || '';
          view.area = item.pickupDetail.area || '';
        }
      }
      return view;
    });
  },

  applyFilter() {
    const tab = this.data.type;
    /* 首页是公开目录：四个 Tab 已按业务线分开，不再按人群过滤，
       否则成人考证课（只对大学生开放）在「课程」里会整块消失 */
    const rows = logic.filterServices(this.all || [], {
      type: tab === 'all' ? '' : tab,
      keyword: this.data.keyword,
      audience: ''
    });
    const subTabs = logic.sectionsFor(tab);
    let sub = this.data.sub;
    if (sub !== 'all' && !subTabs.some(x => x.id === sub)) sub = 'all';
    const picked = subTabs.find(x => x.id === sub);

    if (tab === 'all') {
      const featured = logic.featuredGroups(rows, 2).filter(group => group.items.length);
      const list = [];
      featured.forEach(group => group.items.forEach(item => {
        if (!list.some(x => x.id === item.id)) list.push(item);
      }));
      this.setData({ featured, list, subTabs: [], sub: 'all', subHint: '' });
      return;
    }

    const sectionOf = tab === 'bus' ? logic.busSection : logic.sectionOf;
    const filtered = sub === 'all' ? rows : rows.filter(item => sectionOf(item) === sub);
    this.setData({
      subTabs,
      sub,
      subHint: picked ? picked.hint : '',
      list: this.toRows(filtered),
      featured: []
    });
  },

  onKeyword(e) { this.setData({ keyword: e.detail.value }); },
  onSearch() { this.applyFilter(); },
  onType(e) {
    this.setData({ type: e.currentTarget.dataset.type, sub: 'all' });
    this.applyFilter();
  },
  onSub(e) {
    this.setData({ sub: e.currentTarget.dataset.sub });
    this.applyFilter();
  },
  /* 精选里点「查看全部」跳到对应 Tab 与子分类 */
  openGroup(e) {
    const tab = e.currentTarget.dataset.tab;
    const sub = e.currentTarget.dataset.sub;
    this.setData({ type: tab, sub: sub || 'all' });
    this.applyFilter();
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) });
  },

  /* 六个入口：业务线并列，「接送」是独立板块页，点「伴学服务」在本页直接筛出伴学 */
  openQuick(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'tutor') { wx.navigateTo({ url: '/pages/service/service' }); return; }
    if (key === 'transport') { wx.navigateTo({ url: '/pages/transport/transport' }); return; }
    if (key === 'zk') {
      getApp().globalData.learningKind = 'zk';
      wx.switchTab({ url: '/pages/learning/learning' });
      return;
    }
    if (key === 'learning') { wx.switchTab({ url: '/pages/learning/learning' }); return; }
    if (key === 'gaokao') { wx.navigateTo({ url: '/pages/gaokao/gaokao' }); return; }
    if (key === 'exam') { wx.navigateTo({ url: '/pages/exam/exam' }); return; }
    if (key === 'institutions') { wx.navigateTo({ url: '/pages/institutions/institutions' }); return; }
  },

  openAssistant() { wx.navigateTo({ url: '/pages/assistant/assistant' }); },

  locate() {
    ui.loading('定位中');
    api.location.reverse(45.8038, 126.535).then(res => {
      ui.hideLoading();
      if (res.ok && res.data && res.data.city) {
        this.setData({ city: res.data.city });
        ui.toast('当前城市：' + res.data.city);
      } else {
        ui.fail(res, '定位失败，请手动选择城市');
      }
    });
  }
});
