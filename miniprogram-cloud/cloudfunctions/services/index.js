/* 学鹭伴学 · 服务目录云函数
 *
 * action:
 *   list            服务目录（种子 + 云数据库覆盖，剩余名额扣减已售）
 *   availability    伴学按日期查询可约时段
 *   create          发布服务（仅已审核通过的机构账号，且只能发课程）
 *   update          修改服务（仅本人机构名下的课程）
 *   tempUrl         云存储 fileID → 临时播放地址（课程套餐视频）
 *   recordVideo     记录机构上传的视频（归属校验用）
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const lib = require('./institution-lib.js');
const { SEED_SERVICES, TUTOR_SLOTS } = require('./seed-data.js');

cloud.init({ traceUser: false });
const db = cloud.database();

/* ---------------- 学习资源标签（与 learning-catalog 一致） ---------------- */
const LEARNING_KINDS = [
  { id: 'gwy', name: '考公', subjects: ['行政职业能力测验', '申论', '面试'] },
  { id: 'ky', name: '考研', subjects: ['政治', '英语', '数学', '专业课'] },
  { id: 'sb', name: '考编', subjects: ['公共基础知识', '职业能力测验', '综合应用能力', '面试'] },
  { id: 'zk', name: '职考技能', subjects: ['教师资格', '会计实务', '建筑工程', '社会工作', '健康管理', '人力资源', '计算机等级'] }
];
function normalizeLearning(value) {
  if (value === undefined || value === null || value === '') return null;
  const kind = typeof value.kind === 'string' ? value.kind.trim() : '';
  const found = LEARNING_KINDS.find(k => k.id === kind);
  if (!found) common.bad('课程方向须为' + LEARNING_KINDS.map(k => k.name).join('、'));
  const subject = typeof value.subject === 'string' ? value.subject.trim() : '';
  if (!found.subjects.includes(subject)) common.bad('请选择' + found.name + '的有效科目');
  return { kind, subject };
}

/* ---------------- 常量 ---------------- */
const PHONE = /^1\d{10}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const GENDERS = ['男', '女', '未填写'];
const RELATIONS = ['父亲', '母亲', '家长', '祖父母', '其他监护人'];
const PERIODS = ['月付', '学期付', '季付'];
const BUS_PERIOD = '月付';
const BUS_PERIOD_ONLY = '当前仅支持月付计价，暂不支持学期付/季付';
const SLOT_MAX = 30, SLOT_TEXT_MAX = 60, SLOT_DURATION = 60;
const SESSION_MAX = 20;

/* ---------------- 目录 ---------------- */
function catalog(dbRows) {
  const map = new Map(SEED_SERVICES.map(s => [s.id, lib.clone(s)]));
  for (const custom of Array.isArray(dbRows) ? dbRows : []) {
    if (!custom || typeof custom.id !== 'string') continue;
    if (map.has(custom.id)) map.set(custom.id, Object.assign({}, map.get(custom.id), lib.clone(custom)));
    else map.set(custom.id, Object.assign({}, lib.clone(custom), { builtin: false }));
  }
  return [...map.values()];
}

function findService(list, id) { return (Array.isArray(list) ? list : []).find(s => s.id === id) || null; }

async function soldCounts() {
  const found = await db.collection('orders')
    .where({ status: db.command.in(['paid', 'completed']) })
    .field({ serviceId: true })
    .get();
  const counts = {};
  for (const row of found.data || []) counts[row.serviceId] = (counts[row.serviceId] || 0) + 1;
  return counts;
}

async function institutionsOf(services) {
  const overrides = (await db.collection('institutions').get()).data || [];
  const approved = await common.approvedInstitutions(db);
  return lib.buildInstitutions(services, overrides, approved);
}

function decorate(s, institutions, sold) {
  const used = sold[s.id] || 0;
  let out = Object.assign({}, s, { remaining: Number(s.remaining || 0) - used });
  if (s.type === 'tutor' && !out.calendar) {
    out.calendar = { mode: 'slot', slotDurationMinutes: 60, slots: [...TUTOR_SLOTS], note: '仅上述固定时段可约，不支持指定日期。' };
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

/* ---------------- 排期校验 ---------------- */
function validSlotText(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= SLOT_TEXT_MAX && v.trim() === v;
}
function validateCalendar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) common.bad('排期格式不正确');
  for (const key of Object.keys(input)) {
    if (!['slots', 'mode', 'slotDurationMinutes'].includes(key)) common.bad('不支持的排期字段：' + key);
  }
  if (!Array.isArray(input.slots)) common.bad('排期时段须为字符串数组');
  if (input.slots.length < 1) common.bad('至少需要 1 个可约时段');
  if (input.slots.length > SLOT_MAX) common.bad('可约时段最多 ' + SLOT_MAX + ' 条');
  const slots = [];
  const seen = new Set();
  for (const raw of input.slots) {
    if (typeof raw !== 'string') common.bad('排期时段须为字符串');
    if (!validSlotText(raw)) common.bad('时段不能为空、不含首尾空格，且每条最多 ' + SLOT_TEXT_MAX + ' 字');
    if (seen.has(raw)) common.bad('可约时段不能重复：' + raw);
    seen.add(raw);
    slots.push(raw);
  }
  if (input.mode !== undefined && input.mode !== 'slot') common.bad('排期模式仅支持固定时段（slot）');
  if (input.slotDurationMinutes !== undefined && Number(input.slotDurationMinutes) !== SLOT_DURATION) {
    common.bad('当前仅支持 ' + SLOT_DURATION + ' 分钟时长的时段');
  }
  return { mode: 'slot', slotDurationMinutes: SLOT_DURATION, slots };
}
function serviceSlots(s) {
  return Array.isArray(s && s.calendar && s.calendar.slots) ? s.calendar.slots : (s && s.type === 'tutor' ? [...TUTOR_SLOTS] : []);
}

/* ---------------- 服务补丁校验（白名单） ---------------- */
function normalizeServicePatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) common.bad('服务内容格式不正确');
  const allowed = new Set([...lib.SERVICE_EDITABLE, 'type', 'tutorDetail', 'busDetail', 'pickupDetail', 'images', 'merchantDetail', 'calendar', 'packages', 'learning']);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) common.bad('不支持的字段：' + key);
  const out = {};
  if (raw.type !== undefined && !lib.TYPES.includes(raw.type)) common.bad('请选择有效的服务类型');
  for (const key of lib.SERVICE_EDITABLE) {
    if (raw[key] === undefined) continue;
    if (key === 'price') {
      const n = Number(raw[key]);
      if (!Number.isFinite(n) || n <= 0 || n > 100000) common.bad('价格须为 0.01–100000 元');
      out.price = Math.round(n * 100) / 100;
      continue;
    }
    if (key === 'remaining') {
      const n = Number(raw[key]);
      if (!Number.isInteger(n) || n < 0 || n > 10000) common.bad('名额须为 0–10000 的整数');
      out.remaining = n;
      continue;
    }
    if (key === 'tone') { if (!lib.TONES.includes(raw.tone)) common.bad('请选择有效的配色'); out.tone = raw.tone; continue; }
    if (key === 'icon') { const v = lib.str(raw.icon, 4); if (!v) common.bad('请填写图标'); out.icon = v; continue; }
    const max = key === 'description' ? 1000 : key === 'title' ? 40 : key === 'city' ? 20 : 100;
    const v = lib.str(raw[key], max);
    if (!v) common.bad('请填写' + key);
    out[key] = v;
  }
  if (raw.images !== undefined) {
    if (!lib.validImages(raw.images)) common.bad('图片来源必须是 name + kind + tone/caption 的对象数组，最多 8 条');
    out.images = raw.images.map(i => ({
      name: lib.str(i.name, 60), kind: i.kind || 'photo',
      tone: lib.TONES.includes(i.tone) ? i.tone : 'peach', caption: lib.str(i.caption, 120)
    }));
  }
  if (raw.learning !== undefined) out.learning = normalizeLearning(raw.learning);
  if (raw.tutorDetail !== undefined) {
    const t = raw.tutorDetail;
    if (!t || typeof t !== 'object' || Array.isArray(t)) common.bad('伴学资料格式不正确');
    const td = {};
    for (const key of ['name', 'school', 'major', 'education', 'experience', 'intro', 'certificate', 'grades']) {
      if (t[key] === undefined) continue;
      const v = lib.str(t[key], 100);
      if (!v) common.bad('伴学资料字段不能为空：' + key);
      td[key] = v;
    }
    for (const key of ['subjects', 'methods']) {
      if (t[key] === undefined) continue;
      if (!Array.isArray(t[key]) || t[key].length > 10) common.bad('伴学' + key + '须为数组，最多 10 项');
      const list = t[key].map(x => lib.str(x, 30));
      if (list.some(x => !x)) common.bad('伴学' + key + '不能包含空值');
      td[key] = list;
    }
    if (t.rating !== undefined) {
      const r = t.rating;
      if (!r || typeof r !== 'object' || Array.isArray(r)) common.bad('伴学星级格式不正确');
      const score = Number(r.score);
      const count = Number(r.count);
      if (!Number.isFinite(score) || score < 0 || score > 5) common.bad('伴学星级须为 0–5');
      if (r.count !== undefined && (!Number.isInteger(count) || count < 0 || count > 100000)) common.bad('评价数须为非负整数');
      td.rating = { score: Math.round(score * 10) / 10, count: Number.isInteger(count) ? count : 0 };
    }
    out.tutorDetail = td;
  }
  if (raw.busDetail !== undefined) {
    const bd = raw.busDetail;
    if (!bd || typeof bd !== 'object' || Array.isArray(bd)) common.bad('校车资料格式不正确');
    const out2 = {};
    for (const key of ['driver', 'plate', 'vehicle', 'phone']) {
      if (bd[key] === undefined) continue;
      const v = lib.str(bd[key], 60);
      if (!v) common.bad('校车资料字段不能为空：' + key);
      out2[key] = v;
    }
    if (bd.period !== undefined) {
      if (!Array.isArray(bd.period) || !bd.period.length || bd.period.length > 5) common.bad('订购周期须为 1–5 项数组');
      const list = bd.period.map(x => lib.str(x, 10));
      if (list.some(x => !PERIODS.includes(x))) common.bad('订购周期只能为：' + PERIODS.join('、'));
      if (list.some(x => x !== BUS_PERIOD)) common.bad('当前仅支持月付计价，订购周期不能包含学期付或季付');
      out2.period = [...new Set(list)];
    }
    if (bd.routes !== undefined) {
      if (!Array.isArray(bd.routes) || bd.routes.length < 2 || bd.routes.length > 20) common.bad('线路须为 2–20 个站点');
      const stationOf = new Map();
      const routes = bd.routes.map(r => {
        if (!r || typeof r !== 'object') common.bad('站点格式不正确');
        const name = lib.str(r.name, 40), arrival = lib.str(r.arrival, 5), departure = lib.str(r.departure, 5);
        if (!name) common.bad('站点名称不能为空');
        if (stationOf.has(name)) common.bad('站点名称重复：' + name);
        if (!TIME.test(arrival) || !TIME.test(departure)) common.bad('站点到达/出发时间须为 HH:mm');
        if (timeToMinutes(departure) < timeToMinutes(arrival)) common.bad('站点出发时间不能早于到达时间：' + name);
        for (const prev of stationOf.values()) {
          if (timeToMinutes(arrival) < timeToMinutes(prev.departure)) common.bad('站点到达时间不能早于上一站出发时间：' + name);
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
    if (!pd || typeof pd !== 'object' || Array.isArray(pd)) common.bad('帮忙接资料格式不正确');
    const out3 = {};
    for (const key of ['person', 'gender', 'area', 'school', 'childGrade', 'schoolGate', 'timeText', 'vehicle', 'credit', 'note']) {
      if (pd[key] === undefined) continue;
      out3[key] = lib.str(pd[key], 120);
    }
    if (pd.kind !== undefined) {
      if (pd.kind !== 'car' && pd.kind !== 'pickup') common.bad('帮忙接类型不正确');
      out3.kind = pd.kind;
    }
    if (!out3.person) common.bad('请填写接送人姓名');
    for (const [key, min, max] of [['years', 0, 60], ['seat', 1, 6], ['used', 0, 6]]) {
      if (pd[key] === undefined) continue;
      const n = Number(pd[key]);
      if (!Number.isInteger(n) || n < min || n > max) common.bad('帮忙接人数须为 ' + min + '–' + max + ' 的整数');
      out3[key] = n;
    }
    if (out3.used !== undefined && out3.seat !== undefined && out3.used > out3.seat) common.bad('已接人数不能超过可接人数');
    if (pd.idChecked !== undefined) out3.idChecked = !!pd.idChecked;
    if (pd.routes !== undefined) {
      if (!Array.isArray(pd.routes) || pd.routes.length < 2 || pd.routes.length > 6) common.bad('帮忙接的接送点须为 2–6 个');
      out3.routes = pd.routes.map(r => {
        if (!r || typeof r !== 'object' || Array.isArray(r)) common.bad('接送点格式不正确');
        const name = lib.str(r.name, 40);
        if (!name) common.bad('接送点名称不能为空');
        return { name: name, arrival: lib.str(r.arrival, 5), departure: lib.str(r.departure, 5) };
      });
    }
    out.pickupDetail = out3;
  }
  if (raw.merchantDetail !== undefined) {
    const md = raw.merchantDetail;
    if (!md || typeof md !== 'object' || Array.isArray(md)) common.bad('机构资料格式不正确');
    const info = {};
    for (const key of ['name', 'logo', 'intro', 'address', 'contact', 'phone']) {
      if (md[key] === undefined) continue;
      const v = lib.str(md[key], key === 'intro' ? 500 : 100);
      if (!v) common.bad('机构资料字段不能为空：' + key);
      info[key] = v;
    }
    if (md.foundYear !== undefined) {
      const y = Number(md.foundYear);
      if (!Number.isInteger(y) || y < 1900 || y > 2100) common.bad('成立年份不合法');
      info.foundYear = y;
    }
    if (md.verified !== undefined) {
      if (typeof md.verified !== 'boolean') common.bad('认证状态须为布尔值');
      info.verified = md.verified;
    }
    for (const key of ['licenses', 'teachers']) {
      if (md[key] === undefined) continue;
      if (!Array.isArray(md[key]) || md[key].length > 20) common.bad('机构' + key + '须为数组，最多 20 项');
      const list = md[key].map(x => lib.str(x, 100));
      if (list.some(x => !x)) common.bad('机构' + key + '不能包含空值');
      info[key] = list;
    }
    out.merchantDetail = info;
  }
  if (raw.calendar !== undefined) out.calendar = validateCalendar(raw.calendar);
  if (raw.packages !== undefined) out.packages = lib.normalizePackages(raw.packages);
  return out;
}

function timeToMinutes(t) { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }

/* 套餐里引用的云存储 fileID（归属校验用） */
function cloudVideoIds(packages) {
  const ids = [];
  for (const item of Array.isArray(packages) ? packages : []) {
    if (item && typeof item.videoUrl === 'string' && item.videoUrl.startsWith('cloud://')) ids.push(item.videoUrl);
  }
  return ids;
}
async function ownVideoFileIDs(institutionId) {
  const found = await db.collection('uploads').where({ institutionId }).get();
  return new Set((found.data || []).map(r => r.fileID).filter(Boolean));
}

/* 机构账号的绑定：已通过 + 机构类申请 */
async function institutionBinding(user) {
  if (!user || user.role !== 'institution') return null;
  const application = await common.latestApplication(db, user);
  if (!application || application.status !== 'approved') return null;
  const boundId = await common.institutionIdOfUser(db, user);
  if (!boundId) return null;
  return { institutionId: boundId, name: application.institutionName || application.name };
}

/* ---------------- 主处理 ---------------- */
async function handle(event) {
  const action = event.action;

  if (action === 'list') {
    const rows = await db.collection('services').get();
    const list = catalog(rows.data || []);
    const institutions = await institutionsOf(list);
    const sold = await soldCounts();
    const decorated = list.map(s => decorate(s, institutions, sold));
    const type = lib.str(event.type, 10);
    return common.ok(type ? decorated.filter(s => s.type === type) : decorated);
  }

  if (action === 'availability') {
    const id = lib.str(event.id, 64);
    const rows = await db.collection('services').get();
    const s = findService(catalog(rows.data || []), id);
    if (!s) common.bad('服务不存在', 404);
    if (s.type !== 'tutor') common.bad('仅伴学服务支持按日期查询可约时段');
    const date = lib.str(event.date, 10);
    if (!date) common.bad('请提供查询日期 date=YYYY-MM-DD');
    if (!common.validDate(date)) common.bad('日期格式应为 YYYY-MM-DD 且真实存在');
    const weekday = common.weekdayLabel(date);
    const taken = new Set();
    const orders = (await db.collection('orders').where({ serviceId: id, status: db.command.in(['paid', 'completed']) }).get()).data || [];
    for (const o of orders) {
      for (const item of orderSessions(o)) if (item.date === date) taken.add(item.slot);
    }
    const slots = serviceSlots(s).filter(slot => common.slotWeekday(slot) === weekday);
    return common.ok({ date, slots: slots.map(slot => ({ slot, available: !taken.has(slot) })) });
  }

  if (action === 'create' || action === 'update') {
    const user = await common.resolveUser(db, event);
    const binding = await institutionBinding(user);
    if (!binding) common.bad('仅已审核通过的机构账号可以发布或修改课程', 403);
    /* 剥掉信封字段（token/action/id），剩下的才是业务补丁 */
    const raw = {};
    for (const [k, v] of Object.entries(event)) {
      if (k === 'token' || k === 'action' || k === 'id') continue;
      raw[k] = v;
    }
    if (action === 'create') {
      if (!lib.TYPES.includes(raw.type)) common.bad('请选择有效的服务类型');
      if (raw.type !== 'course' && raw.packages !== undefined) common.bad('仅课程服务支持套餐');
      if (raw.type !== 'course') common.bad('机构账号只能发布课程', 403);
    }
    const rows = await db.collection('services').get();
    const list = catalog(rows.data || []);
    const patch = normalizeServicePatch(raw);
    if (raw.merchant !== undefined && lib.str(raw.merchant, 100) !== binding.name) {
      common.bad('课程只能发布到自己机构名下', 403);
    }
    patch.merchant = binding.name;
    if (action === 'create') {
      for (const key of ['title', 'merchant', 'category', 'price', 'unit']) {
        if (patch[key] === undefined && raw[key] === undefined) common.bad('缺少字段：' + key);
      }
    }
    if (patch.packages !== undefined) {
      const allowed = await ownVideoFileIDs(binding.institutionId);
      for (const fileID of cloudVideoIds(patch.packages)) {
        if (!allowed.has(fileID)) common.bad('只能引用本机构上传的课程视频', 403);
      }
    }
    if (action === 'create') {
      const id = common.newId('svc');
      const now = new Date().toISOString();
      const doc = Object.assign({}, patch, {
        _id: id, id, type: raw.type,
        icon: patch.icon || '📘', tone: patch.tone || 'peach',
        unit: patch.unit || '课时', tag: patch.tag || '自定义',
        description: patch.description || '', location: patch.location || '演示地址',
        city: patch.city || '哈尔滨',
        remaining: patch.remaining === undefined ? 10 : patch.remaining,
        builtin: false, createdAt: now, updatedAt: now
      });
      for (const key of ['title', 'merchant', 'category']) {
        if (!doc[key] || doc[key] === '') common.bad('请填写' + key);
      }
      if (doc.type === 'course' && patch.packages !== undefined) {
        doc.packages = lib.assignPackageIds(patch.packages, () => common.newId('pkg'));
      }
      await db.collection('services').add({ data: doc });
      const institutions = await institutionsOf(catalog((await db.collection('services').get()).data || []));
      const sold = await soldCounts();
      return common.ok(decorate(doc, institutions, sold));
    }
    /* update */
    const id = lib.str(event.id, 64);
    const current = findService(list, id);
    if (!current) common.bad('服务不存在', 404);
    if (current.type !== 'course') common.bad('机构账号只能修改课程', 403);
    if (current.merchant !== binding.name) common.bad('只能修改自己机构名下的课程', 403);
    if (raw.merchant !== undefined && lib.str(raw.merchant, 100) !== binding.name) {
      common.bad('不能把课程转到其他机构名下', 403);
    }
    if (current.type !== 'course' && raw.packages !== undefined) common.bad('仅课程服务支持套餐');
    const existing = (await db.collection('services').where({ _id: id }).limit(1).get()).data[0];
    const base = existing ? Object.assign({}, existing) : { type: current.type };
    const next = Object.assign({}, base, patch, { _id: id, id, updatedAt: new Date().toISOString() });
    if (patch.images !== undefined) next.images = patch.images;
    else if (base.images === undefined && current.images !== undefined) next.images = lib.clone(current.images);
    for (const key of ['tutorDetail', 'busDetail', 'merchantDetail']) {
      if (patch[key] !== undefined) next[key] = mergeDetail(base[key] || current[key], patch[key]);
    }
    if (patch.calendar !== undefined) next.calendar = mergedCalendar(base.calendar || current.calendar, patch.calendar);
    if (patch.packages !== undefined) next.packages = lib.assignPackageIds(patch.packages, () => common.newId('pkg'));
    delete next.builtin;
    await db.collection('services').doc(id).set({ data: next });
    const institutions = await institutionsOf(catalog((await db.collection('services').get()).data || []));
    const sold = await soldCounts();
    return common.ok(decorate(Object.assign({}, current, next), institutions, sold));
  }

  if (action === 'tempUrl') {
    const fileIDs = Array.isArray(event.fileIDs) ? event.fileIDs.filter(x => typeof x === 'string' && x.startsWith('cloud://')).slice(0, 20) : [];
    if (!fileIDs.length) return common.ok([]);
    const res = await cloud.getTempFileURL({ fileList: fileIDs });
    return common.ok((res.fileList || []).map(f => ({
      fileID: f.fileID,
      tempFileURL: f.tempFileURL || '',
      status: f.status
    })));
  }

  if (action === 'recordVideo') {
    const user = await common.resolveUser(db, event);
    const binding = await institutionBinding(user);
    if (!binding) common.bad('仅已审核通过的机构账号可以上传课程视频', 403);
    const fileID = lib.str(event.fileID, 300);
    if (!fileID.startsWith('cloud://')) common.bad('视频文件 ID 不正确');
    await db.collection('uploads').add({
      data: {
        fileID, name: lib.str(event.name, 200), size: Number(event.size) || 0,
        type: lib.str(event.type, 60), institutionId: binding.institutionId,
        userId: user._id, createdAt: new Date().toISOString()
      }
    });
    return common.ok({ fileID });
  }

  return common.fail('接口不存在', 404);
}

/* 订单占用的「日期+时段」 */
function orderSessions(o) {
  if (Array.isArray(o.sessions) && o.sessions.length) {
    return o.sessions.filter(x => x && typeof x.date === 'string' && typeof x.slot === 'string');
  }
  if (o.type === 'tutor' && o.slot) return [{ date: typeof o.date === 'string' ? o.date : '', slot: o.slot }];
  return [];
}

/* 嵌套资料按字段合并，避免一次局部更新抹掉旧数据里的其他字段 */
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
  if (out.note === undefined) out.note = '演示排期：仅上述固定时段可约，不承诺真实日期。';
  return out;
}

exports.main = async (event) => common.entry(handle, event);
