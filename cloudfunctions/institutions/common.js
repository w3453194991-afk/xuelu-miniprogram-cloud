/* 云函数公共模块：返回结构、错误、入参校验、口令散列、会话、机构归属
 *
 * 每个云函数目录里都有一份相同的拷贝（由 cloudfunctions/_lib/common.js 生成），
 * 因为云函数部署时只能打包自己目录内的文件。改这里后请重新同步：
 *   node cloudfunctions/_lib/sync-common.js
 */

const crypto = require('crypto');

/* ---------------- 返回结构 ---------------- */
function ok(data) { return { code: 0, data: data === undefined ? null : data }; }
function fail(message, code, needLogin) {
  return needLogin ? { code: code || 400, message, needLogin: true } : { code: code || 400, message };
}

class BizError extends Error {
  constructor(message, code, needLogin) {
    super(message);
    this.name = 'BizError';
    this.code = code || 400;
    this.needLogin = !!needLogin;
  }
}
function bad(message, code, needLogin) { throw new BizError(message, code, needLogin); }
/* 会话类错误：带 needLogin 标记，客户端只在这种情况清本地令牌 */
function unauthorized(message) { bad(message || '请先登录', 401, true); }

/* ---------------- 入参校验 ---------------- */
const PHONE_RE = /^1\d{10}$/;
const ROLES = ['parent', 'tutor', 'institution'];

function text(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}
function requireText(value, max, label) {
  const v = text(value, max);
  if (!v) bad('请填写' + (label || '该项'));
  return v;
}
function requirePhone(value, label) {
  const v = text(value, 20);
  if (!PHONE_RE.test(v)) bad((label || '手机号') + '须为 11 位手机号');
  return v;
}
function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    bad('密码长度须为 8–128 位');
  }
  return value;
}
function requireRole(value) {
  const v = text(value, 20);
  if (!ROLES.includes(v)) bad('请选择有效的账号类型：家长 / 大学生 / 机构');
  return v;
}

/* ---------------- 口令散列（scrypt + 随机盐，与网页版同参数） ---------------- */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;
const SALT_BYTES = 16;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, SCRYPT_PARAMS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt);
  return salt.toString('hex') + ':' + key.toString('hex');
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [saltHex, keyHex] = parts;
  if (!/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(keyHex)) return false;
  let key;
  try { key = await scryptAsync(password, Buffer.from(saltHex, 'hex')); } catch (e) { return false; }
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== key.length) return false;
  return crypto.timingSafeEqual(key, expected);
}

/* 账号不存在时也跑一次散列，响应时间不暴露手机号是否注册 */
const DUMMY_SALT = crypto.randomBytes(SALT_BYTES);
async function burnPasswordCheck(password) {
  try { await scryptAsync(typeof password === 'string' ? password : '', DUMMY_SALT); } catch (e) { /* 忽略 */ }
}

/* ---------------- 会话（云数据库 sessions 集合） ---------------- */
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 小时空闲即失效
const SESSION_MAX = 5000;

function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function newId(prefix) {
  return prefix + '-' + crypto.randomUUID().slice(0, 8);
}

async function issueSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.collection('sessions').add({
    data: { userId, tokenHash: sha256(token), createdAt: now, expireAt: now + SESSION_TTL_MS }
  });
  /* 简单清理：过期会话不无限增长 */
  try {
    await db.collection('sessions').where({ expireAt: db.command.lte(now) }).remove();
  } catch (e) { /* 清理失败不影响登录 */ }
  return token;
}

async function revokeSession(db, token) {
  if (typeof token !== 'string' || !token) return;
  await db.collection('sessions').where({ tokenHash: sha256(token) }).remove().catch(() => {});
}

/* 解析登录态：返回 user 行；未登录/过期抛 401（needLogin） */
async function resolveUser(db, event) {
  const token = typeof event.token === 'string' ? event.token : '';
  if (!token) unauthorized('请先登录');
  const found = await db.collection('sessions').where({ tokenHash: sha256(token) }).limit(1).get();
  const session = found.data && found.data[0];
  if (!session) unauthorized('登录已过期，请重新登录');
  if (!session.expireAt || session.expireAt < Date.now()) unauthorized('登录已过期，请重新登录');
  /* 滑动续期 */
  db.collection('sessions').doc(session._id).update({
    data: { expireAt: Date.now() + SESSION_TTL_MS }
  }).catch(() => {});
  const userFound = await db.collection('users').where({ _id: session.userId }).limit(1).get();
  const user = userFound.data && userFound.data[0];
  if (!user) unauthorized('账号不存在，请重新登录');
  return user;
}

/* 可选登录态：未登录返回 null（游客） */
async function optionalUser(db, event) {
  try { return await resolveUser(db, event); } catch (e) { return null; }
}

/* 平台管理员：令牌配置在云函数环境变量 ADMIN_TOKEN，前端永远无法自封 */
function isAdmin(event) {
  const configured = typeof process.env.ADMIN_TOKEN === 'string' ? process.env.ADMIN_TOKEN.trim() : '';
  if (!configured) return false;
  const supplied = event && typeof event.adminToken === 'string' ? event.adminToken : '';
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---------------- 机构归属 ---------------- */
function institutionIdOfName(name) {
  const safe = String(name || '').trim().replace(/[\/\\?#%\s]/g, '_');
  return 'inst-' + encodeURIComponent(safe).slice(0, 60);
}
function applicationTypeOfRole(role) {
  return role === 'institution' ? '机构' : role === 'tutor' ? '家教' : null;
}
function roleMatchesApplication(user, application) {
  if (!user || !application) return false;
  return application.type === applicationTypeOfRole(user.role) && application.role === user.role;
}

/* 账号绑定的申请：只认 userId 相同且角色类型匹配的记录 */
async function mineApplications(db, user) {
  if (!user) return [];
  const found = await db.collection('applications').where({ userId: user._id }).get();
  return (found.data || []).filter(a => roleMatchesApplication(user, a));
}
async function latestApplication(db, user) {
  const list = await mineApplications(db, user);
  if (!list.length) return null;
  const rank = a => (a.status === 'approved' ? 2 : a.status === 'pending' ? 1 : 0);
  return list.slice().sort((a, b) => rank(b) - rank(a) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}
async function institutionIdOfUser(db, user) {
  if (!user || user.role !== 'institution') return null;
  const list = await mineApplications(db, user);
  const hit = list.find(a => a.status === 'approved' && roleMatchesApplication(user, a));
  if (!hit) return null;
  return hit.institutionId || institutionIdOfName(hit.institutionName || hit.name);
}
/* 已通过的机构类申请（没有课程也要作为机构存在） */
async function approvedInstitutions(db) {
  const found = await db.collection('applications').where({ status: 'approved', type: '机构' }).get();
  return (found.data || []).filter(a => typeof a.institutionId === 'string' && a.institutionId)
    .map(a => ({
      id: a.institutionId,
      name: a.institutionName || a.name,
      contact: a.contact || '',
      phone: a.phone || '',
      audience: Array.isArray(a.audience) ? a.audience.slice() : null,
      approvedAt: a.approvedAt || a.createdAt || null
    }));
}

/* ---------------- 日期工具（一律按中国日期比较） ---------------- */
const WEEKDAYS = { 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 0 };
const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const CN_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
function cnToday() { return CN_DATE.format(new Date()); }
function weekdayOf(date) { return new Date(date + 'T00:00:00Z').getUTCDay(); }
function weekdayLabel(date) { return WEEKDAY_LABEL[weekdayOf(date)]; }
const WEEKDAY_PREFIX = /^(周[一二三四五六日])\s*/;
function slotWeekday(slot) {
  const m = WEEKDAY_PREFIX.exec(typeof slot === 'string' ? slot : '');
  return m ? m[1] : null;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/* ---------------- 统一入口包装 ---------------- */
/* handler(event) 返回 {code, data/message}； BizError 按自带 code 返回 */
async function entry(handler, event) {
  try {
    return await handler(event || {});
  } catch (e) {
    if (e && e.name === 'BizError') return fail(e.message, e.code, e.needLogin);
    /* 共享校验库（institution-lib）抛的是带 status 的普通 Error */
    if (e && typeof e.status === 'number') return fail(e.message, e.status);
    console.error(e);
    return fail('服务暂时不可用，请稍后再试', 500);
  }
}

module.exports = {
  ok, fail, bad, BizError, unauthorized,
  PHONE_RE, ROLES,
  text, requireText, requirePhone, requirePassword, requireRole,
  hashPassword, verifyPassword, burnPasswordCheck,
  SESSION_TTL_MS, SESSION_MAX, sha256, newId,
  issueSession, revokeSession, resolveUser, optionalUser, isAdmin,
  institutionIdOfName, applicationTypeOfRole, roleMatchesApplication,
  mineApplications, latestApplication, institutionIdOfUser, approvedInstitutions,
  WEEKDAYS, WEEKDAY_LABEL, cnToday, weekdayOf, weekdayLabel, slotWeekday, validDate,
  entry
};
