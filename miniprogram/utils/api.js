/* ------------------------------------------------------------------ *
 * 学鹭伴学 · 小程序接口层
 *
 * 两种后端模式（utils/config.js 的 USE_CLOUD 切换）：
 *   1. 本地模拟（默认）：调用 utils/mock.js，数据存本地存储，开箱即用；
 *   2. 微信云开发：调用 wx.cloud.callFunction，由 cloudfunctions/ 云函数 +
 *      云数据库承载。切换前需部署云函数并配置 CLOUD_ENV。
 *
 * 两种模式对页面暴露完全相同的接口与返回结构：
 *   { ok, status, data, error, needLogin }
 * ------------------------------------------------------------------ */

const config = require('./config.js');
const mock = require('./mock.js');

const TOKEN_KEY = config.STORAGE_PREFIX + 'token';
const USER_KEY = config.STORAGE_PREFIX + 'user';

function readRaw(key) {
  try { return wx.getStorageSync(key); } catch (e) { return ''; }
}
function writeRaw(key, value) {
  try { wx.setStorageSync(key, value); } catch (e) { /* 存储不可用时降级到内存 */ }
}

/* ---------------- 模式判断 ---------------- */
let cloudInited = false;

function useCloud() {
  if (!config.USE_CLOUD) return false;
  if (!config.CLOUD_ENV) return false;
  if (cloudInited) return true;
  try {
    wx.cloud.init({ env: config.CLOUD_ENV, traceUser: false });
    cloudInited = true;
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------- 令牌与本地账号 ---------------- */
let memoryToken = '';

function token() { return memoryToken || readRaw(TOKEN_KEY) || ''; }
function setToken(value) {
  memoryToken = typeof value === 'string' ? value : '';
  writeRaw(TOKEN_KEY, memoryToken);
}
function clearToken() { memoryToken = ''; writeRaw(TOKEN_KEY, ''); }

function user() {
  const raw = readRaw(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && parsed.id ? parsed : null;
  } catch (e) { return null; }
}
function setUser(row) {
  if (!row || !row.id) { clearUser(); return null; }
  const clean = { id: row.id, phone: row.phone || '', role: row.role || 'parent' };
  writeRaw(USER_KEY, JSON.stringify(clean));
  return clean;
}
function clearUser() { writeRaw(USER_KEY, ''); }

/* ---------------- 统一调用 ---------------- */
/* name: 云函数名（模拟模式下对应 mock 模块的 handler）；action: 动作；data: 参数 */
function call(name, action, data) {
  const payload = Object.assign({}, data || {});
  payload.action = action || 'run';
  const current = token();
  if (current) payload.token = current;

  if (!useCloud()) {
    const result = mock.handle(name, payload);
    if (result.code === 0) return Promise.resolve({ ok: true, status: 200, data: result.data });
    /* 只有带 needLogin 标记的 401（会话失效）才清本地令牌；业务 401（如密码错误）不清 */
    if (result.code === 401 && result.needLogin) { clearToken(); clearUser(); }
    return Promise.resolve({
      ok: false,
      status: result.code || 500,
      needLogin: result.code === 401 && !!result.needLogin,
      error: result.message || '请求失败'
    });
  }

  return new Promise(resolve => {
    wx.cloud.callFunction({
      name: name,
      data: payload,
      success(res) {
        const result = (res && res.result) || {};
        const code = Number(result.code);
        if (code === 0) {
          resolve({ ok: true, status: 200, data: result.data });
          return;
        }
        if (code === 401 && result.needLogin) { clearToken(); clearUser(); }
        resolve({
          ok: false,
          status: code || 500,
          needLogin: code === 401 && !!result.needLogin,
          error: result.message || ('请求失败（' + (code || '未知') + '）')
        });
      },
      fail(err) {
        resolve({
          ok: false,
          status: 0,
          error: '云函数调用失败：' + name + '/' + (action || 'run') +
            (err && err.errMsg ? '（' + err.errMsg + '）' : '')
        });
      }
    });
  });
}

/* ---------------- 账号 ---------------- */
const auth = {
  wxLogin: () => call('auth', 'wxLogin', {}),
  register: (phone, password, role) => call('auth', 'register', { phone, password, role }),
  login: (phone, password) => call('auth', 'login', { phone, password }),
  me: () => call('auth', 'me', {}),
  logout: () => call('auth', 'logout', {})
};

/* ---------------- 服务目录 ---------------- */
const services = {
  list: (type) => call('services', 'list', type ? { type } : {}),
  availability: (id, date) => call('services', 'availability', { id, date }),
  create: (payload) => call('services', 'create', payload || {}),
  update: (id, payload) => call('services', 'update', Object.assign({ id }, payload || {})),
  tempUrl: (fileIDs) => call('services', 'tempUrl', { fileIDs: Array.isArray(fileIDs) ? fileIDs : [] }),
  recordVideo: (payload) => call('services', 'recordVideo', payload || {})
};

/* ---------------- 订单 ---------------- */
const orders = {
  list: () => call('orders', 'list', {}),
  create: (payload) => call('orders', 'create', payload || {}),
  pay: (id) => call('orders', 'pay', { id }),
  cancel: (id) => call('orders', 'cancel', { id }),
  complete: (id) => call('orders', 'complete', { id }),
  /* 平台管理：全部订单与代为核销 */
  adminList: (adminToken) => call('orders', 'list', { all: true, adminToken }),
  adminComplete: (id, adminToken) => call('orders', 'complete', { id, adminToken })
};

/* ---------------- 入驻申请 ---------------- */
const applications = {
  submit: (payload) => call('applications', 'submit', payload || {}),
  mine: () => call('applications', 'mine', {}),
  list: (adminToken) => call('applications', 'list', { adminToken }),
  approve: (id, adminToken) => call('applications', 'approve', { id, adminToken })
};

/* ---------------- 机构 ---------------- */
const institutions = {
  list: () => call('institutions', 'list', {}),
  /* 机构主页：环境图 / 课程 / 师资 / 价格区间；id 或 name 二选一 */
  detail: (params) => call('institutions', 'detail', params || {}),
  get: (id) => call('institutions', 'get', { id }),
  update: (id, patch) => call('institutions', 'update', Object.assign({ id }, patch || {}))
};

/* ---------------- 档案 / 反馈 ---------------- */
const profile = {
  get: () => call('profile', 'get', {}),
  update: (patch) => call('profile', 'update', patch || {})
};
const feedback = {
  submit: (payload) => call('feedback', 'submit', payload || {}),
  list: () => call('feedback', 'list', {})
};

/* ---------------- 学习资源 / 内容 ---------------- */
const learning = {
  resources: (kind, subject) => call('learning', 'resources', { kind, subject })
};
const content = {
  all: () => call('content', 'all', {})
};

/* ---------------- 高考志愿模拟填报 ---------------- */
const gaokao = {
  meta: () => call('gaokao', 'meta', {}),
  universities: (params) => call('gaokao', 'universities', params || {}),
  detail: (id, province, year) => call('gaokao', 'detail', { id, province, year }),
  majorSeries: (id, major, province) => call('gaokao', 'majorSeries', { id, major, province }),
  recommend: (params) => call('gaokao', 'recommend', params || {})
};

/* ---------------- 考公 / 考研 / 考编 ---------------- */
const exam = {
  meta: () => call('exam', 'meta', {}),
  resources: (kind, seed) => call('exam', 'resources', { kind, seed }),
  items: (params) => call('exam', 'items', params || {}),
  detail: (kind, id, year) => call('exam', 'detail', { kind, id, year }),
  match: (params) => call('exam', 'match', params || {})
};

/* ---------------- 升学规划（档案 / 学业曲线 / 选科 / 多元升学 / 节点） ---------------- */
const plan = {
  overview: (params) => call('plan', 'overview', params || {}),
  profileSave: (profile) => call('plan', 'profileSave', { profile }),
  exams: () => call('plan', 'exams', {}),
  examAdd: (exam) => call('plan', 'examAdd', { exam }),
  examRemove: (id) => call('plan', 'examRemove', { id }),
  subjects: (params) => call('plan', 'subjects', params || {}),
  pathways: (params) => call('plan', 'pathways', params || {}),
  reset: () => call('plan', 'reset', {})
};

/* ---------------- 本地清单（志愿表 / 报考清单） ---------------- */
const lists = {
  admissionGet: () => call('lists', 'admissionGet', {}),
  admissionSave: (rows) => call('lists', 'admissionSave', { rows }),
  examGet: () => call('lists', 'examGet', {}),
  examSave: (rows) => call('lists', 'examSave', { rows })
};

/* ---------------- 定位 ---------------- */
const location = {
  reverse: (latitude, longitude) => call('location', 'reverse', { latitude, longitude })
};

/* ---------------- 种子数据 ---------------- */
const seed = {
  run: () => call('seed', 'run', {})
};

/* ---------------- 学鹭助手 ---------------- */
const assistant = {
  status: () => call('assistant', 'status', {}),
  chat: (question, history) => call('assistant', 'chat', { question, history: history || [] })
};

module.exports = {
  useCloud,
  token, setToken, clearToken,
  user, setUser, clearUser,
  call,
  auth, services, orders, applications, institutions,
  profile, feedback, learning, content,
  gaokao, exam, lists, location, seed, assistant, plan,
  resetMock: mock.reset
};
