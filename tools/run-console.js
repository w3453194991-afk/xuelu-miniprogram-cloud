/* 扫一遍所有页面，收集控制台 error / warn 与运行异常
 * 用法：NODE_PATH=<node workspace>/node_modules node tools/run-console.js
 */
const automator = require('miniprogram-automator');

const WS = process.env.WS || 'ws://127.0.0.1:9421';

/* 页面清单：tab 页用 switchTab，其余 navigateTo */
const TABS = [
  ['/pages/index/index', '首页'],
  ['/pages/learning/learning', '学习资源'],
  ['/pages/orders/orders', '我的订单'],
  ['/pages/mine/mine', '我的']
];
const PAGES = [
  ['/pages/detail/detail?id=c1', '服务详情'],
  ['/pages/booking/booking?id=c1&type=course', '报名下单'],
  ['/pages/learning-detail/learning-detail?id=z1', '课程详情'],
  ['/pages/gaokao/gaokao', '升学规划'],
  ['/pages/gaokao-detail/gaokao-detail?name=' + encodeURIComponent('清华大学'), '院校详情'],
  ['/pages/exam/exam', '公考研训'],
  ['/pages/exam-detail/exam-detail?id=1', '岗位详情'],
  ['/pages/institutions/institutions', '机构目录'],
  ['/pages/merchant/merchant?name=' + encodeURIComponent('拾光艺术中心'), '机构主页'],
  ['/pages/service/service', '伴学服务'],
  ['/pages/transport/transport', '接送板块'],
  ['/pages/institution/institution', '机构工作台'],
  ['/pages/join/join', '我要入驻'],
  ['/pages/login/login', '登录注册'],
  ['/pages/companion/companion', '伴学详情'],
  ['/pages/feedback/feedback', '意见反馈'],
  ['/pages/help/help', '帮助中心'],
  ['/pages/admin/admin', '平台管理'],
  ['/pages/assistant/assistant', '学鹭助手']
];

const logs = [];
function record(kind, payload) {
  let text = '';
  if (typeof payload === 'string') text = payload;
  else if (payload && payload.args) text = payload.args.map(String).join(' ');
  else text = String(payload && payload.message ? payload.message : payload);
  logs.push({ kind, text: text.slice(0, 400) });
}

(async () => {
  console.log('连接 ' + WS + ' …');
  const miniProgram = await automator.connect({ wsEndpoint: WS });

  miniProgram.on('console', msg => {
    const level = (msg && msg.type) || 'log';
    if (level === 'error' || level === 'warn') record('console.' + level, msg);
  });
  miniProgram.on('exception', err => record('exception', err));
  miniProgram.on('pageNotFound', err => record('pageNotFound', err));
  console.log('已连接，开始逐页扫描\n');

  const seen = [];
  for (const [url, name] of TABS) {
    const mark = logs.length;
    try {
      const page = await miniProgram.switchTab(url);
      await page.waitFor(1100);
      seen.push(name + ' ✓');
    } catch (e) {
      seen.push(name + ' ✗ ' + e.message);
    }
    if (logs.length > mark) seen[seen.length - 1] += '  ⚠ 新增 ' + (logs.length - mark) + ' 条';
  }
  for (const [url, name] of PAGES) {
    const mark = logs.length;
    try {
      const page = await miniProgram.navigateTo(url);
      await page.waitFor(1100);
      seen.push(name + ' ✓');
    } catch (e) {
      seen.push(name + ' ✗ ' + e.message);
    }
    if (logs.length > mark) seen[seen.length - 1] += '  ⚠ 新增 ' + (logs.length - mark) + ' 条';
    await miniProgram.reLaunch('/pages/index/index');
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(seen.join('\n'));

  console.log('\n===== 控制台 warn / error / 异常 =====');
  if (!logs.length) console.log('（无）');
  else {
    const uniq = new Map();
    for (const l of logs) {
      const key = l.kind + '|' + l.text;
      uniq.set(key, (uniq.get(key) || 0) + 1);
    }
    for (const [key, count] of uniq) {
      const [kind, text] = key.split('|');
      console.log('[' + kind + '] ×' + count + '  ' + text.replace(/\n/g, ' ⏎ ').slice(0, 300));
    }
  }

  await miniProgram.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('运行失败：', err && err.message ? err.message : err);
  process.exit(1);
});
