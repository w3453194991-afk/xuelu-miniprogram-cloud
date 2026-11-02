/* 升学规划六个板块截图 + 交互验证
 * 用法：NODE_PATH=<node workspace>/node_modules node tools/run-plan-shots.js
 *
 * 注意：六个板块在 scroll-view 里横向滚动，靠坐标点击会点不到屏幕外的标签，
 * 所以这里统一用 setData 切板块，只对屏幕内的表单做真实点击。
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const shotsDir = path.resolve(__dirname, '../../shots-plan');
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
/* 切板块：直接改 data，避免横向滚动里点不到 */
async function setTab(miniProgram, key, extra) {
  await miniProgram.evaluate((tab, load) => {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    page.setData({ tab });
    if (load && typeof page.loadPathways === 'function' && !page.data.pathways) page.loadPathways();
  }, key, !!extra);
}

(async () => {
  fs.mkdirSync(shotsDir, { recursive: true });
  const miniProgram = await automator.connect({ wsEndpoint: WS });

  let page = await miniProgram.navigateTo('/pages/gaokao/gaokao');
  await page.waitFor(1800);
  console.log('板块：', (await texts(page, '.plan-tab')).join(' / '));
  console.log('档案摘要：', (await texts(page, '.pchip')).join(' · '));
  await shot(miniProgram, '01-升学规划-学生档案');

  /* 学业曲线 */
  await setTab(miniProgram, 'curve');
  await page.waitFor(700);
  console.log('统计卡：', (await texts(page, '.plan-stat-label')).join(' / '), '→', (await texts(page, '.plan-stat-value')).join(' / '));
  await shot(miniProgram, '02-学业曲线');

  /* 录一条成绩，验证均分/差距会立刻重算 */
  await miniProgram.evaluate(async () => {
    const page = getCurrentPages()[getCurrentPages().length - 1];
    page.setData({ examForm: { name: '高一上学期期中', date: '2026-11-10', total: '588' } });
    await page.addExam();
  });
  await page.waitFor(1600);
  console.log('录入后统计卡：', (await texts(page, '.plan-stat-label')).join(' / '), '→', (await texts(page, '.plan-stat-value')).join(' / '));
  console.log('记录条数：', (await texts(page, '.exam-row')).length);
  await shot(miniProgram, '02b-学业曲线-录入后');

  /* 路径规划 */
  await setTab(miniProgram, 'path');
  await page.waitFor(700);
  const stageRows = await texts(page, '.stage-node');
  console.log('五段路径：', stageRows.map(s => s.split('\n')[0]).join(' / '));
  await shot(miniProgram, '03-路径规划');

  /* 选科建议 */
  await setTab(miniProgram, 'subjects');
  await page.waitFor(700);
  console.log('选科组合数：', (await texts(page, '.combo-row')).length, '｜覆盖：', (await texts(page, '.combo-pct')).slice(0, 3).join(' '));
  await shot(miniProgram, '04-选科建议');

  /* 多元升学 */
  await setTab(miniProgram, 'pathways', true);
  await page.waitFor(1600);
  const cards = await texts(page, '.pathway-card');
  console.log('多元升学：', cards.map(s => s.split('\n')[0]).join(' / '));
  await shot(miniProgram, '05-多元升学');

  /* 关键节点 */
  await setTab(miniProgram, 'timeline');
  await page.waitFor(700);
  console.log('节点数：', (await texts(page, '.tl-row')).length);
  await shot(miniProgram, '06-关键节点');

  /* 院校参考 */
  page = await miniProgram.navigateTo('/pages/gaokao-schools/gaokao-schools');
  await page.waitFor(1600);
  console.log('院校参考：', (await texts(page, '.uni')).length, '所（首屏）');
  await shot(miniProgram, '07-院校参考');

  console.log('\n完成，输出：' + shotsDir);
  await miniProgram.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('运行失败：', err && err.message ? err.message : err);
  process.exit(1);
});
