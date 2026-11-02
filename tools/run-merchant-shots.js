/* 机构主页 + 伴学老师资料截图
 * 用法：NODE_PATH=<node workspace>/node_modules node tools/run-merchant-shots.js
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const shotsDir = path.resolve(__dirname, '../../shots-merchant');
const WS = process.env.WS || 'ws://127.0.0.1:9421';

async function shot(miniProgram, name) {
  await miniProgram.screenshot({ path: path.join(shotsDir, name + '.png') });
  console.log('  📸 ' + name + '.png');
}
async function texts(page, sel) {
  const nodes = await page.$$(sel);
  const out = [];
  for (const node of nodes) {
    try { out.push((await node.text()).trim()); } catch (e) { /* skip */ }
  }
  return out;
}
async function scrollBy(miniProgram, dy) {
  await miniProgram.evaluate(y => {
    wx.pageScrollTo({ scrollTop: y, duration: 0 });
  }, dy);
}

(async () => {
  fs.mkdirSync(shotsDir, { recursive: true });
  const miniProgram = await automator.connect({ wsEndpoint: WS });

  /* 首屏从首页进，保证导航栈正常 */
  await miniProgram.reLaunch('/pages/institutions/institutions');
  await new Promise(r => setTimeout(r, 1500));

  const name = '拾光艺术中心';
  await miniProgram.navigateTo('/pages/merchant/merchant?name=' + encodeURIComponent(name));
  let page = await miniProgram.currentPage();
  await new Promise(r => setTimeout(r, 1400));
  console.log('机构名：', (await texts(page, '.m-name')).join(''));
  console.log('成立与人群：', (await texts(page, '.m-sub')).join(''));
  console.log('统计：', (await texts(page, '.m-stat')).map(s => s.replace(/\n/g, ' ')).join(' | '));
  console.log('价格：', (await texts(page, '.m-price-value')).join(''));
  console.log('环境：', (await texts(page, '.env-name')).join(' / '));
  console.log('课程：', (await texts(page, '.course')).map(s => s.split('\n')[0]).join(' / '));
  await shot(miniProgram, '01-机构主页-头部');

  await scrollBy(miniProgram, 520);
  await new Promise(r => setTimeout(r, 500));
  await shot(miniProgram, '02-机构主页-环境与课程');

  await scrollBy(miniProgram, 1200);
  await new Promise(r => setTimeout(r, 500));
  console.log('教师：', (await texts(page, '.teacher')).map(s => s.replace(/\n/g, ' ')).join(' | '));
  console.log('资质：', (await texts(page, '.chip')).join(' / '));
  await shot(miniProgram, '03-机构主页-教师与资质');

  /* 伴学老师详情：学校 / 专业 / 星级 / 个人介绍 */
  await miniProgram.navigateTo('/pages/detail/detail?id=t3');
  page = await miniProgram.currentPage();
  await new Promise(r => setTimeout(r, 1400));
  console.log('老师：', (await texts(page, '.tutor-name')).join(''));
  console.log('学校专业：', (await texts(page, '.tutor-school')).join(''));
  console.log('星级：', (await texts(page, '.stars')).join(''));
  console.log('介绍：', (await texts(page, '.tutor-intro')).join('').slice(0, 60) + '…');
  await shot(miniProgram, '04-伴学老师-头部');

  await scrollBy(miniProgram, 700);
  await new Promise(r => setTimeout(r, 500));
  await shot(miniProgram, '05-伴学老师-档案');

  /* 首页伴学 Tab 的卡片也要有学校专业与星级 */
  await miniProgram.reLaunch('/pages/index/index');
  page = await miniProgram.currentPage();
  await new Promise(r => setTimeout(r, 1500));
  await miniProgram.evaluate(() => {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    cur.setData({ type: 'tutor', sub: 'all' });
    cur.applyFilter();
  });
  await new Promise(r => setTimeout(r, 900));
  console.log('首页伴学卡：', (await texts(page, '.tutor-line')).join(' / '));
  await shot(miniProgram, '06-首页伴学卡');

  console.log('\n完成，输出：' + shotsDir);
  await miniProgram.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('运行失败：', err && err.message ? err.message : err);
  process.exit(1);
});
