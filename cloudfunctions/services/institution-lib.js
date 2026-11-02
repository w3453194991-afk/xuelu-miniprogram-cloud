/* 机构工作台 / 课程套餐 / 视频素材 的纯逻辑（与网页版 institution-api.mjs 同规则）
 * 只做校验与数据整形，不碰数据库。由 cloudfunctions/_lib/sync-common.js 同步到
 * services 与 institutions 两个云函数目录。
 */

const clone = v => JSON.parse(JSON.stringify(v));
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ---------------- 机构评分（口碑） ----------------
 * 有内置口碑数据就用内置的；没有的机构按名称做确定性兜底，
 * 保证每个机构主页都有评分可看，且同一个名字每次算出来一致。
 */
const RATING_DIMS = ['师资', '环境', '课程', '服务'];
const RATING_LEVELS = [
  { min: 4.8, text: '口碑极佳' },
  { min: 4.5, text: '口碑优秀' },
  { min: 4.0, text: '口碑良好' },
  { min: 3.0, text: '口碑一般' },
  { min: 0, text: '暂无评价' }
];

function starsOf(score) {
  const value = Math.max(0, Math.min(5, Number(score) || 0));
  const filled = Math.round(value);
  return [1, 2, 3, 4, 5].map(index => ({ key: 'star-' + index, on: index <= filled }));
}

function ratingSeedOf(name) {
  const key = str(name, 60);
  const seeded = key && require('./seed-data.js').MERCHANT_RATINGS[key];
  if (seeded) return seeded;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  const score = Math.round((4.2 + (hash % 7) / 10) * 10) / 10;
  const dims = {};
  RATING_DIMS.forEach((dim, index) => {
    const drift = ((hash >> (index + 1)) % 3) - 1;
    dims[dim] = Math.round(Math.max(3.5, Math.min(5, score + drift * 0.1)) * 10) / 10;
  });
  return { score, count: 20 + (hash % 180), dims, reviews: [] };
}

/* 列表用的评分摘要 */
function ratingSummary(name) {
  const seed = ratingSeedOf(name);
  const score = Math.round(Math.max(0, Math.min(5, Number(seed.score) || 0)) * 10) / 10;
  const count = Math.max(0, Math.round(Number(seed.count) || 0));
  const level = (RATING_LEVELS.find(x => score >= x.min) || RATING_LEVELS[RATING_LEVELS.length - 1]).text;
  return { score, scoreText: score.toFixed(1), count, countText: count + ' 条评价', level };
}

/* 详情页用的完整评分：摘要 + 四个分维度 + 评价样本 */
function ratingView(name) {
  const seed = ratingSeedOf(name);
  const summary = ratingSummary(name);
  const dims = RATING_DIMS.map((dim, index) => {
    const raw = (seed.dims && seed.dims[dim] !== undefined) ? seed.dims[dim] : summary.score;
    const value = Math.round(Math.max(0, Math.min(5, Number(raw) || 0)) * 10) / 10;
    return {
      key: 'dim-' + index,
      name: dim,
      score: value,
      scoreText: value.toFixed(1),
      width: Math.round(value / 5 * 100)
    };
  });
  const reviews = (Array.isArray(seed.reviews) ? seed.reviews : []).slice(0, 6).map((row, index) => {
    const user = str(row.user, 30) || '匿名家长';
    return {
      key: 'review-' + index,
      user: user,
      initial: user.slice(0, 1),
      score: Math.max(1, Math.min(5, Math.round(Number(row.score) || 5))),
      stars: starsOf(row.score),
      date: str(row.date, 10),
      text: str(row.text, 300)
    };
  });
  return Object.assign({}, summary, {
    stars: starsOf(summary.score),
    dims: dims,
    reviews: reviews,
    hasReviews: reviews.length > 0
  });
}

/* ---------------- 套餐（仅课程类服务） ---------------- */
const PACKAGE_MAX = 10;
const PACKAGE_NAME_MAX = 60;
const PACKAGE_DESC_MAX = 200;
const PACKAGE_LESSONS_MAX = 999;
const PACKAGE_PRICE_MIN = 0.01;
const PACKAGE_PRICE_MAX = 100000;
const LOCAL_VIDEO = /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$/;
const CLOUD_VIDEO = /^cloud:\/\/[^\s]+$/;

/* 视频地址：http(s) 公网地址、本站上传 /media/<uuid>、或云存储 cloud:// fileID */
function validVideoUrl(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 500) return null;
  if (LOCAL_VIDEO.test(value)) return value;
  if (CLOUD_VIDEO.test(value)) return value;
  let parsed;
  try { parsed = new URL(value); } catch (e) { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  if (!parsed.hostname) return null;
  if (parsed.username || parsed.password) return null;
  if (!/^[a-z0-9.-]+$/i.test(parsed.hostname) || !parsed.hostname.includes('.')) return null;
  if (parsed.href.length > 500) return null;
  return parsed.href;
}

function normalizePackages(input) {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw Object.assign(new Error('套餐须为数组'), { status: 400 });
  if (input.length > PACKAGE_MAX) throw Object.assign(new Error('套餐最多 ' + PACKAGE_MAX + ' 项'), { status: 400 });
  const seen = new Set();
  return input.map((raw, index) => {
    const at = '第 ' + (index + 1) + ' 个套餐';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw Object.assign(new Error(at + '格式不正确'), { status: 400 });
    }
    let id = raw.id === undefined || raw.id === null || raw.id === '' ? '' : str(raw.id, 64);
    if (id && !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      throw Object.assign(new Error(at + '的 id 只能包含字母、数字、下划线和短横线'), { status: 400 });
    }
    if (id && seen.has(id)) throw Object.assign(new Error('套餐 id 不能重复：' + id), { status: 400 });
    const name = str(raw.name, PACKAGE_NAME_MAX);
    if (!name) throw Object.assign(new Error(at + '请填写套餐名称'), { status: 400 });
    const price = Number(raw.price);
    if (!Number.isFinite(price) || price < PACKAGE_PRICE_MIN || price > PACKAGE_PRICE_MAX) {
      throw Object.assign(new Error(at + '的价格须为 0.01–' + PACKAGE_PRICE_MAX + ' 元'), { status: 400 });
    }
    const lessons = Number(raw.lessons);
    if (!Number.isInteger(lessons) || lessons < 1 || lessons > PACKAGE_LESSONS_MAX) {
      throw Object.assign(new Error(at + '的课时数须为 1–' + PACKAGE_LESSONS_MAX + ' 的正整数'), { status: 400 });
    }
    const description = str(raw.description, PACKAGE_DESC_MAX);
    const videoUrl = validVideoUrl(raw.videoUrl);
    if (videoUrl === null) {
      throw Object.assign(new Error(at + '的视频地址只允许 http/https 地址、本站 /media/<uuid>.mp4|webm 或云存储 cloud:// fileID'), { status: 400 });
    }
    const item = { id: id || '', name, price: Math.round(price * 100) / 100, lessons, description };
    if (videoUrl) item.videoUrl = videoUrl;
    if (id) seen.add(id);
    return item;
  });
}

function assignPackageIds(list, makeId) {
  const used = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    let id = typeof item.id === 'string' && item.id ? item.id : '';
    if (!id || used.has(id)) id = makeId();
    used.add(id);
    out.push(Object.assign({}, item, { id }));
  }
  return out;
}

function findPackage(service, packageId) {
  if (!Array.isArray(service && service.packages)) return null;
  return service.packages.find(p => p && p.id === packageId) || null;
}

/* ---------------- 服务人群 ---------------- */
/* 家长：课程展示在家长课程页（首页精选 / 精品课程 / 机构目录）
 * 大学生：课程展示在大学生中心的学习资源页
 * 未设置（旧数据）按「家长」处理，既有课程不会消失。 */
const AUDIENCES = ['家长', '大学生'];
const DEFAULT_AUDIENCE = ['家长'];
const AUDIENCE_HINT = '服务人群只能选家长或大学生';

/* required：PUT 机构资料时至少要留一项；入驻申请缺省按「家长」处理 */
function normalizeAudience(value, options) {
  const required = !!(options && options.required);
  if (value === undefined || value === null || value === '') {
    if (required) throw Object.assign(new Error('请选择服务人群'), { status: 400 });
    return null;
  }
  const raw = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : null;
  if (!raw) throw Object.assign(new Error(AUDIENCE_HINT), { status: 400 });
  const picked = [];
  for (const item of raw) {
    const v = str(item, 10);
    if (!v) continue;
    if (!AUDIENCES.includes(v)) throw Object.assign(new Error(AUDIENCE_HINT), { status: 400 });
    if (!picked.includes(v)) picked.push(v);
  }
  if (!picked.length) {
    if (required) throw Object.assign(new Error('请选择服务人群'), { status: 400 });
    return null;
  }
  /* 统一顺序，避免「大学生,家长」和「家长,大学生」被当成两份数据 */
  return AUDIENCES.filter(v => picked.includes(v));
}

/* 课程/机构的对外展示人群：未设置时返回 null，由前端按「家长可见」兜底 */
function audienceOf(value) {
  if (!Array.isArray(value) || !value.length) return null;
  const picked = value.filter(v => AUDIENCES.includes(v));
  return picked.length ? AUDIENCES.filter(v => picked.includes(v)) : null;
}

/* 家长端可见：未设置人群也算家长可见（兼容旧数据） */
function parentAudience(value) {
  const list = audienceOf(value);
  return !list || list.includes('家长');
}

/* ---------------- 机构资料 ---------------- */
const INSTITUTION_NAME_FIXED = '机构名称由关联课程决定，不可在此修改';
const INSTITUTION_FIELDS = {
  intro: { label: '机构简介', max: 500 },
  address: { label: '机构地址', max: 200 },
  contact: { label: '联系人', max: 40 },
  phone: { label: '联系电话', max: 30 }
};

function normalizeInstitutionPatch(raw, currentName) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw Object.assign(new Error('机构资料格式不正确'), { status: 400 });
  }
  const allowed = new Set(['name', 'audience'].concat(Object.keys(INSTITUTION_FIELDS)));
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) throw Object.assign(new Error('不支持的字段：' + key), { status: 400 });
  }
  if (raw.name !== undefined && raw.name !== null && str(raw.name, 60) !== currentName) {
    throw Object.assign(new Error(INSTITUTION_NAME_FIXED), { status: 400 });
  }
  const out = {};
  for (const [key, meta] of Object.entries(INSTITUTION_FIELDS)) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'string') throw Object.assign(new Error(meta.label + '须为文本'), { status: 400 });
    const value = str(raw[key], meta.max);
    if (!value) throw Object.assign(new Error('请填写' + meta.label), { status: 400 });
    out[key] = value;
  }
  /* 服务人群：数组（也可传「家长,大学生」字符串），至少要选一项 */
  if (raw.audience !== undefined && raw.audience !== null) {
    out.audience = normalizeAudience(raw.audience, { required: true });
  }
  if (!Object.keys(out).length) throw Object.assign(new Error('请至少填写一项需要修改的机构资料'), { status: 400 });
  return out;
}

function institutionId(name) {
  const safe = String(name || '').replace(/[\/\\?#%\s]/g, '_');
  return 'inst-' + encodeURIComponent(safe).slice(0, 60);
}

/* 从课程目录生成机构列表：来源只有 course 类服务的 merchant 字段，
   再叠加 institutions 集合按机构 id 持久化的覆盖资料；
   approved：已通过的机构类申请（没有课程也要作为机构存在） */
function buildInstitutions(services, overrides, approved) {
  const stored = new Map();
  for (const row of Array.isArray(overrides) ? overrides : []) if (row && typeof row.id === 'string') stored.set(row.id, row);
  const sanctioned = new Map();
  for (const row of Array.isArray(approved) ? approved : []) if (row && typeof row.id === 'string') sanctioned.set(row.id, row);
  const map = new Map();
  for (const s of Array.isArray(services) ? services : []) {
    if (!s || s.type !== 'course') continue;
    const name = typeof s.merchant === 'string' ? s.merchant.trim() : '';
    if (!name) continue;
    const id = institutionId(name);
    let item = map.get(id);
    if (!item) {
      item = {
        id, name,
        intro: s.merchantDetail && s.merchantDetail.intro || '',
        address: s.merchantDetail && s.merchantDetail.address || s.address || '',
        contact: s.merchantDetail && s.merchantDetail.contact || '',
        phone: s.merchantDetail && s.merchantDetail.phone || s.phone || '',
        audience: audienceOf(s.audience),
        courseCount: 0, courses: [], source: { intro: 'course', address: 'course', contact: 'course', phone: 'course' }
      };
      map.set(id, item);
    }
    item.courseCount += 1;
    item.courses.push({ id: s.id, title: s.title, price: s.price, packages: Array.isArray(s.packages) ? clone(s.packages) : [] });
    for (const key of ['intro', 'address', 'contact', 'phone']) {
      if (!item[key]) {
        const fallback = key === 'address' ? s.address : key === 'phone' ? s.phone : (s.merchantDetail && s.merchantDetail[key]);
        if (fallback) { item[key] = fallback; item.source[key] = 'course'; }
      }
    }
  }
  for (const [id, seed] of sanctioned) {
    const existing = map.get(id);
    if (existing) {
      /* 机构先由课程建出来时，补上入驻申请里选的服务人群 */
      if (!existing.audience) existing.audience = audienceOf(seed.audience);
      continue;
    }
    map.set(id, {
      id, name: seed.name, intro: '', address: '', contact: seed.contact || '', phone: seed.phone || '',
      audience: audienceOf(seed.audience),
      courseCount: 0, courses: [], source: { intro: 'application', address: 'application', contact: 'application', phone: 'application' },
      approvedAt: seed.approvedAt || null
    });
  }
  for (const [id, row] of stored) {
    const item = map.get(id);
    if (!item) continue;
    for (const key of Object.keys(INSTITUTION_FIELDS)) {
      if (typeof row[key] === 'string' && row[key]) { item[key] = row[key]; item.source[key] = 'workbench'; }
    }
    const savedAudience = audienceOf(row.audience);
    if (savedAudience) item.audience = savedAudience;
    if (row.updatedAt) item.updatedAt = row.updatedAt;
  }
  return [...map.values()].map(item => Object.assign({}, item, { rating: ratingSummary(item.name) }));
}

/* 把机构覆盖资料回填进课程详情 */
function applyInstitution(service, institutions) {
  if (!service || service.type !== 'course') return service;
  const name = typeof service.merchant === 'string' ? service.merchant.trim() : '';
  if (!name) return service;
  const hit = (Array.isArray(institutions) ? institutions : []).find(i => i.name === name);
  if (!hit) return service;
  const detail = Object.assign({}, service.merchantDetail || {});
  for (const key of ['intro', 'address', 'contact', 'phone']) if (hit[key]) detail[key] = hit[key];
  if (!detail.name) detail.name = name;
  return Object.assign({}, service, { merchantDetail: detail });
}

/* 机构主页：环境图 / 课程 / 教师介绍 / 价格区间一次拿全。
 * 机构里只存了课程摘要（id/title/price/packages），环境图、师资、资质
 * 都在完整服务记录上，所以第二个参数要传完整服务目录。 */
function institutionDetailView(item, services) {
  const target = item || {};
  const rows = Array.isArray(target.courses) ? target.courses : [];
  const full = new Map((Array.isArray(services) ? services : []).map(s => [s.id, s]));
  const courses = rows.map(row => full.get(row.id) || row);
  const first = courses[0] || {};
  const detail = first.merchantDetail || {};

  /* 环境图：各课程上传的图片按名称去重，保留第一张的说明 */
  const imageMap = new Map();
  courses.forEach(course => {
    (Array.isArray(course.images) ? course.images : []).forEach(img => {
      if (!img || !img.name || imageMap.has(img.name)) return;
      imageMap.set(img.name, {
        key: 'env-' + imageMap.size,
        name: img.name,
        caption: img.caption || '',
        tone: img.tone || 'peach',
        course: course.title || ''
      });
    });
  });

  const teachers = (Array.isArray(detail.teachers) ? detail.teachers : [])
    .map((raw, index) => {
      const line = str(raw, 60);
      if (!line) return null;
      const at = line.indexOf('·');
      const name = (at < 0 ? line : line.slice(0, at)).trim();
      const subject = at < 0 ? '' : line.slice(at + 1).trim();
      if (!name) return null;
      return { key: 'teacher-' + index, name: name, subject: subject, initial: name.slice(0, 1) };
    })
    .filter(Boolean);

  const prices = courses.map(c => Number(c.price)).filter(n => Number.isFinite(n) && n > 0);
  const packageCount = courses.reduce((sum, c) => sum + (Array.isArray(c.packages) ? c.packages.length : 0), 0);
  const foundYear = Number(detail.foundYear) || 0;
  const verified = !!detail.verified || !!target.approvedAt;
  const priceRange = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
  const audience = audienceOf(target.audience) || DEFAULT_AUDIENCE.slice();

  return Object.assign({}, target, {
    audience: audience,
    audienceText: audience.join(' / '),
    courseCount: courses.length,
    logo: detail.logo || '🏛️',
    foundYear: foundYear || '',
    foundText: foundYear ? '成立于 ' + foundYear + ' 年' : '成立年份待补充',
    verified: verified,
    licenses: (Array.isArray(detail.licenses) ? detail.licenses : []).map(x => str(x, 60)).filter(Boolean),
    teachers: teachers,
    images: Array.from(imageMap.values()),
    priceRange: priceRange,
    priceRangeText: !priceRange ? '价格待定'
      : priceRange.min === priceRange.max ? '¥' + priceRange.min
      : '¥' + priceRange.min + ' – ' + priceRange.max,
    stats: { courseCount: courses.length, teacherCount: teachers.length, packageCount: packageCount },
    rating: ratingView(target.name),
    courses: courses.map(course => ({
      id: course.id,
      title: course.title || '',
      price: Number(course.price) || 0,
      unit: course.unit || '',
      category: course.category || '',
      icon: course.icon || '📘',
      tone: course.tone || 'peach',
      tag: course.tag || '',
      description: course.description || '',
      learning: course.learning || null,
      packageCount: Array.isArray(course.packages) ? course.packages.length : 0
    }))
  });
}

/* ---------------- 服务字段校验（白名单） ---------------- */
const TONES = ['peach', 'lavender', 'mint'];
const TYPES = ['course', 'tutor', 'bus'];
const SERVICE_EDITABLE = ['title', 'merchant', 'category', 'price', 'unit', 'icon', 'tone', 'tag', 'description', 'location', 'city', 'remaining'];

function validImages(v) {
  return Array.isArray(v) && v.length <= 8 && v.every(i => i && typeof i === 'object' &&
    str(i.name, 60) && ['banner', 'photo', 'icon'].includes(i.kind || 'photo') &&
    (!i.caption || str(i.caption, 120).length <= 120));
}

module.exports = {
  clone, str,
  AUDIENCES, DEFAULT_AUDIENCE, AUDIENCE_HINT,
  normalizeAudience, audienceOf, parentAudience,
  PACKAGE_MAX, PACKAGE_NAME_MAX, PACKAGE_DESC_MAX,
  validVideoUrl, normalizePackages, assignPackageIds, findPackage,
  INSTITUTION_NAME_FIXED, INSTITUTION_FIELDS, normalizeInstitutionPatch,
  institutionId, buildInstitutions, institutionDetailView, applyInstitution,
  RATING_DIMS, ratingSummary, ratingView, starsOf,
  TONES, TYPES, SERVICE_EDITABLE, validImages
};
