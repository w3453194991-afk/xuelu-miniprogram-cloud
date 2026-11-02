/* 搜索按钮尺寸核对截图
 * 用法：NODE_PATH=<node workspace>/node_modules node tools/run-search-shots.js
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const shotsDir = path.resolve(__dirname, '../../shots-merchant');
const WS = process.env.WS || 'ws://127.0.0.1:9421';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(mp, name) {
  await mp.screenshot({ path: path.join(shotsDir, name + '.png') });
  console.log('  📸 ' + name + '.png');
}

(async () => {
  fs.mkdirSync(shotsDir, { recursive: true });
  const mp = await automator.connect({ wsEndpoint: WS });

  let page = await mp.reLaunch('/pages/index/index');
  await sleep(2200);
  let btn = await page.$('.search-btn');
  console.log('首页搜索按钮', btn ? JSON.stringify(await btn.size()) : '无');
  await shot(mp, '07-首页搜索栏');

  await sleep(600);
  page = await mp.reLaunch('/pages/gaokao-schools/gaokao-schools');
  await sleep(2000);
  btn = await page.$('.search-btn');
  console.log('院校库搜索按钮', btn ? JSON.stringify(await btn.size()) : '无');
  await shot(mp, '08-院校库搜索栏');

  await sleep(600);
  page = await mp.reLaunch('/pages/exam/exam');
  await sleep(2000);
  btn = await page.$('.search-btn');
  console.log('备考搜索按钮', btn ? JSON.stringify(await btn.size()) : '无');
  await shot(mp, '09-备考搜索栏');

  console.log('\n完成，输出：' + shotsDir);
  await mp.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('运行失败：', err && err.message ? err.message : err);
  process.exit(1);
});
