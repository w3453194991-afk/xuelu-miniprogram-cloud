/* 用 miniprogram-automator 连上开发者工具，逐个页面截图
 * 用法：NODE_PATH=<node workspace>/node_modules node tools/run-shots.js
 */
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const shotsDir = path.resolve(__dirname, '../../shots-run');
const WS = process.env.WS || 'ws://127.0.0.1:9421';

async function shot(miniProgram, name) {
  const file = path.join(shotsDir, name + '.png');
  await miniProgram.screenshot({ path: file });
  console.log('  📸 ' + name + '.png');
}

async function texts(page, selector) {
  const nodes = await page.$$(selector);
  const out = [];
  for (const node of nodes) {
    try { out.push((await node.text()).trim()); } catch (e) { /* 节点已失效 */ }
  }
  return out;
}

async function textOf(page, selector) {
  const node = await page.$(selector);
  if (!node) return '';
  return (await node.text()).trim();
}

async function byText(page, selector, text) {
  const nodes = await page.$$(selector);
  for (const node of nodes) {
    let t = '';
    try { t = (await node.text()).trim(); } catch (e) { continue; }
    if (t === text) return node;
  }
  return null;
}

(async () => {
  fs.mkdirSync(shotsDir, { recursive: true });
  console.log('连接 ' + WS + ' …');
  const miniProgram = await automator.connect({ wsEndpoint: WS });
  console.log('已连接，开始截图\n');

  /* 1. 首页 */
  let page = await miniProgram.reLaunch('/pages/index/index');
  await page.waitFor(1200);
  const quickNames = await texts(page, '.quick-name');
  console.log('首页六入口：', quickNames.length ? quickNames.join(' / ') : '（选择器未命中）');
  await shot(miniProgram, '01-首页-六入口');

  /* 2. 学习资源 → 职考技能 */
  page = await miniProgram.switchTab('/pages/learning/learning');
  await page.waitFor(1200);
  const zkChip = await byText(page, '.chip', '职考技能');
  if (zkChip) {
    await zkChip.tap();
    await page.waitFor(1200);
  } else {
    console.log('  ⚠ 未找到「职考技能」分类按钮');
  }
  console.log('职考说明：', await textOf(page, '.kind-tip'));
  console.log('科目：', (await texts(page, '.chip-sm')).join(' / '));
  console.log('课程：', (await texts(page, '.course-title')).join(' | '));
  await shot(miniProgram, '02-学习资源-职考技能');

  /* 3. 职考技能按科目筛选 */
  const sw = await byText(page, '.chip-sm', '社会工作');
  if (sw) {
    await sw.tap();
    await page.waitFor(900);
    console.log('筛「社会工作」后：', (await texts(page, '.course-title')).join(' | '));
    await shot(miniProgram, '03-职考技能-按科目筛选');
  }

  /* 4. 伴学服务：伴学老师 */
  page = await miniProgram.navigateTo('/pages/service/service');
  await page.waitFor(1400);
  console.log('伴学服务 Tab：', (await texts(page, '.seg')).join(' / '));
  console.log('说明条：', await textOf(page, '.banner'));
  console.log('伴学老师：', (await texts(page, '.strong')).join(' | '));
  await shot(miniProgram, '04-伴学服务-伴学老师');

  /* 5. 伴学服务：安心校车 */
  const bus = await byText(page, '.seg', '安心校车');
  if (bus) {
    await bus.tap();
    await page.waitFor(1000);
    console.log('校车说明：', await textOf(page, '.banner'));
    console.log('校车列表：', (await texts(page, '.strong')).join(' | '));
    await shot(miniProgram, '05-伴学服务-安心校车');
  }

  /* 6. 机构目录 */
  page = await miniProgram.navigateTo('/pages/institutions/institutions');
  await page.waitFor(1200);
  console.log('机构目录：', (await texts(page, '.name')).join(' / ') || (await texts(page, '.card')).length + ' 张卡片');
  await shot(miniProgram, '06-机构目录');

  /* 7. 学鹭助手 */
  page = await miniProgram.navigateTo('/pages/assistant/assistant');
  await page.waitFor(1200);
  await shot(miniProgram, '07-学鹭助手');

  /* 8. 助手实际回答一句（没有后端也走内置问答） */
  const ask = await byText(page, '.quick-bar .chip', '怎么预约课程？') || (await page.$$('.quick-bar .chip'))[0];
  if (ask) {
    await ask.tap();
    await page.waitFor(1500);
    const bubbles = await texts(page, '.bubble-text');
    console.log('助手回答：', bubbles[bubbles.length - 1]);
    await shot(miniProgram, '08-助手回答');
  } else {
    console.log('  ⚠ 未找到快捷提问');
  }

  /* 9. 回首页点「职考技能」入口，应直接进学习资源并选中职考技能 */
  page = await miniProgram.reLaunch('/pages/index/index');
  await page.waitFor(1000);
  const zkEntry = await byText(page, '.quick-name', '职考技能');
  if (zkEntry) {
    await zkEntry.tap();
    await page.waitFor(1600);
    const cur = await miniProgram.currentPage();
    const onKind = await textOf(cur, '.chip-on');
    console.log('首页「职考技能」→ ', cur.path, '｜当前选中：', onKind);
    await shot(miniProgram, '09-首页入口直达职考技能');
  }

  console.log('\n截图完成，输出目录：' + shotsDir);
  await miniProgram.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('运行失败：', err && err.message ? err.message : err);
  process.exit(1);
});
