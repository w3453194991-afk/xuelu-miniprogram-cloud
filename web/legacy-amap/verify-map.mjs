/* 临时验证：detail() 是否输出地图容器 */
globalThis.sessionStorage = {_d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; }};
globalThis.location = {hash: ''};
globalThis.window = {scrollTo() {}};
const links = [];
globalThis.document = {
  head: {append(...n) { links.push(...n); }},
  createElement() { return {rel: '', href: ''}; },
  getElementById() { return null; },
  querySelector() { return null; },
  addEventListener() {},
};

const {createSite} = await import('../public/site.js');

const services = [
  {id: 'c1', type: 'course', title: '创意美术', merchant: '拾光艺术中心', category: '艺术启蒙',
   price: 299, unit: '8课时', icon: '🎨', tone: 'peach', location: '滨江区 · 星光大道',
   address: '杭州市滨江区江南大道 88 号 3 层', city: '杭州', remaining: 18, description: '演示'},
  {id: 't1', type: 'tutor', title: '林老师', merchant: '林老师', category: '语言表达',
   price: 120, unit: '小时', icon: '👩‍🏫', tone: 'lavender', location: '滨江区 · 可上门',
   city: '杭州', remaining: 1, description: '演示', tutorDetail: {school: '演示师范大学'}},
  {id: 'b1', type: 'bus', title: '滨江安心线', merchant: '安心出行', category: '校车接送',
   price: 580, unit: '月', icon: '🚌', tone: 'peach', location: '滨江区 · 固定线路',
   city: '杭州', remaining: 8, description: '演示',
   busDetail: {routes: [{name: '星光小区', arrival: '07:10', departure: '07:12'}]}},
];

const state = {page: 'detail', services, orders: [], applications: [], search: ''};

// selected 在 createSite() 时即从 sessionStorage 读取，必须先写入
sessionStorage._d.selectedService = 'c1';
const site = createSite({
  state,
  api: async () => ({}),
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
  card: () => '',
  toast: () => {},
  refresh: async () => {},
  render: () => {},
  modal: {innerHTML: '', showModal() {}},
});

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? ' -> ' + extra : '')); }
};
const btn = dataset => ({dataset, hasAttribute: () => false});

// 有地址的课程：必须出现地图容器
let html = site.page();
check('course detail has #detail-map', html.includes('id="detail-map"'), html.slice(0, 120));
check('course detail shows address text', html.includes('江南大道 88 号'));
check('course detail has 位置与地图 panel', html.includes('位置与地图'));
check('course detail has loading hint', html.includes('地图加载中'));

// 家教师：可上门，无固定地址 -> 不画地图，给出说明
await site.click(btn({detail: 't1'}));
html = site.page();
check('tutor detail has NO map container', !html.includes('id="detail-map"'));
check('tutor detail explains 上门', html.includes('上门授课'));

// 校车：无地址 -> 引导看线路
await site.click(btn({detail: 'b1'}));
html = site.page();
check('bus detail has NO map container', !html.includes('id="detail-map"'));
check('bus detail points to 线路与站点', html.includes('线路与站点'));

// 页面其余部分仍然完整
check('booking summary intact', html.includes('booking-summary'));
check('预订须知 panel intact', html.includes('预订须知'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
