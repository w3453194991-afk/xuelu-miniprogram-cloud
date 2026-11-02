/* 页面运行时模拟：在 Node 里模拟小程序宿主，逐个执行页面的 onLoad/onShow
 * 目的：在没有 IDE 的情况下发现页面 JS 的运行时异常（白屏最常见的原因）
 */
const path = require('path');
const fs = require('fs');

const MP = path.join(__dirname, '..', 'miniprogram');
const PAGES = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8')).pages;

/* ---------------- 宿主环境模拟 ---------------- */
const storage = {};
const events = { toast: [], modal: [], nav: [] };
const noop = function () {};

const wxBase = {
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v; },
  removeStorageSync: k => { delete storage[k]; },
  getStorageInfoSync: () => ({ keys: Object.keys(storage), currentSize: 0, limitSize: 10240 }),
  clearStorageSync: () => { Object.keys(storage).forEach(k => delete storage[k]); },

  showToast: o => { events.toast.push((o && o.title) || ''); },
  hideToast: noop,
  showLoading: noop,
  hideLoading: noop,
  showModal: o => {
    events.modal.push((o && o.title) || '');
    if (o && o.success) o.success({ confirm: false, cancel: true });
  },
  showActionSheet: o => { if (o && o.fail) o.fail({ errMsg: 'cancel' }); },

  navigateTo: o => { events.nav.push(o && o.url); if (o && o.success) o.success(); },
  redirectTo: o => { events.nav.push(o && o.url); },
  switchTab: o => { events.nav.push(o && o.url); },
  reLaunch: o => { events.nav.push(o && o.url); },
  navigateBack: noop,

  setNavigationBarTitle: noop,
  setNavigationBarColor: noop,
  stopPullDownRefresh: noop,
  startPullDownRefresh: noop,
  pageScrollTo: noop,

  getSystemInfoSync: () => ({
    windowWidth: 375, windowHeight: 667, screenWidth: 375, screenHeight: 667,
    statusBarHeight: 20, safeArea: { top: 20, bottom: 667, left: 0, right: 375 },
    platform: 'devtools', system: 'iOS 15.0', SDKVersion: '3.5.0', pixelRatio: 2
  }),
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667, statusBarHeight: 20, pixelRatio: 2 }),
  getMenuButtonBoundingClientRect: () => ({ top: 24, bottom: 56, left: 281, width: 87, height: 32 }),

  createSelectorQuery: () => ({
    select: () => ({ boundingClientRect: () => ({ exec: cb => cb && cb([null]) }), fields: () => ({ exec: cb => cb && cb([null]) }) }),
    selectAll: () => ({ boundingClientRect: () => ({ exec: cb => cb && cb([]) }) }),
    selectViewport: () => ({ boundingClientRect: () => ({ exec: cb => cb && cb([null]) }) }),
    in: () => ({ select: () => ({ boundingClientRect: () => ({ exec: cb => cb && cb([null]) }) }) }),
    exec: cb => cb && cb([])
  }),

  getLocation: o => { if (o && o.success) o.success({ latitude: 45.8038, longitude: 126.535 }); },
  chooseImage: o => { if (o && o.success) o.success({ tempFilePaths: [] }); },
  previewImage: noop,
  makePhoneCall: noop,
  setClipboardData: o => { if (o && o.success) o.success(); },
  getClipboardData: o => { if (o && o.success) o.success({ data: '' }); },
  createAnimation: () => ({ step: () => ({ step: () => ({}) }), export: () => ({}) }),
  nextTick: cb => setTimeout(cb, 0),
  canIUse: () => true
};

global.wx = new Proxy(wxBase, {
  get(target, key) {
    if (key in target) return target[key];
    if (typeof key === 'string' && key.startsWith('on')) return noop;
    return noop;
  },
  has() { return true; }
});

/* ---------------- Page / App / Component ---------------- */
let capturedPage = null;
let appConfig = null;

global.Page = cfg => { capturedPage = cfg; };
global.App = cfg => { appConfig = cfg; };
global.Component = cfg => { capturedPage = cfg; };
global.getApp = () => appConfig;
global.getCurrentPages = () => [];

/* ---------------- 工具 ---------------- */
function setPath(obj, key, value) {
  const parts = String(key).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    if (cur[seg] === undefined || cur[seg] === null) cur[seg] = {};
    cur = cur[seg];
  }
  cur[parts[parts.length - 1]] = value;
}

function clone(obj) {
  return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
}

function instantiate(cfg, route) {
  const inst = {};
  for (const key of Object.keys(cfg)) {
    if (key === 'data') continue;
    inst[key] = cfg[key];
  }
  inst.data = clone(cfg.data) || {};
  inst.route = route;
  inst.setData = function (patch, cb) {
    if (patch && typeof patch === 'object') {
      for (const k of Object.keys(patch)) setPath(this.data, k, patch[k]);
    }
    if (typeof cb === 'function') cb();
  };
  inst.selectComponent = () => null;
  inst.selectAllComponents = () => [];
  inst.createSelectorQuery = wxBase.createSelectorQuery;
  inst.triggerEvent = noop;
  return inst;
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* 内容页的空数据检查（按各页真实的字段名） */
function emptyReport(route, d) {
  if (route === 'pages/index/index' && !(d.list && d.list.length)) return '服务列表为空';
  if (route === 'pages/index/index' && !(d.featured && d.featured.length === 4)) return '精选四条推荐线未生成';
  if (route === 'pages/learning/learning' && !(d.items && d.items.length)) return '学习资源为空';
  if (route === 'pages/institutions/institutions' && !(d.list && d.list.length)) return '机构列表为空';
  if (route === 'pages/detail/detail' && !d.view) return '详情视图未生成';
  if (route === 'pages/booking/booking' && !d.title) return '报名页未取到服务信息';
  /* 伴学页是「大学生入驻状态」页：家长登录时没有申请记录是正常的，只校验登录态 */
  if (route === 'pages/companion/companion' && d.logged !== true) return '未识别登录态';
  if (route === 'pages/learning-detail/learning-detail' && !d.view) return '学习详情未取到数据';
  /* 升学规划页默认停在「学生档案」，档案与六个板块由 overview 一次拿全 */
  if (route === 'pages/gaokao/gaokao' && !(d.tabs && d.tabs.length === 6)) return '六个板块未生成';
  if (route === 'pages/gaokao/gaokao' && !d.profileForm) return '学生档案未取到';
  if (route === 'pages/gaokao/gaokao' && !(d.stages && d.stages.length)) return '阶段任务为空';
  if (route === 'pages/gaokao/gaokao' && !(d.nodes && d.nodes.length)) return '关键节点为空';
  if (route === 'pages/gaokao-schools/gaokao-schools' && !(d.library && d.library.items.length)) return '院校库列表为空';
  if (route === 'pages/gaokao-detail/gaokao-detail' && !d.uni) return '院校详情为空';
  if (route === 'pages/exam/exam' && !(d.items && d.items.length)) return '备考岗位列表为空';
  if (route === 'pages/exam-detail/exam-detail' && !d.row) return '岗位详情为空';
  if (route === 'pages/merchant/merchant' && !d.org) return '机构主页为空';
  if (route === 'pages/merchant/merchant' && !(d.org.images && d.org.images.length)) return '机构主页缺少环境图';
  if (route === 'pages/merchant/merchant' && !(d.org.courses && d.org.courses.length)) return '机构主页缺少课程';
  if (route === 'pages/merchant/merchant' && !(d.org.teachers && d.org.teachers.length)) return '机构主页缺少教师介绍';
  if (route === 'pages/merchant/merchant' && !d.org.priceRangeText) return '机构主页缺少价格区间';
  return '';
}

function summary(route, d) {
  if (d.list) return '列表 ' + d.list.length + ' 条';
  if (d.items) return '条目 ' + d.items.length + ' 条';
  if (d.tabs && d.tabs.length === 6) return '六板块 · ' + (d.profileForm ? d.profileForm.grade : '') + ' ' + (d.stages || []).length + ' 阶段 ' + (d.nodes || []).length + ' 节点';
  if (d.library && d.library.items) return '院校库 ' + d.library.items.length + ' 所';
  if (d.ready) return '省份 ' + (d.provinces || []).length + ' 个';
  if (d.view) return '视图已生成';
  if (d.row) return '详情 ' + ((d.row && d.row.title) || '已生成');
  if (d.app) return '伴学 ' + ((d.app && d.app.title) || '已生成');
  if (d.uni) return '院校 ' + (d.uni.name || '');
  if (d.org) return '机构 ' + (d.org.name || '');
  if (d.title) return '服务 ' + d.title;
  return 'data 字段 ' + Object.keys(d).length;
}

/* 记录未捕获的 Promise 异常（页面 then 回调里抛错最常见） */
let currentRoute = '';
const unhandled = [];
process.on('unhandledRejection', reason => {
  const msg = reason && reason.stack ? reason.stack.split('\n').slice(0, 3).join(' | ') : String(reason);
  unhandled.push(currentRoute + '：' + msg);
});

/* ---------------- 主流程 ---------------- */
(async function main() {
  /* 启动 app */
  require(path.join(MP, 'app.js'));
  if (!appConfig) throw new Error('app.js 未调用 App()');
  const app = Object.assign({}, appConfig, appConfig.globalData ? { globalData: appConfig.globalData } : {});
  global.getApp = () => app;
  if (typeof app.onLaunch === 'function') {
    app.onLaunch.call(app, { path: PAGES[0], query: {} });
  }
  await wait(120);

  const api = require(path.join(MP, 'utils', 'api.js'));
  const mock = require(path.join(MP, 'utils', 'mock.js'));

  /* 以家长身份登录，带参数的页面（报名、伴学、订单）才有数据 */
  const reg = await api.auth.register('13800000009', 'password123', 'parent');
  if (reg.ok) {
    api.setToken(reg.data.token);
    api.setUser(reg.data.user);
    app.globalData.user = reg.data.user;
  } else {
    console.log('  ! 登录失败：' + reg.error);
  }

  /* 造一份真实数据，供带参数的页面使用 */
  const services = mock.handle('services', { action: 'list' }).data || [];
  const course = services.find(s => s.type === 'course') || services[0];
  const tutor = services.find(s => s.type === 'tutor') || services[0];
  const bus = services.find(s => s.type === 'bus') || services[0];
  const institutions = mock.handle('institutions', { action: 'list' }).data || [];
  const learning = mock.handle('learning', { action: 'resources', kind: 'ky' }).data;
  const learningItem = (learning.items || [])[0];
  const gaokaoList = mock.handle('gaokao', { action: 'universities', size: 1 }).data;
  const uni = (gaokaoList.items || [])[0];
  const examList = mock.handle('exam', { action: 'items', kind: 'gwy', size: 1 }).data;
  const examItem = (examList.items || [])[0];

  const optionsMap = {
    'pages/detail/detail': { id: course && course.id },
    'pages/booking/booking': { id: (tutor && tutor.id) || (course && course.id) },
    'pages/companion/companion': { id: (tutor && tutor.id) || (course && course.id) },
    'pages/learning-detail/learning-detail': { kind: 'ky', subject: learningItem && learningItem.subject, id: learningItem && learningItem.id },
    'pages/gaokao-detail/gaokao-detail': { id: uni && uni.id },
    'pages/exam-detail/exam-detail': { kind: 'gwy', id: examItem && examItem.id },
    'pages/merchant/merchant': { name: institutions[0] && institutions[0].name },
    'pages/mine/mine': {},
    'pages/orders/orders': {},
    'pages/institution/institution': {},
    'pages/admin/admin': {}
  };

  let pass = 0;
  const failures = [];

  for (const route of PAGES) {
    const file = path.join(MP, route + '.js');
    if (!fs.existsSync(file)) { failures.push(route + '：缺少 ' + route + '.js'); continue; }

    delete require.cache[require.resolve(file)];
    capturedPage = null;
    try {
      require(file);
    } catch (e) {
      failures.push(route + '：加载失败 ' + e.message);
      continue;
    }
    if (!capturedPage) { failures.push(route + '：未调用 Page()'); continue; }

    currentRoute = route;
    const inst = instantiate(capturedPage, route);
    const options = optionsMap[route] || {};
    try {
      if (typeof inst.onLoad === 'function') await inst.onLoad.call(inst, options);
      await wait(60);
      if (typeof inst.onShow === 'function') await inst.onShow.call(inst);
      await wait(90);
      if (typeof inst.onReady === 'function') await inst.onReady.call(inst);
      await wait(40);
      /* 首页：四个 Tab 与二级分类逐个点一遍 */
      if (route === 'pages/index/index' && typeof inst.onType === 'function') {
        const tab = id => ({ currentTarget: { dataset: { type: id } } });
        await inst.onType.call(inst, tab('course'));
        await wait(90);
        if (!(inst.data.subTabs && inst.data.subTabs.length === 4)) throw new Error('课程 Tab 应有 4 个子分类');
        await inst.onSub.call(inst, { currentTarget: { dataset: { sub: 'art' } } });
        await wait(60);
        if (!(inst.data.list && inst.data.list.length)) throw new Error('艺考课子分类为空');
        if (!inst.data.list.every(r => r.section === 'art')) throw new Error('艺考课筛选混入其他分类');

        await inst.onType.call(inst, tab('tutor'));
        await wait(90);
        if (!(inst.data.subTabs && inst.data.subTabs.length === 3)) throw new Error('伴学 Tab 应有 3 个子分类');
        for (const sub of ['tutor', 'read', 'home']) {
          await inst.onSub.call(inst, { currentTarget: { dataset: { sub } } });
          await wait(60);
          if (!(inst.data.list && inst.data.list.length)) throw new Error('伴学子分类 ' + sub + ' 为空');
        }

        await inst.onType.call(inst, tab('bus'));
        await wait(90);
        if (!(inst.data.list && inst.data.list.length)) throw new Error('校车列表为空');
        if (!inst.data.list.every(r => r.routeText && r.priceText)) throw new Error('校车卡片缺少线路摘要');

        await inst.onType.call(inst, tab('all'));
        await wait(90);
        if (!(inst.data.featured && inst.data.featured.length === 4)) throw new Error('回到精选后推荐线丢失');
      }
      /* 关键交互：升学规划切到「学业曲线」并录一次成绩，均分与差距要立刻变化 */
      if (route === 'pages/gaokao/gaokao' && typeof inst.onTab === 'function') {
        await inst.onTab.call(inst, { currentTarget: { dataset: { tab: 'curve' } } });
        await wait(120);
        if (!(inst.data.gapCards && inst.data.gapCards.length === 4)) throw new Error('学业曲线统计卡未生成');
        inst.setData({ examForm: { name: '模拟月考', date: '2026-11-10', total: '588' } });
        await inst.addExam.call(inst);
        await wait(260);
        if (!(inst.data.examsCount > 0 || (inst.data.examRows && inst.data.examRows.length))) {
          throw new Error('录入成绩后记录仍为空');
        }
      }
      /* 院校参考页：切到院校库触发列表加载 */
      if (route === 'pages/gaokao-schools/gaokao-schools' && typeof inst.onTab === 'function') {
        await inst.onTab.call(inst, { currentTarget: { dataset: { tab: 'library' } } });
        await wait(200);
        const lib = inst.data.library || {};
        if (!(lib.items && lib.items.length)) throw new Error('切换院校库后列表仍为空');
      }
      /* 伴学详情：换成伴学老师重新加载，学校 / 专业 / 星级都要在 */
      if (route === 'pages/detail/detail' && typeof inst.onLoad === 'function') {
        inst.onLoad.call(inst, { id: tutor.id });
        inst.onShow.call(inst);
        await wait(160);
        const v = inst.data.view || {};
        if (!v.tutor) throw new Error('伴学详情缺少老师资料');
        if (!(v.tutor.stars && v.tutor.stars.length === 5)) throw new Error('伴学详情缺少星级');
        if (!(v.tutor.school && v.tutor.major)) throw new Error('伴学详情缺少学校或专业');
        if (!v.tutor.intro) throw new Error('伴学详情缺少个人介绍');
      }
    } catch (e) {
      failures.push(route + '：' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
      continue;
    }

    /* 页面必须至少渲染出一些数据（除了纯表单页） */
    const keys = Object.keys(inst.data || {});
    if (keys.length === 0) { failures.push(route + '：data 为空'); continue; }
    /* 内容页必须真的取到数据 */
    const empty = emptyReport(route, inst.data);
    if (empty) {
      const async = unhandled.filter(u => u.startsWith(route + '：'));
      failures.push(route + '：' + empty + (async.length ? ' ← ' + async[0].split('：').slice(1).join('：') : '') + ' [data: ' + Object.keys(inst.data).join(',') + ']');
      continue;
    }
    pass++;
    console.log('  ✓ ' + route.padEnd(38) + ' ' + summary(route, inst.data));
  }

  console.log('\n页面运行时检查：' + pass + '/' + PAGES.length + ' 通过');
  if (failures.length) {
    console.log('\n失败项：');
    failures.forEach(f => console.log('  ✗ ' + f));
    process.exitCode = 1;
  }
  if (events.nav.length) console.log('\n触发过的跳转：' + events.nav.length + ' 次');
})().catch(e => {
  console.error('模拟器崩溃：', e);
  process.exitCode = 1;
});
