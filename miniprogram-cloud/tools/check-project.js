/* 工程自检：页面文件完整性、JS 语法、JSON 合法、WXML 事件处理函数存在、
 * WXML 数据字段与页面 data 对应、非法 API 调用、界面文案禁用词。 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mp = path.join(root, 'miniprogram');
const errors = [];
const warns = [];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(mp);
const byExt = ext => files.filter(f => f.endsWith(ext));

/* 1. JSON 合法 */
for (const file of byExt('.json')) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { errors.push('JSON 解析失败：' + path.relative(root, file) + ' → ' + e.message); }
}

/* 2. 页面四件套齐全 */
const app = JSON.parse(fs.readFileSync(path.join(mp, 'app.json'), 'utf8'));
for (const page of app.pages) {
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
    const file = path.join(mp, page + ext);
    if (!fs.existsSync(file)) errors.push('缺少页面文件：' + page + ext);
  }
}

/* 3. WXML 事件处理函数必须在页面 JS 中定义 */
const pages = app.pages.map(page => {
  const jsPath = path.join(mp, page + '.js');
  const wxmlPath = path.join(mp, page + '.wxml');
  const source = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
  const wxml = fs.existsSync(wxmlPath) ? fs.readFileSync(wxmlPath, 'utf8') : '';
  return { page, source, wxml };
});

for (const item of pages) {
  const handlers = new Set();
  const re = /\b(?:bind|catch|capture-bind|capture-catch)(?::)?([a-z]+)\s*=\s*"([^"{}]+)"/g;
  let m;
  while ((m = re.exec(item.wxml))) handlers.add(m[2].trim());
  for (const handler of handlers) {
    if (!new RegExp('\\b' + handler + '\\s*\\(', 'm').test(item.source)) {
      errors.push(item.page + '.wxml 引用了未定义的处理函数：' + handler);
    }
  }
}

/* 4. WXML 顶层数据字段应出现在页面 data 中（只检查 {{word}} 形式的首段标识符） */
const BUILTIN = new Set(['true', 'false', 'null', 'undefined', 'index', 'item', 'length']);

for (const item of pages) {
  const dataBlock = /data\s*:\s*\{([\s\S]*?)\n  \}/.exec(item.source);
  const names = new Set();
  if (dataBlock) {
    const re = /^\s{4}([A-Za-z_$][\w$]*)\s*:/gm;
    let m;
    while ((m = re.exec(dataBlock[1]))) names.add(m[1]);
  }
  /* setData 里动态写入的字段也算已知 */
  const setRe = /setData\(\s*\{([^}]*)\}/g;
  let sm;
  while ((sm = setRe.exec(item.source))) {
    const keyRe = /['"]?([A-Za-z_$][\w$]*)(?:\.[\w$.]+)?['"]?\s*:/g;
    let km;
    while ((km = keyRe.exec(sm[1]))) names.add(km[1]);
  }
  /* 循环别名（wx:for-item）也算已知字段 */
  const aliasRe = /wx:for-item\s*=\s*"([A-Za-z_$][\w$]*)"/g;
  let am;
  while ((am = aliasRe.exec(item.wxml))) names.add(am[1]);

  const exprRe = /\{\{\s*([A-Za-z_$][\w$]*)/g;
  let em;
  const seen = new Set();
  while ((em = exprRe.exec(item.wxml))) {
    const name = em[1];
    if (BUILTIN.has(name) || names.has(name) || seen.has(name)) continue;
    seen.add(name);
    warns.push(item.page + '.wxml 使用了未在 data 声明的字段：' + name);
  }
}

/* 4.5 模板里不允许调用方法（WXML 只支持表达式） */
for (const item of pages) {
  const callRe = /\{\{[^}]*?([A-Za-z_$][\w$]*)\s*\(/g;
  let cm;
  const hit = new Set();
  while ((cm = callRe.exec(item.wxml))) hit.add(cm[1]);
  for (const fn of hit) {
    if (['if', 'for', 'filter', 'indexOf'].includes(fn)) continue;
    errors.push(item.page + '.wxml 在模板里调用了方法：' + fn + '（应改为在 JS 里预计算）');
  }
}

/* 5. 禁用文案：界面上不应出现模拟/演示提示 */
const BANNED = ['演示', '模拟数据', '仅作演示', '测试数据', '重置本地数据'];
for (const file of files.filter(f => /\.(js|wxml|json)$/.test(f))) {
  if (file.includes(path.sep + 'utils' + path.sep)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const word of BANNED) {
    if (text.includes(word)) errors.push('出现提示文案「' + word + '」：' + path.relative(root, file));
  }
}

/* 6. 页面里不允许直接 require mock / 直接调用 wx.cloud */
for (const item of pages) {
  if (/require\(['"][^'"]*mock\.js/.test(item.source)) errors.push(item.page + '.js 直接依赖 mock 层');
}

/* 7. 云函数目录每个函数需要 index.js 与 package.json */
const fnRoot = path.join(root, 'cloudfunctions');
if (fs.existsSync(fnRoot)) {
  for (const name of fs.readdirSync(fnRoot)) {
    const dir = path.join(fnRoot, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const need of ['index.js', 'package.json']) {
      if (!fs.existsSync(path.join(dir, need))) errors.push('云函数 ' + name + ' 缺少 ' + need);
    }
  }
}

console.log('页面数：' + pages.length + '，文件数：' + files.length);
if (warns.length) {
  console.log('\n提示（' + warns.length + '）：');
  for (const w of warns) console.log('  · ' + w);
}
if (errors.length) {
  console.log('\n错误（' + errors.length + '）：');
  for (const e of errors) console.log('  ✗ ' + e);
  process.exit(1);
}
console.log('\n结构自检通过');
