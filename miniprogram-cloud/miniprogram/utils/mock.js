/* ------------------------------------------------------------------ *
 * 学鹭伴学 · 本地模拟后端
 *
 * 还没有部署云开发时，小程序用这套模块跑完整业务：数据存在本地存储，
 * 行为与 cloudfunctions/ 下的云函数逐一对应（同样的校验、同样的状态机）。
 * 配置好云开发后，把 utils/config.js 的 USE_CLOUD 改成 true，
 * 所有调用会自动切换到真实云函数，本模块不再参与。
 *
 * 覆盖：账号会话 / 服务目录 / 订单 / 入驻申请 / 机构 / 档案 / 反馈 /
 *       学习资源 / 高考志愿 / 考公考研考编 / 清单 / 定位
 * ------------------------------------------------------------------ */

const seed = require('./seed-data.js');
const lib = require('./institution-lib.js');
const gk = require('./gaokao-model.js');
const plan = require('./plan-model.js');
const ex = require('./exam-model.js');
const assistantData = require('./assistant-data.js');
const config = require('./config.js');

const DB_KEY = config.STORAGE_PREFIX + 'mockdb';
const OPENID_KEY = config.STORAGE_PREFIX + 'openid';

/* 种子数据版本：改动 seed-data.js 的内容后 +1，
 * 老用户本地缓存里的内置服务会按最新代码重建，订单 / 档案等用户数据保留。 */
const SEED_REV = 20261028;

/* ---------------- 本地数据库 ---------------- */
function freshDB() {
  return {
    seedRev: SEED_REV,
    users: [],
    sessions: [],
    services: seed.SEED_SERVICES.map(s => Object.assign({}, s, { builtin: true })),
    orders: [],
    applications: [],
    institutions: [],
    profiles: {},
    uploads: [],
    feedback: [],
    lists: {},
    plans: {}
  };
}

let cache = null;

function db() {
  if (cache) return cache;
  let raw = '';
  try { raw = wx.getStorageSync(DB_KEY) || ''; } catch (e) { raw = ''; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      cache = Object.assign(freshDB(), parsed);
      if (Number(parsed.seedRev || 0) < SEED_REV) {
        /* 种子内容升级：内置服务按最新代码重建，保留用户自建的服务 */
        const custom = (cache.services || []).filter(x => x && !x.builtin);
        cache.services = seed.SEED_SERVICES.map(s => Object.assign({}, s, { builtin: true })).concat(custom);
        cache.seedRev = SEED_REV;
        save();
        return cache;
      }
      /* 种子补齐：升级后新增的种子服务也进来 */
      for (const s of seed.SEED_SERVICES) {
        if (!cache.services.some(x => x.id === s.id)) cache.services.push(Object.assign({}, s, { builtin: true }));
      }
      return cache;
    } catch (e) { /* 数据损坏时重建 */ }
  }
  cache = freshDB();
  save();
  return cache;
}

function save() {
  try { wx.setStorageSync(DB_KEY, JSON.stringify(cache)); } catch (e) { /* 存储不可用 */ }
}

function mutate(fn) {
  const result = fn();
  save();
  return result;
}

function openid() {
  let id = '';
  try { id = wx.getStorageSync(OPENID_KEY) || ''; } catch (e) { id = ''; }
  if (!id) {
    id = 'mock-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { wx.setStorageSync(OPENID_KEY, id); } catch (e) { /* ignore */ }
  }
  return id;
}

function newId(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

/* ---------------- 返回结构（与云函数一致） ---------------- */
function ok(data) { return { code: 0, data: data === undefined ? null : data }; }
function fail(message, code, needLogin) {
  return needLogin ? { code: code || 400, message: message, needLogin: true } : { code: code || 400, message: message };
}
function bad(message, code, needLogin) {
  throw Object.assign(new Error(message), { name: 'BizError', code: code || 400, needLogin: !!needLogin });
}
/* 会话类错误：带 needLogin 标记，客户端只在这种情况清本地令牌 */
function unauthorized(message) { bad(message || '请先登录', 401, true); }

/* ---------------- 口令（本地模拟用轻量加盐散列；云开发模式用 scrypt） ---------------- */
function mockHash(password, salt) {
  let h1 = 0x811c9dc5 >>> 0;
  const input = salt + '|' + password;
  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
    h1 = (h1 + round) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8);
}
function hashPassword(password) {
  const salt = Math.random().toString(36).slice(2, 10);
  return salt + ':' + mockHash(password, salt);
}
function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const idx = stored.indexOf(':');
  if (idx <= 0) return false;
  return mockHash(password, stored.slice(0, idx)) === stored.slice(idx + 1);
}

/* ---------------- 会话 ---------------- */
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function issueSession(userId) {
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
  db().sessions.push({ token, userId, expireAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function resolveUser(event) {
  const token = typeof event.token === 'string' ? event.token : '';
  if (!token) unauthorized('请先登录');
  const store = db();
  const session = store.sessions.find(s => s.token === token);
  if (!session) unauthorized('登录已过期，请重新登录');
  if (!session.expireAt || session.expireAt < Date.now()) {
    store.sessions = store.sessions.filter(s => s.token !== token);
    unauthorized('登录已过期，请重新登录');
  }
  session.expireAt = Date.now() + SESSION_TTL_MS;
  const user = store.users.find(u => u._id === session.userId);
  if (!user) unauthorized('账号不存在，请重新登录');
  return user;
}

/* 升学规划允许游客使用：未登录时按本机 openid 存，登录后随账号走 */
function planKey(event) {
  const token = typeof event.token === 'string' ? event.token : '';
  if (token) {
    const store = db();
    const session = store.sessions.find(s => s.token === token);
    if (session && (!session.expireAt || session.expireAt >= Date.now())) {
      const user = store.users.find(u => u._id === session.userId);
      if (user) return user._id;
    }
  }
  return 'guest:' + openid();
}

/* 平台管理员：令牌与 config.ADMIN_TOKEN 一致即可 */
function isAdmin(event) {
  const configured = typeof config.ADMIN_TOKEN === 'string' ? config.ADMIN_TOKEN.trim() : '';
  const supplied = typeof (event && event.adminToken) === 'string' ? event.adminToken : '';
  return !!configured && supplied === configured;
}

/* ---------------- 机构归属 ---------------- */
function applicationTypeOfRole(role) {
  return role === 'institution' ? '机构' : role === 'tutor' ? '伴学' : null;
}
function roleMatchesApplication(user, application) {
  if (!user || !application) return false;
  /* 私家车入驻面向所有登录用户（须是接送自家孩子的家长） */
  if (application.type === '接送') return application.role === user.role;
  return application.type === applicationTypeOfRole(user.role) && application.role === user.role;
}
function mineApplications(user) {
  if (!user) return [];
  return db().applications.filter(a => roleMatchesApplication(user, a));
}
function latestApplication(user) {
  const list = mineApplications(user);
  if (!list.length) return null;
  const rank = a => (a.status === 'approved' ? 2 : a.status === 'pending' ? 1 : 0);
  return list.slice().sort((a, b) => rank(b) - rank(a) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}
function institutionIdOfUser(user) {
  if (!user || user.role !== 'institution') return null;
  const hit = mineApplications(user).find(a => a.status === 'approved' && roleMatchesApplication(user, a));
  if (!hit) return null;
  return hit.institutionId || lib.institutionId(hit.institutionName || hit.name);
}
function approvedInstitutions() {
  return db().applications
    .filter(a => a.status === 'approved' && a.type === '机构' && a.institutionId)
    .map(a => ({
      id: a.institutionId,
      name: a.institutionName || a.name,
      contact: a.contact || '',
      phone: a.phone || '',
      audience: Array.isArray(a.audience) ? a.audience.slice() : null,
      approvedAt: a.approvedAt || a.createdAt || null
    }));
}
function institutionBinding(user) {
  if (!user || user.role !== 'institution') return null;
  const application = latestApplication(user);
  if (!application || application.status !== 'approved') return null;
  const boundId = institutionIdOfUser(user);
  if (!boundId) return null;
  return { institutionId: boundId, name: application.institutionName || application.name };
}

/* ---------------- 日期 ---------------- */
const WEEKDAYS = { 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 0 };
const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function cnToday() {
  const now = new Date();
  const cn = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
  const pad = n => String(n).padStart(2, '0');
  return cn.getFullYear() + '-' + pad(cn.getMonth() + 1) + '-' + pad(cn.getDate());
}
function weekdayOf(date) { return new Date(date + 'T00:00:00Z').getUTCDay(); }
function weekdayLabel(date) { return WEEKDAY_LABEL[weekdayOf(date)]; }
function slotWeekday(slot) {
  const m = /^(周[一二三四五六日])\s*/.exec(typeof slot === 'string' ? slot : '');
  return m ? m[1] : null;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/* ---------------- 服务目录 ---------------- */
const TUTOR_SLOTS = seed.TUTOR_SLOTS;

function catalog() {
  const map = new Map(seed.SEED_SERVICES.map(s => [s.id, lib.clone(s)]));
  for (const custom of db().services) {
    if (!custom || typeof custom.id !== 'string') continue;
    if (map.has(custom.id)) map.set(custom.id, Object.assign({}, map.get(custom.id), lib.clone(custom)));
    else map.set(custom.id, Object.assign({}, lib.clone(custom), { builtin: false }));
  }
  return [...map.values()];
}
function findService(list, id) { return (Array.isArray(list) ? list : []).find(s => s.id === id) || null; }
function serviceSlots(s) {
  return Array.isArray(s && s.calendar && s.calendar.slots) ? s.calendar.slots : (s && s.type === 'tutor' ? [...TUTOR_SLOTS] : []);
}
function institutionsOf(services) {
  return lib.buildInstitutions(services, db().institutions, approvedInstitutions());
}
function soldCounts() {
  const counts = {};
  for (const o of db().orders) {
    if (['paid', 'completed'].includes(o.status)) counts[o.serviceId] = (counts[o.serviceId] || 0) + 1;
  }
  return counts;
}
function decorate(s, institutions, sold) {
  const used = sold[s.id] || 0;
  let out = Object.assign({}, s, { remaining: Number(s.remaining || 0) - used });
  if (s.type === 'tutor' && !out.calendar) {
    out.calendar = { mode: 'slot', slotDurationMinutes: 60, slots: [...TUTOR_SLOTS], note: '仅开放固定时段，暂不支持指定日期。' };
  }
  if (s.type === 'bus' && !out.busDetail && Array.isArray(out.routes)) {
    out.busDetail = { driver: out.driver, plate: out.plate, period: out.period, routes: out.routes };
  }
  if (!out.images) out.images = [];
  if (out.type === 'course') {
    out.packages = Array.isArray(out.packages) ? out.packages : [];
    /* 服务人群跟随所属机构，未设置时由前端按「家长可见」处理 */
    const owner = institutions.find(i => i.name === (out.merchant || '').trim());
    out.audience = lib.audienceOf(owner && owner.audience) || lib.audienceOf(out.audience);
  } else delete out.packages;
  out = lib.applyInstitution(out, institutions);
  if (out.type === 'course' && (!out.merchantDetail || !out.merchantDetail.name)) {
    out.merchantDetail = Object.assign({}, out.merchantDetail || {}, { name: out.merchant });
  }
  return out;
}

/* 订单占用的「日期+时段」 */
function orderSessions(o) {
  if (Array.isArray(o.sessions) && o.sessions.length) {
    return o.sessions.filter(x => x && typeof x.date === 'string' && typeof x.slot === 'string');
  }
  if (o.type === 'tutor' && o.slot) return [{ date: typeof o.date === 'string' ? o.date : '', slot: o.slot }];
  return [];
}
const isActiveOrder = o => ['paid', 'completed'].includes(o.status);

/* ---------------- 学习资源标签 ---------------- */
const LEARNING_KINDS = [
  { id: 'gwy', name: '考公', subjects: ['行政职业能力测验', '申论', '面试'] },
  { id: 'ky', name: '考研', subjects: ['政治', '英语', '数学', '专业课'] },
  { id: 'sb', name: '考编', subjects: ['公共基础知识', '职业能力测验', '综合应用能力', '面试'] },
  { id: 'zk', name: '职考技能', subjects: ['教师资格', '会计实务', '建筑工程', '社会工作', '健康管理', '人力资源', '计算机等级'] }
];
/* 机构选了「大学生」但课程没选考试方向时归到这里，课程不会因此消失 */
const OTHER_KIND = { id: 'other', name: '其他课程', subjects: ['通用课程'] };
const ALL_LEARNING_KINDS = LEARNING_KINDS.concat([OTHER_KIND]);
function validLearning(value) {
  const found = LEARNING_KINDS.find(k => k.id === (value && value.kind));
  return !!found && found.subjects.includes(value && value.subject);
}
function normalizeLearning(value) {
  if (value === undefined || value === null || value === '') return null;
  const kind = typeof value.kind === 'string' ? value.kind.trim() : '';
  const found = LEARNING_KINDS.find(k => k.id === kind);
  if (!found) bad('课程方向须为' + LEARNING_KINDS.map(k => k.name).join('、'));
  const subject = typeof value.subject === 'string' ? value.subject.trim() : '';
  if (!found.subjects.includes(subject)) bad('请选择' + found.name + '的有效科目');
  return { kind, subject };
}
/* 学习资源：已审核机构的课程，按考试方向归类；没有方向但选了大学生人群的归「其他课程」 */
function learningResources(services, institutions, approvedNames) {
  const verified = new Set((approvedNames || []).map(n => String(n).trim()).filter(Boolean));
  /* 平台自营与种子课程随平台一起上线，视为已完成审核 */
  const official = new Set(seed.SEED_SERVICES.map(s => s.id));
  return services.flatMap(service => {
    const name = typeof service.merchant === 'string' ? service.merchant.trim() : '';
    const trusted = verified.has(name) || official.has(service.id);
    if (service.type !== 'course' || !trusted) return [];
    const institution = institutions.find(i => i.name === name) || {};
    const audience = Array.isArray(institution.audience) ? institution.audience : null;
    const learning = validLearning(service.learning)
      ? { kind: service.learning.kind, subject: service.learning.subject }
      : null;
    /* 只选了「家长」的机构课程不进入学习资源 */
    if (audience && !audience.includes('大学生')) return [];
    /* 旧数据既没人群也没方向时沿用原规则：不收录 */
    if (!learning && !audience) return [];
    const found = learning ? LEARNING_KINDS.find(k => k.id === learning.kind) : OTHER_KIND;
    return [{
      id: service.id, title: service.title, merchant: name,
      kind: found.id, kindName: found.name,
      subject: learning ? learning.subject : OTHER_KIND.subjects[0],
      category: service.category || '', description: service.description || '',
      price: service.price, unit: service.unit, location: service.location || '',
      icon: service.icon || '📚', tone: service.tone || 'mint',
      packages: Array.isArray(service.packages) ? service.packages.length : 0,
      institution: { name, address: institution.address || '', intro: institution.intro || '' }
    }];
  });
}

/* ---------------- 入参校验 ---------------- */
const PHONE_RE = /^1\d{10}$/;
function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function requirePhone(value, label) {
  const v = text(value, 20);
  if (!PHONE_RE.test(v)) bad((label || '手机号') + '须为 11 位手机号');
  return v;
}
function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) bad('密码长度须为 8–128 位');
  return value;
}
function requireRole(value) {
  const v = text(value, 20);
  if (!['parent', 'tutor', 'institution'].includes(v)) bad('请选择有效的账号类型：家长 / 大学生 / 机构');
  return v;
}

/* ---------------- 服务补丁校验（与云函数一致） ---------------- */
const TONES = ['peach', 'lavender', 'mint'];
const TYPES = ['course', 'tutor', 'bus'];
const SERVICE_EDITABLE = ['title', 'merchant', 'category', 'price', 'unit', 'icon', 'tone', 'tag', 'description', 'location', 'city', 'remaining'];
const PERIODS = ['月付', '学期付', '季付'];
const BUS_PERIOD = '月付';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOT_MAX = 30, SLOT_TEXT_MAX = 60, SLOT_DURATION = 60, SESSION_MAX = 20;
const timeToMinutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function validImages(v) {
  return Array.isArray(v) && v.length <= 8 && v.every(i => i && typeof i === 'object' &&
    text(i.name, 60) && ['banner', 'photo', 'icon'].includes(i.kind || 'photo') &&
    (!i.caption || text(i.caption, 120).length <= 120));
}
function validateCalendar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) bad('排期格式不正确');
  for (const key of Object.keys(input)) {
    if (!['slots', 'mode', 'slotDurationMinutes'].includes(key)) bad('不支持的排期字段：' + key);
  }
  if (!Array.isArray(input.slots)) bad('排期时段须为字符串数组');
  if (input.slots.length < 1) bad('至少需要 1 个可约时段');
  if (input.slots.length > SLOT_MAX) bad('可约时段最多 ' + SLOT_MAX + ' 条');
  const slots = [];
  const seen = new Set();
  for (const raw of input.slots) {
    if (typeof raw !== 'string') bad('排期时段须为字符串');
    if (!raw || raw.length > SLOT_TEXT_MAX || raw.trim() !== raw) bad('时段不能为空、不含首尾空格，且每条最多 ' + SLOT_TEXT_MAX + ' 字');
    if (seen.has(raw)) bad('可约时段不能重复：' + raw);
    seen.add(raw);
    slots.push(raw);
  }
  if (input.mode !== undefined && input.mode !== 'slot') bad('排期模式仅支持固定时段（slot）');
  if (input.slotDurationMinutes !== undefined && Number(input.slotDurationMinutes) !== SLOT_DURATION) {
    bad('当前仅支持 ' + SLOT_DURATION + ' 分钟时长的时段');
  }
  return { mode: 'slot', slotDurationMinutes: SLOT_DURATION, slots };
}
function normalizeServicePatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('服务内容格式不正确');
  const allowed = new Set([...SERVICE_EDITABLE, 'type', 'tutorDetail', 'busDetail', 'pickupDetail', 'images', 'merchantDetail', 'calendar', 'packages', 'learning']);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) bad('不支持的字段：' + key);
  const out = {};
  if (raw.type !== undefined && !TYPES.includes(raw.type)) bad('请选择有效的服务类型');
  for (const key of SERVICE_EDITABLE) {
    if (raw[key] === undefined) continue;
    if (key === 'price') {
      const n = Number(raw[key]);
      if (!Number.isFinite(n) || n <= 0 || n > 100000) bad('价格须为 0.01–100000 元');
      out.price = Math.round(n * 100) / 100;
      continue;
    }
    if (key === 'remaining') {
      const n = Number(raw[key]);
      if (!Number.isInteger(n) || n < 0 || n > 10000) bad('名额须为 0–10000 的整数');
      out.remaining = n;
      continue;
    }
    if (key === 'tone') { if (!TONES.includes(raw.tone)) bad('请选择有效的配色'); out.tone = raw.tone; continue; }
    if (key === 'icon') { const v = text(raw.icon, 4); if (!v) bad('请填写图标'); out.icon = v; continue; }
    const max = key === 'description' ? 1000 : key === 'title' ? 40 : key === 'city' ? 20 : 100;
    const v = text(raw[key], max);
    if (!v) bad('请填写' + key);
    out[key] = v;
  }
  if (raw.images !== undefined) {
    if (!validImages(raw.images)) bad('图片来源必须是 name + kind + tone/caption 的对象数组，最多 8 条');
    out.images = raw.images.map(i => ({
      name: text(i.name, 60), kind: i.kind || 'photo',
      tone: TONES.includes(i.tone) ? i.tone : 'peach', caption: text(i.caption, 120)
    }));
  }
  if (raw.learning !== undefined) out.learning = normalizeLearning(raw.learning);
  if (raw.tutorDetail !== undefined) {
    const t = raw.tutorDetail;
    if (!t || typeof t !== 'object' || Array.isArray(t)) bad('伴学资料格式不正确');
    const td = {};
    for (const key of ['name', 'school', 'major', 'education', 'experience', 'intro', 'certificate', 'grades']) {
      if (t[key] === undefined) continue;
      const v = text(t[key], 100);
      if (!v) bad('伴学资料字段不能为空：' + key);
      td[key] = v;
    }
    for (const key of ['subjects', 'methods']) {
      if (t[key] === undefined) continue;
      if (!Array.isArray(t[key]) || t[key].length > 10) bad('伴学' + key + '须为数组，最多 10 项');
      const list = t[key].map(x => text(x, 30));
      if (list.some(x => !x)) bad('伴学' + key + '不能包含空值');
      td[key] = list;
    }
    if (t.rating !== undefined) {
      const r = t.rating;
      if (!r || typeof r !== 'object' || Array.isArray(r)) bad('伴学星级格式不正确');
      const score = Number(r.score);
      const count = Number(r.count);
      if (!Number.isFinite(score) || score < 0 || score > 5) bad('伴学星级须为 0–5');
      if (r.count !== undefined && (!Number.isInteger(count) || count < 0 || count > 100000)) bad('评价数须为非负整数');
      td.rating = { score: Math.round(score * 10) / 10, count: Number.isInteger(count) ? count : 0 };
    }
    out.tutorDetail = td;
  }
  if (raw.busDetail !== undefined) {
    const bd = raw.busDetail;
    if (!bd || typeof bd !== 'object' || Array.isArray(bd)) bad('校车资料格式不正确');
    const out2 = {};
    for (const key of ['driver', 'plate', 'vehicle', 'phone']) {
      if (bd[key] === undefined) continue;
      const v = text(bd[key], 60);
      if (!v) bad('校车资料字段不能为空：' + key);
      out2[key] = v;
    }
    if (bd.period !== undefined) {
      if (!Array.isArray(bd.period) || !bd.period.length || bd.period.length > 5) bad('订购周期须为 1–5 项数组');
      const list = bd.period.map(x => text(x, 10));
      if (list.some(x => !PERIODS.includes(x))) bad('订购周期只能为：' + PERIODS.join('、'));
      if (list.some(x => x !== BUS_PERIOD)) bad('当前仅支持月付计价，订购周期不能包含学期付或季付');
      out2.period = [...new Set(list)];
    }
    if (bd.routes !== undefined) {
      if (!Array.isArray(bd.routes) || bd.routes.length < 2 || bd.routes.length > 20) bad('线路须为 2–20 个站点');
      const stationOf = new Map();
      const routes = bd.routes.map(r => {
        if (!r || typeof r !== 'object') bad('站点格式不正确');
        const name = text(r.name, 40), arrival = text(r.arrival, 5), departure = text(r.departure, 5);
        if (!name) bad('站点名称不能为空');
        if (stationOf.has(name)) bad('站点名称重复：' + name);
        if (!TIME.test(arrival) || !TIME.test(departure)) bad('站点到达/出发时间须为 HH:mm');
        if (timeToMinutes(departure) < timeToMinutes(arrival)) bad('站点出发时间不能早于到达时间：' + name);
        for (const prev of stationOf.values()) {
          if (timeToMinutes(arrival) < timeToMinutes(prev.departure)) bad('站点到达时间不能早于上一站出发时间：' + name);
        }
        stationOf.set(name, { arrival, departure });
        return { name, arrival, departure };
      });
      out2.routes = routes;
    }
    out.busDetail = out2;
  }
  if (raw.pickupDetail !== undefined) {
    const pd = raw.pickupDetail;
    if (!pd || typeof pd !== 'object' || Array.isArray(pd)) bad('帮忙接资料格式不正确');
    const out3 = {};
    for (const key of ['person', 'gender', 'area', 'school', 'childGrade', 'schoolGate', 'timeText', 'vehicle', 'credit', 'note']) {
      if (pd[key] === undefined) continue;
      out3[key] = text(pd[key], 120);
    }
    if (pd.kind !== undefined) {
      if (pd.kind !== 'car' && pd.kind !== 'pickup') bad('帮忙接类型不正确');
      out3.kind = pd.kind;
    }
    if (!out3.person) bad('请填写接送人姓名');
    for (const [key, min, max] of [['years', 0, 60], ['seat', 1, 6], ['used', 0, 6]]) {
      if (pd[key] === undefined) continue;
      const n = Number(pd[key]);
      if (!Number.isInteger(n) || n < min || n > max) bad('帮忙接人数须为 ' + min + '–' + max + ' 的整数');
      out3[key] = n;
    }
    if (out3.used !== undefined && out3.seat !== undefined && out3.used > out3.seat) bad('已接人数不能超过可接人数');
    if (pd.idChecked !== undefined) out3.idChecked = !!pd.idChecked;
    if (pd.routes !== undefined) {
      if (!Array.isArray(pd.routes) || pd.routes.length < 2 || pd.routes.length > 6) bad('帮忙接的接送点须为 2–6 个');
      out3.routes = pd.routes.map(r => {
        if (!r || typeof r !== 'object' || Array.isArray(r)) bad('接送点格式不正确');
        const name = text(r.name, 40);
        if (!name) bad('接送点名称不能为空');
        return { name: name, arrival: text(r.arrival, 5), departure: text(r.departure, 5) };
      });
    }
    out.pickupDetail = out3;
  }
  if (raw.merchantDetail !== undefined) {
    const md = raw.merchantDetail;
    if (!md || typeof md !== 'object' || Array.isArray(md)) bad('机构资料格式不正确');
    const info = {};
    for (const key of ['name', 'logo', 'intro', 'address', 'contact', 'phone']) {
      if (md[key] === undefined) continue;
      const v = text(md[key], key === 'intro' ? 500 : 100);
      if (!v) bad('机构资料字段不能为空：' + key);
      info[key] = v;
    }
    if (md.foundYear !== undefined) {
      const y = Number(md.foundYear);
      if (!Number.isInteger(y) || y < 1900 || y > 2100) bad('成立年份不合法');
      info.foundYear = y;
    }
    if (md.verified !== undefined) {
      if (typeof md.verified !== 'boolean') bad('认证状态须为布尔值');
      info.verified = md.verified;
    }
    for (const key of ['licenses', 'teachers']) {
      if (md[key] === undefined) continue;
      if (!Array.isArray(md[key]) || md[key].length > 20) bad('机构' + key + '须为数组，最多 20 项');
      const list = md[key].map(x => text(x, 100));
      if (list.some(x => !x)) bad('机构' + key + '不能包含空值');
      info[key] = list;
    }
    out.merchantDetail = info;
  }
  if (raw.calendar !== undefined) out.calendar = validateCalendar(raw.calendar);
  if (raw.packages !== undefined) out.packages = lib.normalizePackages(raw.packages);
  return out;
}
function mergeDetail(prev, patch) {
  const seen = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {};
  if (!patch || typeof patch !== 'object' || !Object.keys(patch).length) return seen;
  const out = Object.assign({}, seen);
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof seen[k] === 'object' && seen[k] !== null && !Array.isArray(seen[k])) {
      out[k] = Object.assign({}, seen[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
function mergedCalendar(prev, input) {
  const seen = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {};
  const out = Object.assign({}, seen);
  if (Array.isArray(seen.slots)) out.slots = [...seen.slots];
  out.mode = input.mode || seen.mode || 'slot';
  if (Number(input.slotDurationMinutes) === SLOT_DURATION) out.slotDurationMinutes = SLOT_DURATION;
  else if (seen.slotDurationMinutes !== undefined) out.slotDurationMinutes = seen.slotDurationMinutes;
  if (input.slots !== undefined) out.slots = [...input.slots];
  if (out.note === undefined) out.note = '仅开放固定时段，暂不支持指定日期。';
  return out;
}
function cloudVideoIds(packages) {
  const ids = [];
  for (const item of Array.isArray(packages) ? packages : []) {
    if (item && typeof item.videoUrl === 'string' && item.videoUrl.startsWith('cloud://')) ids.push(item.videoUrl);
  }
  return ids;
}

/* 剥掉信封字段（token/action/id），剩下的才是业务补丁 */
function strip(event) {
  const out = {};
  for (const [k, v] of Object.entries(event || {})) {
    if (k === 'token' || k === 'action' || k === 'id') continue;
    out[k] = v;
  }
  return out;
}

/* ---------------- 订单校验 ---------------- */
const RELATIONS = ['父亲', '母亲', '家长', '祖父母', '其他监护人'];
const GENDERS = ['男', '女', '未填写'];

function validateExtra(s, b) {
  const out = {};
  const guardian = text(b.guardian, 30);
  if (guardian) out.guardian = guardian;
  const relation = text(b.relation, 20);
  if (relation) {
    if (!RELATIONS.includes(relation)) bad('请选择有效的监护人关系');
    out.relation = relation;
  }
  const phone = text(b.guardianPhone, 20);
  if (phone) {
    if (!PHONE_RE.test(phone)) bad('监护人手机号格式不正确');
    out.guardianPhone = phone;
  }
  if (b.age !== undefined && b.age !== null && b.age !== '') {
    const n = Number(b.age);
    if (!Number.isInteger(n) || n < 1 || n > 99) bad('学员年龄须为 1–99 的整数');
    out.age = n;
  }
  const gender = text(b.gender, 10);
  if (gender) {
    if (!GENDERS.includes(gender)) bad('请选择有效的性别');
    out.gender = gender;
  }
  const address = text(b.address, 200);
  if (address) out.address = address;
  if (s.type === 'bus') {
    const route = (s.busDetail && s.busDetail.routes) || s.routes || [];
    const start = text(b.startPoint, 60), end = text(b.endPoint, 60);
    if (start || end) {
      if (!start || !end) bad('请同时选择上车站点和下车站点');
      const names = route.map(r => r.name);
      const i = names.indexOf(start), j = names.indexOf(end);
      if (i < 0) bad('上车站点不在该线路内');
      if (j < 0) bad('下车站点不在该线路内');
      if (j <= i) bad('下车站点必须位于上车站点之后');
      out.startPoint = start;
      out.endPoint = end;
    }
    const period = text(b.period, 10);
    if (period) {
      if (!PERIODS.includes(period)) bad('请选择有效的订购周期');
      if (period !== BUS_PERIOD) bad('当前仅支持月付计价，暂不支持学期付/季付');
      const allowed = (s.busDetail && s.busDetail.period) || s.period || PERIODS;
      if (!allowed.includes(period)) bad('该线路不支持所选订购周期');
      out.period = period;
    }
  }
  if (s.type === 'course') {
    const date = text(b.date, 10);
    if (date) {
      if (!validDate(date)) bad('请选择有效的上课日期');
      out.date = date;
    }
  }
  if (s.type === 'tutor') {
    const date = text(b.date, 10);
    if (date) {
      if (!validDate(date)) bad('请选择有效的预约日期');
      out.date = date;
      out.dateStatus = 'requested';
    }
  }
  return out;
}

function validateSessions(s, input) {
  if (!Array.isArray(input)) bad('预约时段须为数组');
  if (input.length < 1) bad('请至少选择 1 个预约时段');
  if (input.length > SESSION_MAX) bad('一次最多预约 ' + SESSION_MAX + ' 个时段');
  const available = serviceSlots(s);
  const today = cnToday();
  const seen = new Set();
  const sessions = input.map((raw, index) => {
    const at = '第 ' + (index + 1) + ' 个预约时段';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad(at + '格式不正确');
    for (const key of Object.keys(raw)) if (!['date', 'slot'].includes(key)) bad(at + '不支持字段：' + key);
    const date = text(raw.date, 10), slot = typeof raw.slot === 'string' ? raw.slot : '';
    if (!validDate(date)) bad(at + '的日期格式应为 YYYY-MM-DD 且真实存在');
    if (date < today) bad(at + '的日期已过，请选择今天或之后的日期');
    if (!slot) bad(at + '缺少时段');
    if (!available.includes(slot)) bad('请选择有效的预约时段');
    const weekday = slotWeekday(slot);
    if (!weekday) bad('该时段未配置星期，暂不支持按日期预约：' + slot);
    if (WEEKDAYS[weekday] !== weekdayOf(date)) bad(at + '的日期 ' + date + ' 是' + weekdayLabel(date) + '，与时段「' + slot + '」不一致');
    const key = date + '|' + slot;
    if (seen.has(key)) bad('预约时段重复：' + date + ' ' + slot);
    seen.add(key);
    return { date, slot };
  });
  sessions.sort((a, b) => (a.date === b.date
    ? serviceSlots(s).indexOf(a.slot) - serviceSlots(s).indexOf(b.slot)
    : a.date < b.date ? -1 : 1));
  return sessions;
}

/* ---------------- 各云函数的模拟实现 ---------------- */
/* ---------------- 升学规划：档案与元数据 ---------------- */
const PLAN_META = {
  grades: plan.GRADES,
  provinces: plan.PROVINCES.map(p => p.name),
  firstSubjects: plan.FIRST_SUBJECTS,
  secondSubjects: plan.SECOND_SUBJECTS,
  tiers: plan.TARGET_TIERS,
  interests: plan.INTERESTS
};

/* 已存档案与默认值合并，脏数据（比如旧版本字段）不会让页面崩掉 */
function planProfileOf(record) {
  const base = plan.defaultProfile();
  const saved = record && record.profile && typeof record.profile === 'object' ? record.profile : {};
  const merged = Object.assign({}, base, saved);
  if (!plan.isGrade(merged.grade)) merged.grade = base.grade;
  if (!plan.isProvinceName(merged.province)) merged.province = base.province;
  if (!plan.FIRST_SUBJECTS.includes(merged.first)) merged.first = base.first;
  if (!Array.isArray(merged.second) || merged.second.length !== 2) merged.second = base.second;
  if (!plan.TARGET_TIERS.includes(merged.targetTier)) merged.targetTier = base.targetTier;
  if (!Array.isArray(merged.interest) || !merged.interest.length) merged.interest = base.interest;
  return merged;
}

const handlers = {

  /* ---------- 账号 ---------- */
  auth(event) {
    const action = event.action;
    const store = db();
    if (action === 'wxLogin') {
      const user = store.users.find(u => u.openid === openid());
      if (!user) return ok({ authenticated: false, needLogin: true });
      return ok({
        authenticated: true,
        user: publicUser(user),
        token: issueSession(user._id),
        application: applicationBrief(user),
        institutionId: institutionIdOfUser(user)
      });
    }
    if (action === 'register') {
      const phone = requirePhone(event.phone, '手机号');
      const password = requirePassword(event.password);
      const role = requireRole(event.role);
      if (store.users.some(u => u.phone === phone)) return fail('该手机号已注册，请直接登录', 409);
      const id = newId('u');
      const user = {
        _id: id, phone, role, openid: openid(),
        passwordHash: hashPassword(password), createdAt: new Date().toISOString()
      };
      return mutate(() => {
        store.users.push(user);
        return ok({ user: publicUser(user), token: issueSession(id) });
      });
    }
    if (action === 'login') {
      const phone = requirePhone(event.phone, '手机号');
      const password = typeof event.password === 'string' ? event.password : '';
      const user = store.users.find(u => u.phone === phone);
      const pass = user ? verifyPassword(password, user.passwordHash) : false;
      if (!pass) return fail('手机号或密码不正确', 401);
      if (openid() && user.openid !== openid()) user.openid = openid();
      return mutate(() => ok({
        user: publicUser(user),
        token: issueSession(user._id),
        application: applicationBrief(user),
        institutionId: institutionIdOfUser(user)
      }));
    }
    if (action === 'me') {
      const user = resolveUser(event);
      return ok({
        authenticated: true,
        user: publicUser(user),
        application: applicationBrief(user),
        institutionId: institutionIdOfUser(user)
      });
    }
    if (action === 'logout') {
      const token = typeof event.token === 'string' ? event.token : '';
      store.sessions = store.sessions.filter(s => s.token !== token);
      save();
      return ok({ ok: true });
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 服务目录 ---------- */
  services(event) {
    const action = event.action;
    if (action === 'list') {
      const list = catalog();
      const institutions = institutionsOf(list);
      const sold = soldCounts();
      const decorated = list.map(s => decorate(s, institutions, sold));
      const type = text(event.type, 10);
      return ok(type ? decorated.filter(s => s.type === type) : decorated);
    }
    if (action === 'availability') {
      const id = text(event.id, 64);
      const s = findService(catalog(), id);
      if (!s) bad('服务不存在', 404);
      if (s.type !== 'tutor') bad('仅伴学服务支持按日期查询可约时段');
      const date = text(event.date, 10);
      if (!date) bad('请提供查询日期 date=YYYY-MM-DD');
      if (!validDate(date)) bad('日期格式应为 YYYY-MM-DD 且真实存在');
      const weekday = weekdayLabel(date);
      const taken = new Set();
      for (const o of db().orders) {
        if (o.serviceId !== id || !isActiveOrder(o)) continue;
        for (const item of orderSessions(o)) if (item.date === date) taken.add(item.slot);
      }
      const slots = serviceSlots(s).filter(slot => slotWeekday(slot) === weekday);
      return ok({ date, slots: slots.map(slot => ({ slot, available: !taken.has(slot) })) });
    }
    if (action === 'create' || action === 'update') {
      const user = resolveUser(event);
      const binding = institutionBinding(user);
      if (!binding) bad('仅已审核通过的机构账号可以发布或修改课程', 403);
      const raw = strip(event);
      if (action === 'create') {
        if (!TYPES.includes(raw.type)) bad('请选择有效的服务类型');
        if (raw.type !== 'course' && raw.packages !== undefined) bad('仅课程服务支持套餐');
        if (raw.type !== 'course') bad('机构账号只能发布课程', 403);
      }
      const patch = normalizeServicePatch(raw);
      if (raw.merchant !== undefined && text(raw.merchant, 100) !== binding.name) bad('课程只能发布到自己机构名下', 403);
      patch.merchant = binding.name;
      if (action === 'create') {
        for (const key of ['title', 'merchant', 'category', 'price', 'unit']) {
          if (patch[key] === undefined && raw[key] === undefined) bad('缺少字段：' + key);
        }
      }
      if (patch.packages !== undefined) {
        const allowed = new Set(db().uploads.filter(u => u.institutionId === binding.institutionId).map(u => u.fileID));
        for (const fileID of cloudVideoIds(patch.packages)) {
          if (!allowed.has(fileID)) bad('只能引用本机构上传的课程视频', 403);
        }
      }
      const store = db();
      if (action === 'create') {
        const id = newId('svc');
        const now = new Date().toISOString();
        const doc = Object.assign({}, patch, {
          id, type: raw.type,
          icon: patch.icon || '📘', tone: patch.tone || 'peach',
          unit: patch.unit || '课时', tag: patch.tag || '自定义',
          description: patch.description || '', location: patch.location || '演示地址',
          city: patch.city || '哈尔滨',
          remaining: patch.remaining === undefined ? 10 : patch.remaining,
          builtin: false, createdAt: now, updatedAt: now
        });
        for (const key of ['title', 'merchant', 'category']) {
          if (!doc[key] || doc[key] === '') bad('请填写' + key);
        }
        if (doc.type === 'course' && patch.packages !== undefined) {
          doc.packages = lib.assignPackageIds(patch.packages, () => newId('pkg'));
        }
        return mutate(() => {
          store.services.push(doc);
          return ok(decoratedResult(doc));
        });
      }
      const id = text(event.id, 64);
      const current = findService(catalog(), id);
      if (!current) bad('服务不存在', 404);
      if (current.type !== 'course') bad('机构账号只能修改课程', 403);
      if (current.merchant !== binding.name) bad('只能修改自己机构名下的课程', 403);
      if (raw.merchant !== undefined && text(raw.merchant, 100) !== binding.name) bad('不能把课程转到其他机构名下', 403);
      const existing = store.services.find(s => s.id === id);
      const base = existing ? Object.assign({}, existing) : { type: current.type };
      const next = Object.assign({}, base, patch, { id, updatedAt: new Date().toISOString() });
      if (patch.images !== undefined) next.images = patch.images;
      else if (base.images === undefined && current.images !== undefined) next.images = lib.clone(current.images);
      for (const key of ['tutorDetail', 'busDetail', 'merchantDetail']) {
        if (patch[key] !== undefined) next[key] = mergeDetail(base[key] || current[key], patch[key]);
      }
      if (patch.calendar !== undefined) next.calendar = mergedCalendar(base.calendar || current.calendar, patch.calendar);
      if (patch.packages !== undefined) next.packages = lib.assignPackageIds(patch.packages, () => newId('pkg'));
      delete next.builtin;
      return mutate(() => {
        if (existing) Object.assign(existing, next);
        else store.services.push(next);
        return ok(decoratedResult(Object.assign({}, current, next)));
      });
    }
    if (action === 'tempUrl') {
      /* 本地模拟没有云存储：http(s) 地址原样返回，cloud:// 标记为不可用 */
      const fileIDs = Array.isArray(event.fileIDs) ? event.fileIDs : [];
      return ok(fileIDs.map(f => ({
        fileID: f,
        tempFileURL: /^https?:/.test(f) ? f : '',
        status: /^https?:/.test(f) ? 0 : -1
      })));
    }
    if (action === 'recordVideo') {
      const user = resolveUser(event);
      const binding = institutionBinding(user);
      if (!binding) bad('仅已审核通过的机构账号可以上传课程视频', 403);
      const fileID = text(event.fileID, 300);
      if (!fileID.startsWith('cloud://')) bad('视频文件 ID 不正确');
      const store = db();
      return mutate(() => {
        store.uploads.push({
          fileID, name: text(event.name, 200), size: Number(event.size) || 0,
          type: text(event.type, 60), institutionId: binding.institutionId,
          userId: user._id, createdAt: new Date().toISOString()
        });
        return ok({ fileID });
      });
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 订单 ---------- */
  orders(event) {
    const action = event.action;
    const store = db();
    if (action === 'list') {
      /* 平台管理：管理员可查看全部订单 */
      if (event.all) {
        if (!isAdmin(event)) return fail('需要平台管理员令牌', 403);
        return ok(store.orders.slice());
      }
      const user = resolveUser(event);
      return ok(store.orders.filter(o => o.userId === user._id));
    }
    if (action === 'create') {
      const user = resolveUser(event);
      const b = event;
      const list = catalog();
      const s = findService(list, b.serviceId);
      if (!s) bad('服务不存在', 404);
      const student = text(b.student, 30), phone = text(b.phone, 20);
      if (!student || !PHONE_RE.test(phone)) bad('请填写学生姓名和有效的 11 位手机号');
      const slots = serviceSlots(s);
      const multi = b.sessions !== undefined;
      if (multi && s.type !== 'tutor') bad('仅伴学服务支持按日期多时段预约');
      if (multi && b.slot !== undefined) bad('多时段预约请通过 sessions 提交时段，不要同时传 slot');
      const sessions = multi ? validateSessions(s, b.sessions) : null;
      if (!multi && s.type === 'tutor') {
        const slot = text(b.slot, 60);
        if (!slots.includes(slot)) bad('请选择有效的预约时段');
        if (b.date !== undefined && b.date !== null && b.date !== '') {
          const weekday = slotWeekday(slot);
          if (!weekday) bad('该时段未配置星期，暂不支持按日期预约：' + slot);
          const day = text(b.date, 10);
          if (validDate(day) && day > cnToday() && WEEKDAYS[weekday] !== weekdayOf(day)) bad('预约日期与所选时段的星期不一致');
        }
      }
      const extra = validateExtra(s, b);
      let chosen = null;
      const packageId = b.packageId === undefined || b.packageId === null || b.packageId === '' ? '' : text(b.packageId, 64);
      if (packageId) {
        if (s.type !== 'course') bad('仅课程服务支持选择套餐');
        chosen = lib.findPackage(s, packageId);
        if (!chosen) bad('套餐不存在或已下架', 404);
      }
      return mutate(() => {
        const order = {
          _id: newId('o'), id: newId('o'), number: 'ED' + Date.now(),
          serviceId: s.id, title: s.title, type: s.type, student, phone,
          amount: chosen ? chosen.price : s.price, status: 'pending',
          createdAt: new Date().toISOString(), ...extra
        };
        order.userId = user._id;
        if (s.type === 'tutor') order.slotsSnapshot = [...slots];
        if (s.type === 'bus') {
          order.busPeriodSnapshot = Array.isArray(s.busDetail && s.busDetail.period)
            ? [...s.busDetail.period] : (Array.isArray(s.period) ? [...s.period] : []);
        }
        if (chosen) {
          order.packageId = chosen.id;
          order.packageSnapshot = {
            id: chosen.id, name: chosen.name, price: chosen.price,
            lessons: chosen.lessons, description: chosen.description,
            ...(chosen.videoUrl ? { videoUrl: chosen.videoUrl } : {})
          };
          order.amount = Math.round(chosen.price * 100) / 100;
        }
        if (multi) {
          order.dateStatus = 'scheduled';
          order.sessions = sessions.map(x => ({ date: x.date, slot: x.slot }));
          order.hours = sessions.length * SLOT_DURATION / 60;
          order.unitPrice = s.price;
          order.amount = Math.round(s.price * sessions.length);
          delete order.date;
        }
        store.orders.unshift(order);
        return ok(order);
      });
    }
    const orderId = text(event.id, 64);
    if (action === 'pay' || action === 'cancel' || action === 'complete') {
      /* 核销允许平台管理员代为操作，支付与取消仍限本人 */
      const adminComplete = action === 'complete' && isAdmin(event);
      const user = adminComplete ? null : resolveUser(event);
      return mutate(() => {
        const order = store.orders.find(x => x.id === orderId);
        if (!order) bad('订单不存在', 404);
        if (!adminComplete && order.userId !== user._id) bad('无权操作他人订单', 403);
        const s = findService(catalog(), order.serviceId);
        if (action === 'pay') {
          if (order.status !== 'pending') bad('仅待支付订单可以支付', 409);
          if (!s) bad('服务已下架，无法支付', 409);
          const sessions = orderSessions(order);
          if (order.type === 'tutor' && sessions.length && Array.isArray(order.slotsSnapshot)) {
            for (const item of sessions) {
              if (!order.slotsSnapshot.includes(item.slot)) bad('该预约时段已不可用，请重新选择时段下单', 409);
            }
          }
          const active = store.orders.filter(x => x.serviceId === order.serviceId && x.id !== order.id && isActiveOrder(x));
          if (s.type === 'tutor') {
            const taken = new Set();
            for (const x of active) {
              for (const item of orderSessions(x)) taken.add((item.date || '*') + '|' + item.slot);
            }
            for (const item of sessions) {
              if (taken.has((item.date || '*') + '|' + item.slot) || (!item.date && taken.has('*|' + item.slot))) {
                bad('当前名额或预约时段已售出', 409);
              }
            }
          }
          if (s.type !== 'tutor' && active.length >= Number(s.remaining || 0)) bad('当前名额或预约时段已售出', 409);
          order.status = 'paid';
          order.code = Math.random().toString(36).slice(2, 10).toUpperCase();
        }
        if (action === 'complete') {
          if (order.status !== 'paid') bad('仅已支付订单可以核销', 409);
          order.status = 'completed';
        }
        if (action === 'cancel') {
          if (order.status !== 'pending') bad('仅待支付订单可以取消', 409);
          order.status = 'cancelled';
        }
        return ok(order);
      });
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 入驻申请 ---------- */
  applications(event) {
    const action = event.action;
    const store = db();
    if (action === 'submit') {
      const user = resolveUser(event);
      const b = event;
      const name = text(b.name, 60), phone = text(b.phone, 20);
      if (!name || !PHONE_RE.test(phone) || !['机构', '伴学', '校车', '接送'].includes(b.type)) bad('请完整填写入驻信息');
      const expected = applicationTypeOfRole(user.role);
      /* 私家车车主面向所有登录用户开放（必须同时接送自家孩子）；其余类型须与账号身份一致 */
      if (b.type !== '接送' && b.type !== expected) bad('申请类型与账号身份不一致', 403);
      if (phone !== user.phone) bad('申请手机号须与账号手机号一致', 403);
      if (mineApplications(user).some(a => a.status === 'pending')) bad('已有待审核的入驻申请，请等待平台审核', 409);
      /* 服务人群只对机构生效；不传按「家长」处理，兼容旧客户端 */
      const audience = b.type === '机构'
        ? (lib.normalizeAudience(b.audience) || lib.DEFAULT_AUDIENCE.slice())
        : null;
      const fields = b.type === '伴学'
        ? ['education', 'school', 'grade', 'subjects', 'resume']
        : b.type === '接送'
          ? ['area', 'school', 'childGrade', 'vehicle', 'timeText']
          : ['contact'];
      const details = {};
      if (b.type === '接送') {
        /* 私家车入驻：必须同时接送自家孩子，并同意安全承诺 */
        const seat = Number(b.seat === undefined || b.seat === null ? 0 : b.seat);
        if (!Number.isInteger(seat) || seat < 1 || seat > 6) bad('可接孩子数须为 1–6 的整数');
        details.seat = seat;
        const years = Number(b.years === undefined || b.years === null ? 0 : b.years);
        if (!Number.isInteger(years) || years < 0 || years > 60) bad('驾龄/接送年数不正确');
        details.years = years;
        if (b.safety !== true) bad('请先阅读并勾选安全承诺');
      }
      if (b.type === '校车') {
        for (const key of ['routeName', 'startPoint', 'endPoint']) {
          const v = typeof b[key] === 'string' ? b[key].trim() : '';
          if (!v || v.length > 100) bad('请填写有效的路线名称、起点和终点');
          details[key] = v;
        }
        if (!Array.isArray(b.stops) || b.stops.length > 18) bad('经停点最多 18 个');
        details.stops = b.stops.map(s => {
          const v = typeof s === 'string' ? s.trim() : '';
          if (!v || v.length > 100) bad('经停点须为 1–100 字');
          return v;
        });
        const all = [details.startPoint, ...details.stops, details.endPoint];
        if (new Set(all).size !== all.length) bad('起点、经停点和终点不能重复');
      }
      if (b.type === '伴学') {
        const fee = String(b.hourlyRate === undefined || b.hourlyRate === null ? '' : b.hourlyRate);
        if (!/^\d{1,5}(\.\d{1,2})?$/.test(fee) || Number(fee) <= 0 || Number(fee) > 10000) {
          bad('课时费须为 0.01–10000 元，最多两位小数');
        }
        details.hourlyRate = Number(fee);
        if (typeof b.photo !== 'string' || b.photo.length > 300000 ||
            !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(b.photo)) {
          bad('请上传有效的正脸照片');
        }
        details.photo = b.photo;
      }
      for (const field of fields) {
        const value = typeof b[field] === 'string' ? b[field].trim() : '';
        if (!value || value.length > (field === 'resume' ? 1000 : 100)) {
          bad(field === 'resume' ? '请填写 1–1000 字简历' : '请完整填写该入驻类型所需资料');
        }
        details[field] = value;
      }
      if (b.type === '伴学') {
        const gender = text(b.gender, 4);
        if (gender) {
          if (!['男', '女', '暂不填写'].includes(gender)) bad('请选择有效的性别');
          details.gender = gender;
        }
        for (const [key, max] of Object.entries({ major: 100, identity: 100, tags: 100, specialty: 100, experience: 500, address: 200, methods: 40 })) {
          if (b[key] === undefined || b[key] === '') continue;
          if (typeof b[key] !== 'string' || b[key].trim().length > max) bad('伴学补充资料格式或长度不正确');
          details[key] = b[key].trim();
        }
        if (b.birthYear !== undefined && b.birthYear !== '') {
          const year = Number(b.birthYear);
          if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) bad('出生年份不正确');
          details.birthYear = String(year);
        }
      }
      return mutate(() => {
        const application = {
          _id: newId('a'), id: newId('a'),
          userId: user._id, role: user.role,
          name, phone, type: b.type, ...details,
          status: 'pending', createdAt: new Date().toISOString()
        };
        if (audience) application.audience = audience;
        store.applications.unshift(application);
        return ok(application);
      });
    }
    if (action === 'mine') {
      const user = resolveUser(event);
      return ok(mineApplications(user));
    }
    if (action === 'list') {
      if (!isAdmin(event)) return fail('需要平台管理员令牌', 403);
      return ok(store.applications.slice());
    }
    if (action === 'approve') {
      if (!isAdmin(event)) return fail('需要平台管理员令牌', 403);
      return mutate(() => {
        const a = store.applications.find(x => x.id === text(event.id, 64));
        if (!a) bad('申请不存在', 404);
        if (a.status !== 'pending') bad('该申请已审核', 409);
        a.status = 'approved';
        a.approvedAt = new Date().toISOString();
        if (a.type === '机构') {
          a.institutionId = lib.institutionId(a.institutionName || a.name);
          a.institutionName = a.institutionName || a.name;
        }
        return ok(a);
      });
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 机构 ---------- */
  institutions(event) {
    const action = event.action;
    const store = db();
    if (action === 'list') {
      const user = event.token ? resolveUser(event) : null;
      const list = catalog();
      let items = institutionsOf(list);
      if (user && user.role === 'institution') {
        const bound = institutionIdOfUser(user);
        items = items.filter(i => i.id === bound);
      } else {
        /* 机构目录属于家长端，只展示对家长开放的机构 */
        items = items.filter(i => lib.parentAudience(i.audience));
      }
      return ok(items.map(institutionView));
    }
    if (action === 'get') {
      const id = text(event.id, 64);
      const user = event.token ? resolveUser(event) : null;
      if (user && user.role === 'institution') {
        const bound = institutionIdOfUser(user);
        if (!bound) bad('账号尚未绑定机构，请先完成入驻审核', 403);
        if (bound !== id) bad('无权访问其他机构资料', 403);
      }
      const item = institutionsOf(catalog()).find(i => i.id === id);
      if (!item) bad('机构不存在', 404);
      return ok(institutionView(item));
    }
    if (action === 'detail') {
      const id = text(event.id, 64);
      const name = text(event.name, 60);
      const item = institutionsOf(catalog()).find(i =>
        (id && i.id === id) || (!id && name && i.name === name));
      if (!item) bad('机构不存在', 404);
      return ok(institutionDetailView(item, catalog()));
    }
    if (action === 'update') {
      const user = resolveUser(event);
      const binding = institutionBinding(user);
      if (!binding) bad('仅已审核通过的机构账号可以修改机构资料', 403);
      const id = text(event.id, 64);
      if (binding.institutionId !== id) bad('只能修改自己所属的机构资料', 403);
      const list = catalog();
      const current = institutionsOf(list).find(i => i.id === id);
      if (!current) bad('机构不存在', 404);
      if (event.name !== undefined && text(event.name, 60) !== current.name) bad(lib.INSTITUTION_NAME_FIXED);
      const patch = lib.normalizeInstitutionPatch(strip(event), current.name);
      return mutate(() => {
        const row = store.institutions.find(x => x.id === id);
        if (row) Object.assign(row, { name: current.name, ...patch, updatedAt: new Date().toISOString() });
        else store.institutions.push({ id, name: current.name, ...patch, updatedAt: new Date().toISOString() });
        return ok(institutionView(institutionsOf(catalog()).find(i => i.id === id)));
      });
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 档案 ---------- */
  profile(event) {
    const user = resolveUser(event);
    const store = db();
    if (event.action === 'get') {
      const own = store.profiles[user._id] || emptyProfile(user.phone);
      const orders = store.orders.filter(o => o.userId === user._id).length;
      const feedback = store.feedback.filter(f => f.userId === user._id).length;
      return ok({ ...own, phone: own.phone || user.phone || '', orders, feedback });
    }
    if (event.action === 'update') {
      const allowed = new Set(['name', 'phone', 'address', 'students', 'note']);
      for (const key of Object.keys(event)) {
        if (!allowed.has(key)) continue;
      }
      const b = event;
      const base = store.profiles[user._id] || emptyProfile(user.phone);
      return mutate(() => {
        const next = { ...base };
        if (b.name !== undefined) {
          const v = text(b.name, 30);
          if (!v) bad('请填写称呼');
          next.name = v;
        }
        if (b.phone !== undefined) {
          const v = text(b.phone, 20);
          if (v && !PHONE_RE.test(v)) bad('请填写有效的 11 位手机号');
          if (v && v !== user.phone) bad('档案手机号须与账号手机号一致', 400);
          next.phone = v;
        }
        if (b.address !== undefined) {
          const v = text(b.address, 200);
          if (!v) bad('请填写地址');
          next.address = v;
        }
        if (b.note !== undefined) next.note = text(b.note, 200);
        if (b.students !== undefined) {
          if (!Array.isArray(b.students) || b.students.length > 5) bad('学员信息须为数组，最多 5 名');
          next.students = b.students.map(st => {
            if (!st || typeof st !== 'object' || Array.isArray(st)) bad('学员信息格式不正确');
            const name = text(st.name, 30);
            if (!name) bad('请填写学员姓名');
            const item = { name, age: null, gender: '未填写', guardian: '', relation: '', phone: '' };
            if (st.age !== undefined && st.age !== null && st.age !== '') {
              const n = Number(st.age);
              if (!Number.isInteger(n) || n < 1 || n > 99) bad('学员年龄须为 1–99 的整数');
              item.age = n;
            }
            if (st.gender !== undefined) {
              if (!GENDERS.includes(st.gender)) bad('请选择有效的性别');
              item.gender = st.gender;
            }
            if (st.guardian !== undefined) item.guardian = text(st.guardian, 30);
            if (st.relation !== undefined) {
              if (st.relation && !RELATIONS.includes(st.relation)) bad('请选择有效的监护人关系');
              item.relation = st.relation;
            }
            if (st.phone !== undefined) {
              const v = text(st.phone, 20);
              if (v && !PHONE_RE.test(v)) bad('学员监护人手机号格式不正确');
              item.phone = v;
            }
            return item;
          });
        }
        next.updatedAt = new Date().toISOString();
        store.profiles[user._id] = next;
        return ok(next);
      });
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 意见反馈 ---------- */
  feedback(event) {
    const store = db();
    if (event.action === 'submit') {
      const user = event.token ? resolveUser(event) : null;
      const b = event;
      const categories = ['课程', '伴学', '校车', '订单', '账号', '其他'];
      const category = b.category === undefined ? '其他' : text(b.category, 10);
      if (!categories.includes(category)) bad('请选择有效的反馈类型');
      const content = text(b.content, 500);
      if (content.length < 5) bad('反馈内容请填写 5–500 字');
      const contact = text(b.contact, 60);
      if (contact && !PHONE_RE.test(contact) && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(contact)) bad('联系方式须为手机号或邮箱');
      const orderNumber = text(b.orderNumber, 30);
      if (orderNumber && !store.orders.some(o => o.number === orderNumber)) bad('订单号不存在', 404);
      let rating = null;
      if (b.rating !== undefined && b.rating !== null && b.rating !== '') {
        const n = Number(b.rating);
        if (!Number.isInteger(n) || n < 1 || n > 5) bad('评分须为 1–5');
        rating = n;
      }
      return mutate(() => {
        const item = {
          _id: newId('f'), id: newId('f'), category, content, contact, orderNumber, rating,
          userId: user ? user._id : '', status: 'pending', reply: '',
          createdAt: new Date().toISOString()
        };
        store.feedback.unshift(item);
        return ok(item);
      });
    }
    if (event.action === 'list') {
      const user = event.token ? resolveUser(event) : null;
      if (!user) return ok([]);
      return ok(store.feedback.filter(f => f.userId === user._id));
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 学习资源 ---------- */
  learning(event) {
    const list = catalog();
    const institutions = institutionsOf(list);
    const approved = approvedInstitutions().map(a => a.name);
    const all = learningResources(list, institutions, approved);
    /* 「其他课程」只在确有这类课程时出现 */
    const kinds = all.some(i => i.kind === OTHER_KIND.id) ? ALL_LEARNING_KINDS : LEARNING_KINDS;
    const kind = text(event.kind, 10);
    const subject = text(event.subject, 30);
    let items = all;
    if (kind) items = items.filter(i => i.kind === kind);
    if (subject) items = items.filter(i => i.subject === subject);
    const chosen = kinds.find(k => k.id === kind) || kinds[0];
    return ok({
      kinds: kinds.map(row => ({ id: row.id, name: row.name, subjects: [...row.subjects] })),
      kind: chosen.id, kindName: chosen.name, subjects: [...chosen.subjects],
      subject: chosen.subjects.includes(subject) ? subject : chosen.subjects[0],
      items
    });
  },

  /* ---------- 静态内容 ---------- */
  content() {
    return ok(seed.SEED_CONTENT);
  },

  /* ---------- 高考志愿 ---------- */
  gaokao(event) {
    const action = event.action;
    if (action === 'meta') return ok(gk.meta());
    if (action === 'universities') {
      return ok(gk.listUniversities({
        province: text(event.province, 40) || undefined,
        tier: text(event.tier, 10) || undefined,
        type: text(event.type, 10) || undefined,
        alliance: text(event.alliance, 20) || undefined,
        q: text(event.q, 40),
        sort: text(event.sort, 20) || 'rank',
        page: int(event.page, 1, 9999, 1),
        size: int(event.size, 1, 60, 20),
        scoreProvince: text(event.scoreProvince, 40) || '黑龙江',
        year: int(event.year, 2016, 2025, 2025)
      }));
    }
    if (action === 'detail') {
      const uni = gk.findUniversity(text(event.id, 64));
      if (!uni) bad('院校不存在', 404);
      return ok(gk.detail(uni, text(event.province, 40) || '黑龙江', int(event.year, 2016, 2025, 2025)));
    }
    if (action === 'majorSeries') {
      const uni = gk.findUniversity(text(event.id, 64));
      if (!uni) bad('院校不存在', 404);
      const result = gk.majorSeries(uni, text(event.major, 60), text(event.province, 40) || '黑龙江');
      if (!result) bad('该院校没有这个专业', 404);
      return ok(result);
    }
    if (action === 'recommend') {
      return ok(gk.recommend({
        province: text(event.province, 40) || '黑龙江',
        score: Number(event.score),
        subject: text(event.subject, 10) || '物理',
        year: int(event.year, 2016, 2025, 2025),
        limit: int(event.limit, 1, 30, 10),
        tier: text(event.tier, 10) || undefined,
        type: text(event.type, 10) || undefined,
        alliance: text(event.alliance, 20) || undefined
      }));
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 考公 / 考研 / 考编 ---------- */
  exam(event) {
    const action = event.action;
    if (action === 'meta') return ok(ex.meta());
    if (action === 'resources') {
      const kind = text(event.kind, 10) || 'gwy';
      if (!ex.isKind(kind)) bad('考试类型不存在', 404);
      return ok(ex.resources(kind, int(event.seed, 0, 9999, 0)));
    }
    if (action === 'items') {
      const kind = text(event.kind, 10);
      if (!ex.isKind(kind)) bad('考试类型不存在', 404);
      return ok(ex.listItems({
        kind,
        region: text(event.region, 40) || undefined,
        category: text(event.category, 40) || undefined,
        examType: text(event.examType, 20) || undefined,
        education: text(event.education, 10) || undefined,
        q: text(event.q, 40),
        sort: text(event.sort, 20) || 'line',
        page: int(event.page, 1, 9999, 1),
        size: int(event.size, 1, 60, 12),
        year: int(event.year, 2016, 2025, 2025)
      }));
    }
    if (action === 'detail') {
      const kind = text(event.kind, 10);
      if (!ex.isKind(kind)) bad('考试类型不存在', 404);
      const item = ex.findItem(kind, text(event.id, 64));
      if (!item) bad('条目不存在', 404);
      return ok(ex.detail(item, int(event.year, 2016, 2025, 2025)));
    }
    if (action === 'match') {
      const kind = text(event.kind, 10);
      if (!ex.isKind(kind)) bad('考试类型不存在', 404);
      return ok(ex.match({
        kind,
        score: Number(event.score),
        region: text(event.region, 40) || undefined,
        education: text(event.education, 10) || undefined,
        major: text(event.major, 40) || undefined,
        category: text(event.category, 40) || undefined,
        political: text(event.political, 10) || undefined,
        limit: int(event.limit, 1, 30, 10),
        year: int(event.year, 2016, 2025, 2025)
      }));
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 本地清单（志愿表 / 报考清单） ---------- */
  lists(event) {
    const user = resolveUser(event);
    const store = db();
    const key = user._id;
    if (!store.lists[key]) store.lists[key] = { admission: [], exam: [] };
    if (event.action === 'admissionGet') return ok(store.lists[key].admission || []);
    if (event.action === 'admissionSave') {
      const rows = Array.isArray(event.rows) ? event.rows.slice(0, 60) : [];
      for (const r of rows) {
        if (!r || typeof r !== 'object' || !text(r.id, 64) || !text(r.name, 60)) bad('志愿行缺少院校信息');
        if (r.major !== undefined && text(r.major, 60).length > 60) bad('专业名称过长');
      }
      return mutate(() => { store.lists[key].admission = rows; return ok(rows); });
    }
    if (event.action === 'examGet') return ok(store.lists[key].exam || []);
    if (event.action === 'examSave') {
      const rows = Array.isArray(event.rows) ? event.rows.slice(0, 60) : [];
      for (const r of rows) {
        if (!r || typeof r !== 'object' || !text(r.id, 64)) bad('清单行缺少条目信息');
      }
      return mutate(() => { store.lists[key].exam = rows; return ok(rows); });
    }
    return fail('接口不存在', 404);
  },

  /* ---------- 升学规划（档案 + 考试 + 六个板块） ---------- */
  plan(event) {
    const store = db();
    if (!store.plans) store.plans = {};
    const key = planKey(event);
    if (!store.plans[key]) {
      store.plans[key] = { profile: plan.defaultProfile(), exams: [], updatedAt: null };
    }
    const record = store.plans[key];
    if (!Array.isArray(record.exams)) record.exams = [];

    const profile = planProfileOf(record);
    const exams = record.exams;
    const stats = plan.examStats(exams);
    const now = new Date();
    const action = event.action || 'overview';

    const gradeOf = () => {
      const grade = text(event.grade, 8) || profile.grade;
      if (!plan.isGrade(grade)) bad('年级不存在：' + grade);
      return grade;
    };
    const provinceOf = () => {
      const province = text(event.province, 20) || profile.province;
      if (!plan.isProvinceName(province)) bad('省份不存在：' + province);
      return province;
    };

    if (action === 'overview') {
      const grade = gradeOf();
      const province = provinceOf();
      const stage = plan.stagesFor(grade);
      const nodes = plan.timeline({ grade, now });
      const gap = plan.gapAnalysis({
        province, grade, targetTier: profile.targetTier, avgScore: stats.average, now
      });
      return ok({
        profile,
        grade,
        stages: stage.stages,
        currentStage: stage.current,
        stageNote: stage.note,
        timeline: nodes,
        gap,
        exams: {
          count: stats.count, average: stats.average, latest: stats.latest,
          highest: stats.highest, lowest: stats.lowest, trend: stats.trend,
          label: stats.label, recent: stats.recent, items: plan.examList(exams)
        },
        subjects: plan.subjectAnalysis({ first: profile.first, second: profile.second, province }),
        meta: PLAN_META,
        disclaimer: plan.DISCLAIMER,
        storage: 'local'
      });
    }

    if (action === 'profileSave') {
      const result = plan.normalizeProfile(event.profile || {});
      if (!result.ok) bad(result.errors.join('；'));
      const iso = new Date().toISOString();
      return mutate(() => {
        record.profile = Object.assign({}, result.profile, { updatedAt: iso });
        record.updatedAt = iso;
        return ok({ profile: planProfileOf(record), saved: true, updatedAt: iso, disclaimer: plan.DISCLAIMER });
      });
    }

    if (action === 'examAdd') {
      const result = plan.normalizeExam(event.exam || {});
      if (!result.ok) bad(result.errors.join('；'));
      const exam = Object.assign({ id: newId('pex'), createdAt: new Date().toISOString() }, result.exam);
      return mutate(() => {
        record.exams.push(exam);
        if (record.exams.length > 60) record.exams = record.exams.slice(-60);
        record.updatedAt = exam.createdAt;
        const next = plan.examStats(record.exams);
        return ok({
          exam,
          exams: plan.examList(record.exams),
          count: next.count, average: next.average, latest: next.latest, trend: next.trend,
          saved: true, message: '已记录本次考试'
        });
      });
    }

    if (action === 'examRemove') {
      const id = text(event.id, 40);
      if (!id) bad('缺少考试记录编号');
      return mutate(() => {
        record.exams = record.exams.filter(e => e.id !== id);
        record.updatedAt = new Date().toISOString();
        return ok({ exams: plan.examList(record.exams), count: record.exams.length });
      });
    }

    if (action === 'exams') {
      const target = plan.gapAnalysis({
        province: profile.province, grade: profile.grade,
        targetTier: profile.targetTier, avgScore: stats.average, now
      });
      return ok({
        exams: plan.examList(exams),
        count: stats.count, average: stats.average, latest: stats.latest,
        highest: stats.highest, lowest: stats.lowest, trend: stats.trend,
        label: stats.label, recent: stats.recent,
        targetLine: target.targetLine, targetTier: target.targetTier, gap: target.gap,
        disclaimer: plan.DISCLAIMER
      });
    }

    if (action === 'subjects') {
      const province = provinceOf();
      const first = text(event.first, 8) || profile.first;
      const second = Array.isArray(event.second) && event.second.length
        ? event.second
        : profile.second;
      const data = plan.subjectAnalysis({ first, second, province });
      if (!data.ok) bad(data.errors.join('；'));
      return ok(data);
    }

    if (action === 'pathways') {
      const province = provinceOf();
      const grade = gradeOf();
      let score = stats.average;
      if (event.score !== undefined && event.score !== null && event.score !== '') {
        const n = Number(event.score);
        if (!Number.isFinite(n)) bad('分数须为数字');
        const total = gk.provinceInfo(province).total;
        if (!(n > 0 && n <= total)) bad('分数须为 0–' + total + ' 之间的数字（' + province + '满分 ' + total + '）');
        score = n;
      }
      let rank = null;
      if (event.rank !== undefined && event.rank !== null && event.rank !== '') {
        const n = Number(event.rank);
        if (!Number.isInteger(n) || n < 1 || n > 5000000) bad('位次须为 1–5000000 的整数');
        rank = n;
      }
      const award = text(event.award, 40);
      const data = plan.pathwaysCheck({ grade, score, rank, province, award });
      if (rank === null && data.score !== null && data.rank !== null) {
        data.rankEstimated = true;
        data.rankSource = 'model.rankOf';
      }
      return ok(data);
    }

    if (action === 'reset') {
      return mutate(() => {
        store.plans[key] = { profile: plan.defaultProfile(), exams: [], updatedAt: null };
        return ok({ reset: true, profile: planProfileOf(store.plans[key]) });
      });
    }

    return fail('接口不存在', 404);
  },

  /* ---------- 定位 ---------- */
  location() {
    /* 本地模拟：返回预设城市，不发起网络请求 */
    return ok({ city: '哈尔滨', province: '黑龙江省', district: '', formatted: '黑龙江省哈尔滨市', source: 'preset' });
  },

  /* ---------- 种子数据 ---------- */
  seed() {
    db();
    save();
    return ok({ seeded: true });
  },

  /* ---------- 学鹭助手 ---------- */
  assistant(event) {
    const action = event.action;
    if (action === 'status') return ok({ enabled: true, source: 'builtin', configured: true });
    if (action !== 'chat') return fail('接口不存在', 404);
    const question = text(event.question, 200);
    if (!question) bad('请填写问题');
    const result = assistantData.answer(question);
    return ok({
      answer: result.a,
      question: result.q,
      matched: !!result.matched,
      route: result.go || null,
      courses: result.courses || [],
      source: 'builtin',
      related: (result.related || []).map(row => ({ q: row.q, a: row.a }))
    });
  }
};

/* ---------------- 辅助 ---------------- */
function int(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) bad('参数须为 ' + min + '–' + max + ' 的整数');
  return n;
}
function publicUser(user) { return { id: user._id, phone: user.phone, role: user.role }; }
function applicationBrief(user) {
  const a = latestApplication(user);
  if (!a) return null;
  return { id: a._id, status: a.status, name: a.name, type: a.type };
}
function emptyProfile(phone) {
  return { name: '', phone: phone || '', address: '', students: [], note: '', updatedAt: null };
}
function institutionView(item) {
  const audience = lib.audienceOf(item.audience) || lib.DEFAULT_AUDIENCE.slice();
  return {
    id: item.id, name: item.name, intro: item.intro, address: item.address,
    contact: item.contact, phone: item.phone, courseCount: item.courseCount,
    audience, audienceText: audience.join(' / '),
    courses: (item.courses || []).map(c => ({
      id: c.id, title: c.title, price: c.price,
      packageCount: Array.isArray(c.packages) ? c.packages.length : 0
    })),
    source: item.source, updatedAt: item.updatedAt || null
  };
}
/* 机构主页：环境图 / 课程 / 教师 / 价格区间（与云函数共用 institution-lib 的实现） */
const institutionDetailView = lib.institutionDetailView;

function decoratedResult(doc) {
  const list = catalog();
  const institutions = institutionsOf(list);
  const sold = soldCounts();
  return decorate(findService(list, doc.id) || doc, institutions, sold);
}

/* ---------------- 统一入口 ------------------------ */
/* 与云函数返回结构保持一致：{code, data} / {code, message} */
function handle(name, event) {
  const handler = handlers[name];
  if (!handler) return fail('接口不存在', 404);
  try {
    return handler(event || {});
  } catch (e) {
    if (e && e.name === 'BizError') return fail(e.message, e.code, e.needLogin);
    /* 共享校验库（institution-lib）抛的是带 status 的普通 Error，按业务错误返回 */
    if (e && typeof e.status === 'number') return fail(e.message, e.status);
    console.error('[mock]', name, e);
    return fail('服务暂时不可用，请稍后再试', 500);
  }
}

/* 清空本地模拟数据（“我的 → 重置演示数据”） */
function reset() {
  cache = null;
  try { wx.removeStorageSync(DB_KEY); } catch (e) { /* ignore */ }
  db();
  save();
}

module.exports = { handle, reset, db };
