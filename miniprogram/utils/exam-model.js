/* 考公 / 考研 / 考编 模拟模型（计算层）
   分数线、报名人数、竞争比全部由「条目 id + 年份」的哈希种子确定，
   同一请求永远同一结果，重启不变；三类考试共用一套条目结构。*/

const {ITEMS, KIND_META, KY_NATIONAL_BASE, YEARS, itemsOf, meta,
  EXAM_ORGS, EXAM_COURSES, EXAM_BOOKS} = require('./exam-data.js');



const RESOURCE_DISCLAIMER = '';

const DISCLAIMER = '';

/* ---------------- 确定性随机 ---------------- */
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rand01(seed) {
  let t = (hash32(seed) + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function jitter(seed, amp) { return (rand01(seed) * 2 - 1) * amp; }
const round1 = n => Math.round(n * 10) / 10;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

const EDU_ORDER = {'大专': 1, '本科': 2, '硕士': 3, '博士': 4};

/* 部门 / 单位类别的相对热度（只影响模拟分数与竞争比） */
const GWY_HEAT = {'税务': 0.86, '海关': 0.9, '统计': 0.62, '气象': 0.42, '金融监管': 0.88,
  '铁路公安': 0.7, '财政': 0.72, '审计': 0.64, '法院': 0.78, '检察院': 0.74,
  '市场监管': 0.58, '公安': 0.8, '综合管理': 0.6, '乡镇机关': 0.34};
const SB_HEAT = {'教育': 0.82, '医疗': 0.78, '综合': 0.54, '科研': 0.58, '文化': 0.46, '农林': 0.42};

const YEAR_DRIFT = {2016: -0.022, 2017: 0.006, 2018: -0.008, 2019: 0.014, 2020: 0.004,
  2021: -0.004, 2022: 0.011, 2023: -0.003, 2024: 0.007, 2025: 0};

/* 冲稳保的绝对分差（按各考试满分设定，比按比例更贴近实际） */
const BANDS = {
  gwy: {chong: 16, wen: 12, bao: 45},
  ky: {chong: 40, wen: 30, bao: 90},
  sb: {chong: 8, wen: 6, bao: 25}
};

const byId = new Map();
for (const kind of Object.keys(ITEMS)) for (const item of ITEMS[kind]) byId.set(item.id, item);

function findItem(kind, id) {
  const item = byId.get(String(id));
  return item && item.kind === kind ? item : null;
}
function listOf(kind) { return itemsOf(kind); }
function kindMeta(kind) { return KIND_META[kind] || null; }
const isKind = kind => Object.prototype.hasOwnProperty.call(KIND_META, kind);

/* ---------------- 难度与分数线 ---------------- */
function difficulty(item) {
  if (item.kind === 'gwy') {
    const heat = GWY_HEAT[item.category] ?? 0.5;
    const exam = item.examType === '国考' ? 0.22 : 0.08;
    return clamp(heat * 0.62 + exam + rand01(item.id + '|d') * 0.14, 0, 1);
  }
  if (item.kind === 'ky') {
    const uni = item._uni || {};
    const tierHeat = {'985': 0.85, '211': 0.62, '本科': 0.38}[uni.tier] ?? 0.3;
    return clamp(tierHeat * 0.7 + (uni.heat ?? 0.5) * 0.3, 0, 1);
  }
  return clamp((SB_HEAT[item.category] ?? 0.5) * 0.68 + rand01(item.id + '|d') * 0.32, 0, 1);
}

/* 考研国家线（A 区，总分 500） */
function nationalLine(category, year) {
  const base = KY_NATIONAL_BASE[category] ?? 300;
  const drift = YEAR_DRIFT[year] ?? 0;
  return round1(clamp(base * (1 + drift) + jitter(`nat|${category}|${year}`, 3), 200, 400));
}

function lineOf(item, year) {
  const drift = YEAR_DRIFT[year] ?? 0;
  const d = difficulty(item);
  const noise = jitter(`${item.id}|${year}|line`, 1.5);
  if (item.kind === 'gwy') return round1(clamp((96 + d * 52) * (1 + drift) + noise, 88, 155));
  if (item.kind === 'sb') return round1(clamp((52 + d * 30) * (1 + drift) + noise, 40, 95));
  // 考研院校线：按院校层次给基准，再用国家线兜底（顶尖院校的实际复试线远高于国家线）
  const uni = item._uni || {};
  const nat = nationalLine(uni.category || '工学', year);
  const tierBase = {'985': 348, '211': 308, '本科': 285}[uni.tier] ?? 285;
  const raw = tierBase + (uni.heat ?? 0.5) * 42 + noise;
  return round1(clamp(Math.max(raw, nat + 5), 200, 490));
}

function ratioOf(item, year) {
  const d = difficulty(item);
  const noise = 1 + jitter(`${item.id}|${year}|ratio`, 0.28);
  const base = item.kind === 'gwy' ? 12 + d * 230 : item.kind === 'sb' ? 5 + d * 68 : 1.5 + d * 17;
  return Math.round(clamp(base * noise, 1, 400) * 10) / 10;
}

function applicantsOf(item, year) {
  const ratio = ratioOf(item, year);
  return Math.max(item.quota, Math.round(item.quota * ratio));
}

function seriesOf(item) {
  return YEARS.map(year => {
    const ratio = ratioOf(item, year);
    return {
      year,
      line: lineOf(item, year),
      ratio,
      applicants: Math.max(item.quota, Math.round(item.quota * ratio)),
      quota: item.quota
    };
  });
}

/* 竞争热度分档文案 */
function heatLabel(kind, ratio) {
  const level = kind === 'ky' ? [2, 6, 12] : kind === 'sb' ? [10, 30, 60] : [30, 90, 200];
  if (ratio <= level[0]) return '较低';
  if (ratio <= level[1]) return '中等';
  if (ratio <= level[2]) return '较高';
  return '非常激烈';
}

/* ---------------- 对外数据 ---------------- */
function summary(item, year = 2025) {
  const ratio = ratioOf(item, year);
  const line = lineOf(item, year);
  return {
    id: item.id, kind: item.kind, org: item.org, title: item.title,
    region: item.region, city: item.city, category: item.category, examType: item.examType,
    quota: item.quota, applicants: applicantsOf(item, year), ratio, heat: heatLabel(item.kind, ratio),
    line, year,
    requirements: item.requirements
  };
}

function detail(item, year = 2025) {
  const meta = KIND_META[item.kind];
  const base = summary(item, year);
  return {
    ...base,
    ...item,
    lineLabel: meta.lineLabel,
    unitLabel: meta.unitLabel,
    quotaLabel: meta.quotaLabel,
    applicantLabel: meta.applicantLabel,
    fullScore: meta.fullScore,
    series: seriesOf(item),
    nationalLine: item.kind === 'ky' ? nationalLine(item._uni?.category || '工学', year) : null,
    nationalSeries: item.kind === 'ky'
      ? YEARS.map(y => ({year: y, line: nationalLine(item._uni?.category || '工学', y)}))
      : null,
    disclaimer: DISCLAIMER
  };
}

const SORTS = {
  line: (a, b) => b.line - a.line,
  'line-asc': (a, b) => a.line - b.line,
  ratio: (a, b) => b.ratio - a.ratio,
  'ratio-asc': (a, b) => a.ratio - b.ratio,
  quota: (a, b) => b.quota - a.quota,
  org: (a, b) => a.org.localeCompare(b.org, 'zh-Hans-CN')
};

/* 备考服务推荐：机构 / 课程 / 图书。
   seed 不同 → 排序不同，前端「换一批」就是改 seed 重新取。 */
function resources(kind, seed = 0) {
  const info = KIND_META[kind];
  if (!info) { const e = new Error('考试类型不存在'); e.status = 400; throw e; }
  const s = clamp(Number(seed) || 0, 0, 9999);
  const rank = (list, n) => list
    .map(item => ({item, key: rand01(`${item.id}|${s}`)}))
    .sort((a, b) => a.key - b.key)
    .slice(0, n)
    .map(x => x.item);

  const orgs = rank(EXAM_ORGS.filter(o => o.kind === kind), 3).map(o => ({
    ...o,
    rating: Math.round((4.2 + rand01(o.id + '|r') * 0.7) * 10) / 10,
    students: 400 + Math.round(rand01(o.id + '|s') * 8600),
    courses: EXAM_COURSES.filter(c => c.org === o.name).length
  }));
  // 展示数小于池子，「换一批」才会真的换内容而不只是换顺序
  const courses = rank(EXAM_COURSES.filter(c => c.kind === kind), 4).map(c => ({
    ...c,
    rating: Math.round((4.1 + rand01(c.id + '|r') * 0.8) * 10) / 10,
    enrolled: 60 + Math.round(rand01(c.id + '|e') * 1900)
  }));
  const books = rank(EXAM_BOOKS.filter(b => b.kind === kind), 6).map(b => ({
    ...b,
    rating: Math.round((4.3 + rand01(b.id + '|r') * 0.6) * 10) / 10,
    sold: 200 + Math.round(rand01(b.id + '|s') * 9800)
  }));
  return {kind, seed: s, label: info.label, orgs, courses, books, disclaimer: RESOURCE_DISCLAIMER};
}

function listItems({kind, region, category, examType, education, q, sort = 'line', page = 1, size = 12, year = 2025} = {}) {
  const keyword = String(q || '').trim().toLowerCase();
  const rows = itemsOf(kind).filter(item =>
    (!region || item.region === region) &&
    (!category || item.category === category) &&
    (!examType || item.examType === examType) &&
    (!education || item.requirements.education === education) &&
    (!keyword || (item.org + item.title + item.city + item.category).toLowerCase().includes(keyword))
  ).map(item => summary(item, year));

  rows.sort(SORTS[sort] || SORTS.line);
  const total = rows.length;
  const pages = Math.ceil(total / size) || 1;
  const p = Math.max(1, Math.min(Number(page) || 1, pages));
  return {total, page: p, size, pages, items: rows.slice((p - 1) * size, p * size), kind, year};
}

/* 匹配（冲稳保）：按「我的分数 − 往年线」分档，档位按满分成比例 */
function match({kind, score, region, education, major, category, political, limit = 10, year = 2025} = {}) {
  const meta = KIND_META[kind];
  if (!meta) { const e = new Error('考试类型不存在'); e.status = 400; throw e; }
  const full = meta.fullScore;
  const s = Number(score);
  if (!Number.isFinite(s) || s <= 0 || s > full) {
    const e = new Error(`分数须为 0–${full} 之间的数字（${meta.label}${meta.scoreLabel}满分 ${full}）`);
    e.status = 400;
    throw e;
  }
  const majorText = String(major || '').trim();
  const userEdu = EDU_ORDER[education] || 0;
  const needParty = political === '中共党员';

  const buckets = {chong: [], wen: [], bao: []};
  for (const item of itemsOf(kind)) {
    if (region && item.region !== region) continue;
    if (category && item.category !== category) continue;
    // 报考条件过滤：学历、专业、政治面貌
    if (userEdu && EDU_ORDER[item.requirements.education] > userEdu) continue;
    const reqMajor = item.requirements.major;
    if (majorText && reqMajor !== '不限' && !reqMajor.includes(majorText)) continue;
    if (item.requirements.political === '中共党员' && !needParty) continue;

    const line = lineOf(item, year);
    const diff = round1(s - line);
    const ratio = ratioOf(item, year);
    const entry = {
      ...summary(item, year),
      diff,
      probability: Math.round(clamp(1 / (1 + Math.exp(-diff / (full * 0.045))), 0.02, 0.98) * 100)
    };
    // 档位按考试类型给绝对分差：冲 差一点、稳 追平、保 留足余量
    const band = BANDS[kind];
    if (diff < -band.chong) continue;
    if (diff < 0) buckets.chong.push(entry);
    else if (diff <= band.wen) buckets.wen.push(entry);
    else if (diff <= band.bao) buckets.bao.push(entry);
  }
  const sortBy = list => list.sort((a, b) => b.line - a.line).slice(0, limit);
  return {
    input: {kind, label: meta.label, fullScore: full, score: s, year, region: region || null,
      education: education || null, major: majorText || null, category: category || null, limit},
    buckets: {chong: sortBy(buckets.chong), wen: sortBy(buckets.wen), bao: sortBy(buckets.bao)},
    counts: {chong: buckets.chong.length, wen: buckets.wen.length, bao: buckets.bao.length},
    disclaimer: DISCLAIMER
  };
}


module.exports = {
  RESOURCE_DISCLAIMER,
  DISCLAIMER,
  isKind,
  findItem,
  listOf,
  kindMeta,
  nationalLine,
  lineOf,
  ratioOf,
  applicantsOf,
  summary,
  detail,
  resources,
  listItems,
  match,
  meta
};
