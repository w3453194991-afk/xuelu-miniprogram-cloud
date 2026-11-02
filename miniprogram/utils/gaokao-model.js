/* 高考志愿模拟模型（计算层）
   分数全部由「院校 id + 年份 + 省份 + 专业」的哈希种子确定，因此：
   同一请求永远得到同一结果，服务重启后也不会变，不需要把几十万条分数落库。
   所有数值都是演示用的模拟数据，与真实招生无关。*/

const {
  YEARS, PROVINCES, TIERS, TYPES, SUBJECTS, LEGACY_SUBJECTS, ALLIANCES,
  UNDERGRAD_MAJORS, VOCATIONAL_MAJORS, universityList, provinceByName
} = require('./gaokao-data.js');

const UNIVERSITIES = universityList();
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
// 在 ±amp 之间取一个确定性抖动
function jitter(seed, amp) { return (rand01(seed) * 2 - 1) * amp; }
const round1 = n => Math.round(n * 10) / 10;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------------- 院校强度 ---------------- */
const TIER_STRENGTH = {'985': [0.925, 0.995], '211': [0.845, 0.92], '本科': [0.70, 0.84], '专科': [0.30, 0.50]};
const STRENGTH = new Map();
const BASE_LINE = new Map();
for (const tier of TIERS) {
  const peers = UNIVERSITIES.filter(u => u.tier === tier).sort((a, b) => a.alumniRank - b.alumniRank);
  const [lo, hi] = TIER_STRENGTH[tier];
  peers.forEach((u, i) => {
    const p = peers.length === 1 ? 0 : i / (peers.length - 1);
    const s = hi - p * (hi - lo);
    STRENGTH.set(u.id, s);
    // 750 分制下的「校线」基准（2025 年、全国平均水平）
    BASE_LINE.set(u.id, 150 + Math.pow(s, 1.6) * 560);
  });
}

// 年度难度漂移（相对 2025 年的百分比）
const DRIFT = {2016: -0.014, 2017: 0.004, 2018: -0.006, 2019: 0.011, 2020: 0.002,
  2021: -0.003, 2022: 0.009, 2023: -0.002, 2024: 0.005, 2025: 0};

const byId = new Map(UNIVERSITIES.map(u => [u.id, u]));

/* ---------------- 查询入口 ---------------- */
function findUniversity(id) { return byId.get(String(id)) || null; }
function provinceInfo(name) { return provinceByName(name) || PROVINCES[0]; }
function isProvince(name) { return PROVINCES.some(p => p.name === name); }
function strengthOf(uni) { return STRENGTH.get(uni.id); }

/* 校线（750 分制、全国平均口径） */
function yearLine(uni, year) {
  const base = BASE_LINE.get(uni.id);
  const drift = DRIFT[year] ?? 0;
  return round1(base * (1 + drift) + jitter(`${uni.id}|${year}|line`, 7));
}

/* 分省投档线：按该省竞争系数放大「超出 150 分」的部分，再换算到该省满分 */
function provinceLine(uni, province, year) {
  const p = provinceByName(province) || PROVINCES[0];
  const base = yearLine(uni, year);
  const adj = 150 + (base - 150) * p.factor + jitter(`${uni.id}|${p.name}|${year}|prov`, 6);
  return round1(clamp(adj * (p.total / 750), 0, p.total));
}

/* 位次估算：按省考生规模的逻辑斯蒂曲线，分数越高位次越靠前 */
function rankOf(province, score) {
  const p = provinceByName(province) || PROVINCES[0];
  const s750 = Number(score) * (750 / p.total);
  const r = Math.round(p.students / (1 + Math.exp((s750 - 500) / 30)));
  return Math.max(1, r);
}

/* ---------------- 专业 ---------------- */
const MAJOR_HEAT = new Map([...UNDERGRAD_MAJORS, ...VOCATIONAL_MAJORS].map(m => [m.name, m.heat]));
const TYPE_AFFINITY = {
  '理工': {'工学': 0.55, '理学': 0.30, '管理学': 0.05},
  '综合': {},
  '师范': {'教育学': 0.55, '文学': 0.30, '理学': 0.22, '历史学': 0.20},
  '农林': {'农学': 0.65, '理学': 0.20, '工学': 0.10},
  '医药': {'医学': 0.75, '理学': 0.20},
  '财经': {'经济学': 0.60, '管理学': 0.42, '法学': 0.10},
  '政法': {'法学': 0.65, '管理学': 0.10},
  '语言': {'文学': 0.65, '法学': 0.10},
  '艺术': {'艺术学': 0.70, '文学': 0.20},
  '民族': {'法学': 0.22, '文学': 0.18, '教育学': 0.15},
  '体育': {'教育学': 0.55, '管理学': 0.10}
};
const MAJOR_COUNT = {'985': 30, '211': 24, '本科': 17, '专科': 9};

const majorsCache = new Map();
function majorsOf(uni) {
  if (majorsCache.has(uni.id)) return majorsCache.get(uni.id);
  const pool = uni.tier === '专科' ? VOCATIONAL_MAJORS : UNDERGRAD_MAJORS;
  const affinity = TYPE_AFFINITY[uni.type] || {};
  const n = MAJOR_COUNT[uni.tier] + Math.floor(rand01(`${uni.id}|count`) * 6);
  const ranked = pool
    .map(m => ({m, score: (affinity[m.category] || 0) + (uni.type === '综合' ? 0.08 : 0) + rand01(`${uni.id}|${m.name}`) * 0.55}))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(n, pool.length))
    .map(x => x.m);
  // 热门专业优先展示
  ranked.sort((a, b) => b.heat - a.heat);
  majorsCache.set(uni.id, ranked);
  return ranked;
}

function majorLine(uni, majorName, province, year) {
  const p = provinceByName(province) || PROVINCES[0];
  const base = provinceLine(uni, province, year);
  const heat = MAJOR_HEAT.get(majorName) ?? 0.75;
  const delta = (heat - 0.82) * 90;
  return round1(clamp(base + delta + jitter(`${uni.id}|${majorName}|${p.name}|${year}`, 5), 0, p.total));
}

function planOf(uni, majorName, year) {
  const heat = MAJOR_HEAT.get(majorName) ?? 0.75;
  const base = uni.tier === '985' ? 12 : uni.tier === '211' ? 9 : uni.tier === '本科' ? 6 : 20;
  return Math.max(2, Math.round(base * (0.6 + heat) + jitter(`${uni.id}|${majorName}|${year}|plan`, 4)));
}

/* ---------------- 展示用 ---------------- */
const INTRO_TPL = [
  (u) => `${loc(u)}的${u.type}类${u.tier}院校，建校于 ${u.founded} 年，校友会排名全国第 ${u.alumniRank}。`,
  (u) => `位于${loc(u)}，${u.founded} 年建校，属${u.tier}层次${u.type}类高校，校友会排名第 ${u.alumniRank}、软科中国排名第 ${u.ruankeRank}。`,
  (u) => `${loc(u)}的${u.type}类院校，${u.tier}层次，办学历史可追溯至 ${u.founded} 年，开设 ${u.majorsCount} 个本科专业。`
];
// 直辖市省份与城市同名，避免拼成「北京北京」
const loc = u => (u.city === u.province ? u.city : u.province + u.city);
function introOf(uni) {
  const i = Math.floor(rand01(`${uni.id}|intro`) * INTRO_TPL.length);
  return INTRO_TPL[i](uni);
}

const DISCIPLINE_BY_MAJOR = new Map([...UNDERGRAD_MAJORS, ...VOCATIONAL_MAJORS].map(m => [m.name, m.category]));

/* 列表项 */
function summary(uni, province = '黑龙江', year = 2025) {
  const line = provinceLine(uni, province, year);
  return {
    id: uni.id, name: uni.name, province: uni.province, city: uni.city,
    tier: uni.tier, type: uni.type, alliance: uni.alliance,
    alumniRank: uni.alumniRank, ruankeRank: uni.ruankeRank, founded: uni.founded,
    majorsCount: majorsOf(uni).length,
    line, rank: rankOf(province, line), year, provinceName: province
  };
}

/* 详情：基本信息 + 专业 + 近十年校线/省线 + 该年各省投档线 */
function detail(uni, province = '黑龙江', year = 2025) {
  const p = provinceInfo(province);
  const majors = majorsOf(uni).map(m => {
    const line = majorLine(uni, m.name, province, year);
    return {
      name: m.name, category: m.category, heat: m.heat,
      line, rank: rankOf(province, line), plan: planOf(uni, m.name, year),
      gap: round1(line - provinceLine(uni, province, year))
    };
  });

  const national = YEARS.map(y => {
    const line = yearLine(uni, y);
    return {year: y, line, avg: round1(line + jitter(`${uni.id}|${y}|avg`, 3.5)), plan: null};
  });
  const provinceSeries = YEARS.map(y => {
    const line = provinceLine(uni, province, y);
    return {year: y, line, rank: rankOf(province, line)};
  });

  const provinceRows = PROVINCES.map(pr => {
    const line = provinceLine(uni, pr.name, year);
    return {province: pr.name, total: pr.total, line, rank: rankOf(pr.name, line)};
  }).sort((a, b) => a.province.localeCompare(b.province, 'zh-Hans-CN'));

  const plan = majors.reduce((sum, m) => sum + m.plan, 0);

  return {
    ...uni, intro: introOf(uni), majorsCount: majors.length,
    majors, lines: {national, province: provinceName(province), provinceSeries, plan},
    provinceLines: {year, rows: provinceRows},
    ranks: {alumni: {rank: uni.alumniRank, source: '校友会'}, ruanke: {rank: uni.ruankeRank, source: '软科中国'}},
    disclaimer: DISCLAIMER
  };
}

function provinceName(n) { return provinceInfo(n).name; }

/* 某专业近十年（指定省份）走势 */
function majorSeries(uni, majorName, province = '黑龙江') {
  const m = majorsOf(uni).find(x => x.name === majorName);
  if (!m) return null;
  return {
    university: {id: uni.id, name: uni.name}, major: m.name, category: m.category, heat: m.heat,
    province: provinceName(province),
    series: YEARS.map(y => {
      const line = majorLine(uni, m.name, province, y);
      return {year: y, line, rank: rankOf(province, line), plan: planOf(uni, m.name, y)};
    })
  };
}

/* 冲稳保推荐 */
function recommend({province = '黑龙江', score, year = 2025, subject = '物理', limit = 10, tier, type, alliance} = {}) {
  const p = provinceInfo(province);
  const s = Number(score);
  if (!Number.isFinite(s) || s <= 0 || s > p.total) {
    const err = new Error(`分数须为 0–${p.total} 之间的数字（${p.name}满分 ${p.total}）`);
    err.status = 400;
    throw err;
  }
  // 科类只做轻微偏移，纯属演示
  const bias = subject === '历史' ? 3 : subject === '物理' ? 0 : 0;

  const buckets = {chong: [], wen: [], bao: []};
  for (const uni of UNIVERSITIES) {
    // 筛选放在分档之前：先过滤再截断，否则某一档会被人为清空
    if (tier && uni.tier !== tier) continue;
    if (type && uni.type !== type) continue;
    if (alliance && !uni.alliance.includes(alliance)) continue;
    const line = provinceLine(uni, province, year);
    const diff = round1(s - line + bias);
    const item = {
      id: uni.id, name: uni.name, province: uni.province, city: uni.city, tier: uni.tier,
      type: uni.type, alliance: uni.alliance, alumniRank: uni.alumniRank, ruankeRank: uni.ruankeRank,
      line, diff, rank: rankOf(province, line), majorsCount: majorsOf(uni).length,
      probability: Math.round(clamp(1 / (1 + Math.exp(-diff / 7)), 0.02, 0.98) * 100)
    };
    if (diff < -18) continue;              // 差距过大，不进入推荐
    if (diff < 0) buckets.chong.push(item);
    else if (diff <= 12) buckets.wen.push(item);
    else if (diff <= 55) buckets.bao.push(item);
  }
  const sortBy = (list, dir) => list.sort((a, b) => dir * (b.line - a.line)).slice(0, limit);
  return {
    input: {province: p.name, total: p.total, score: s, year, subject, limit,
      tier: tier || null, type: type || null, alliance: alliance || null},
    buckets: {
      chong: sortBy(buckets.chong, 1),   // 冲：先看分数线最高的
      wen: sortBy(buckets.wen, 1),
      bao: sortBy(buckets.bao, 1)
    },
    counts: {chong: buckets.chong.length, wen: buckets.wen.length, bao: buckets.bao.length},
    disclaimer: DISCLAIMER
  };
}

/* 院校列表：筛选 + 分页 */
function listUniversities({province, tier, type, alliance, q, sort = 'rank', page = 1, size = 20, scoreProvince = '黑龙江', year = 2025} = {}) {
  const keyword = String(q || '').trim().toLowerCase();
  let rows = UNIVERSITIES.filter(u =>
    (!province || u.province === province) &&
    (!tier || u.tier === tier) &&
    (!type || u.type === type) &&
    (!alliance || u.alliance.includes(alliance)) &&
    (!keyword || (u.name + u.city + u.province + u.type + u.alliance).toLowerCase().includes(keyword))
  ).map(u => summary(u, scoreProvince, year));

  if (sort === 'line-desc') rows.sort((a, b) => b.line - a.line);
  else if (sort === 'line-asc') rows.sort((a, b) => a.line - b.line);
  else if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  else rows.sort((a, b) => a.alumniRank - b.alumniRank);

  const total = rows.length;
  const p = Math.max(1, Math.min(Number(page) || 1, Math.ceil(total / size) || 1));
  const items = rows.slice((p - 1) * size, p * size);
  return {total, page: p, size, pages: Math.ceil(total / size) || 1, items, scoreProvince, year};
}

function meta() {
  return {
    years: YEARS, provinces: PROVINCES, tiers: TIERS, types: TYPES,
    alliances: ALLIANCES, subjects: SUBJECTS, legacySubjects: LEGACY_SUBJECTS,
    majorCategories: [...new Set(UNDERGRAD_MAJORS.map(m => m.category))],
    dataset: {
      universities: UNIVERSITIES.length,
      years: YEARS.length,
      undergradMajors: UNDERGRAD_MAJORS.length,
      vocationalMajors: VOCATIONAL_MAJORS.length,
      byTier: TIERS.reduce((acc, t) => (acc[t] = UNIVERSITIES.filter(u => u.tier === t).length, acc), {}),
      byProvince: PROVINCES.map(p => ({province: p.name, count: UNIVERSITIES.filter(u => u.province === p.name).length})).filter(x => x.count)
    },
    disclaimer: DISCLAIMER
  };
}


module.exports = {
  UNIVERSITIES,
  DISCLAIMER,
  findUniversity,
  provinceInfo,
  isProvince,
  strengthOf,
  yearLine,
  provinceLine,
  rankOf,
  majorsOf,
  majorLine,
  summary,
  detail,
  majorSeries,
  recommend,
  listUniversities,
  meta
};
