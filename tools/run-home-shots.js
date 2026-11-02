/* 首页四个内容区 Tab 截图：精选 / 课程 / 伴学 / 校车
 * 用法：NODE_PATH=<node workspace>/node_modules node tools/run-home-shots.js
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const shotsDir = path.resolve(__dirname, '../../shots-home');
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
/* 用 setData + 页面方法切 Tab，避免坐标点击受滚动影响 */
async function switchTab(miniProgram, type, sub) {
  await miniProgram.evaluate((t, s) => {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    page.setData({ type: t, sub: s || 'all' });
    page.applyFilter();
  }, type, sub || 'all');
}

(async () => {
  fs.mkdirSync(shotsDir, { recursive: true });
  const miniProgram = await automator.connect({ wsEndpoint: WS });

  const page = await miniProgram.reLaunch('/pages/index/index');
  await page.waitFor(1600);

  console.log('精选分组：', (await texts(page, '.feed-name')).join(' / '));
  console.log('每组条数：', (await texts(page, '.feed-head')).map(s => s.replace(/\n/g, ' ')).join(' | '));
  await shot(miniProgram, '01-精选');

  await switchTab(miniProgram, 'course');
  await page.waitFor(700);
  console.log('课程子分类：', (await texts(page, '.chip')).join(' / '));
  console.log('课程条数：', (await texts(page, '.svc')).length);
  await shot(miniProgram, '02-课程-全部');

  await switchTab(miniProgram, 'course', 'art');
  await page.waitFor(600);
  console.log('艺考课：', (await texts(page, '.svc')).map(s => s.split('\n')[0]).join(' / '));
  await shot(miniProgram, '03-课程-艺考课');

  await switchTab(miniProgram, 'tutor');
  await page.waitFor(700);
  console.log('伴学子分类：', (await texts(page, '.chip')).join(' / '));
  console.log('伴学条数：', (await texts(page, '.svc')).length);
  await shot(miniProgram, '04-伴学-全部');

  await switchTab(miniProgram, 'tutor', 'home');
  await page.waitFor(600);
  console.log('上门辅导：', (await texts(page, '.svc')).map(s => s.split('\n')[0]).join(' / '));
  await shot(miniProgram, '05-伴学-上门辅导');

  await switchTab(miniProgram, 'bus');
  await page.waitFor(700);
  const buses = await texts(page, '.bus');
  console.log('校车线路：', buses.map(b => b.split('\n').slice(0, 3).join(' ')).join(' ／ '));
  await shot(miniProgram, '06-校车');

  console.log('\n完成，输出：' + shotsDir);
  await miniProgram.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('运行失败：', err && err.message ? err.message : err);
  process.exit(1);
});
