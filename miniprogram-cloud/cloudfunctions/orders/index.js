/* 学鹭伴学 · 订单云函数
 *
 * action:
 *   list      我的订单（登录用户只看自己的）
 *   create    下单（课程选套餐 / 伴学按日期选多个课次 / 校车选上下车站点）
 *   pay       模拟支付（串行校验名额与时段冲突，成功发核销码）
 *   cancel    取消待支付订单
 *   complete  核销已支付订单
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const lib = require('./institution-lib.js');
const { SEED_SERVICES, TUTOR_SLOTS } = require('./seed-data.js');

cloud.init({ traceUser: false });
const db = cloud.database();

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
function serviceSlots(s) {
  return Array.isArray(s && s.calendar && s.calendar.slots) ? s.calendar.slots : (s && s.type === 'tutor' ? [...TUTOR_SLOTS] : []);
}
async function serviceById(id) {
  const rows = (await db.collection('services').get()).data || [];
  return findService(catalog(rows), id) || null;
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

/* ---------------- 校验 ---------------- */
const PHONE = /^1\d{10}$/;
const PERIODS = ['月付', '学期付', '季付'];
const BUS_PERIOD = '月付';
const RELATIONS = ['父亲', '母亲', '家长', '祖父母', '其他监护人'];
const GENDERS = ['男', '女', '未填写'];
const SESSION_MAX = 20;
const SLOT_DURATION = 60;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const WEEKDAYS = common.WEEKDAYS;
const timeToMinutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function validateExtra(s, b) {
  const out = {};
  const guardian = text(b.guardian, 30);
  if (guardian) out.guardian = guardian;
  const relation = text(b.relation, 20);
  if (relation) {
    if (!RELATIONS.includes(relation)) common.bad('请选择有效的监护人关系');
    out.relation = relation;
  }
  const phone = text(b.guardianPhone, 20);
  if (phone) {
    if (!PHONE.test(phone)) common.bad('监护人手机号格式不正确');
    out.guardianPhone = phone;
  }
  if (b.age !== undefined && b.age !== null && b.age !== '') {
    const n = Number(b.age);
    if (!Number.isInteger(n) || n < 1 || n > 99) common.bad('学员年龄须为 1–99 的整数');
    out.age = n;
  }
  const gender = text(b.gender, 10);
  if (gender) {
    if (!GENDERS.includes(gender)) common.bad('请选择有效的性别');
    out.gender = gender;
  }
  const address = text(b.address, 200);
  if (address) out.address = address;
  if (s.type === 'bus') {
    const route = (s.busDetail && s.busDetail.routes) || s.routes || [];
    const start = text(b.startPoint, 60), end = text(b.endPoint, 60);
    if (start || end) {
      if (!start || !end) common.bad('请同时选择上车站点和下车站点');
      const names = route.map(r => r.name);
      const i = names.indexOf(start), j = names.indexOf(end);
      if (i < 0) common.bad('上车站点不在该线路内');
      if (j < 0) common.bad('下车站点不在该线路内');
      if (j <= i) common.bad('下车站点必须位于上车站点之后');
      out.startPoint = start;
      out.endPoint = end;
    }
    const period = text(b.period, 10);
    if (period) {
      if (!PERIODS.includes(period)) common.bad('请选择有效的订购周期');
      if (period !== BUS_PERIOD) common.bad('当前仅支持月付计价，暂不支持学期付/季付');
      const allowed = (s.busDetail && s.busDetail.period) || s.period || PERIODS;
      if (!allowed.includes(period)) common.bad('该线路不支持所选订购周期');
      out.period = period;
    }
  }
  if (s.type === 'course') {
    const date = text(b.date, 10);
    if (date) {
      if (!common.validDate(date)) common.bad('请选择有效的上课日期');
      out.date = date;
    }
  }
  if (s.type === 'tutor') {
    const date = text(b.date, 10);
    if (date) {
      if (!common.validDate(date)) common.bad('请选择有效的预约日期');
      out.date = date;
      out.dateStatus = 'requested';
    }
  }
  return out;
}

function validateSessions(s, input) {
  if (!Array.isArray(input)) common.bad('预约时段须为数组');
  if (input.length < 1) common.bad('请至少选择 1 个预约时段');
  if (input.length > SESSION_MAX) common.bad('一次最多预约 ' + SESSION_MAX + ' 个时段');
  const available = serviceSlots(s);
  const today = common.cnToday();
  const seen = new Set();
  const sessions = input.map((raw, index) => {
    const at = '第 ' + (index + 1) + ' 个预约时段';
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) common.bad(at + '格式不正确');
    for (const key of Object.keys(raw)) if (!['date', 'slot'].includes(key)) common.bad(at + '不支持字段：' + key);
    const date = text(raw.date, 10), slot = typeof raw.slot === 'string' ? raw.slot : '';
    if (!common.validDate(date)) common.bad(at + '的日期格式应为 YYYY-MM-DD 且真实存在');
    if (date < today) common.bad(at + '的日期已过，请选择今天或之后的日期');
    if (!slot) common.bad(at + '缺少时段');
    if (!available.includes(slot)) common.bad('请选择有效的预约时段');
    const weekday = common.slotWeekday(slot);
    if (!weekday) common.bad('该时段未配置星期，暂不支持按日期预约：' + slot);
    if (WEEKDAYS[weekday] !== common.weekdayOf(date)) {
      common.bad(at + '的日期 ' + date + ' 是' + common.weekdayLabel(date) + '，与时段「' + slot + '」不一致');
    }
    const key = date + '|' + slot;
    if (seen.has(key)) common.bad('预约时段重复：' + date + ' ' + slot);
    seen.add(key);
    return { date, slot };
  });
  sessions.sort((a, b) => (a.date === b.date
    ? serviceSlots(s).indexOf(a.slot) - serviceSlots(s).indexOf(b.slot)
    : a.date < b.date ? -1 : 1));
  return sessions;
}

/* ---------------- 主处理 ---------------- */
async function handle(event) {
  const action = event.action;

  if (action === 'list') {
    /* 平台管理：管理员可查看全部订单 */
    if (event.all) {
      if (!common.isAdmin(event)) return common.fail('需要平台管理员令牌', 403);
      const rows = await db.collection('orders').orderBy('createdAt', 'desc').limit(200).get();
      return common.ok(rows.data || []);
    }
    const user = await common.resolveUser(db, event);
    const found = await db.collection('orders').where({ userId: user._id }).get();
    return common.ok(found.data || []);
  }

  if (action === 'create') {
    const user = await common.resolveUser(db, event);
    const b = {};
    for (const [k, v] of Object.entries(event)) {
      if (k === 'token' || k === 'action') continue;
      b[k] = v;
    }
    const s = await serviceById(text(b.serviceId, 64));
    if (!s) common.bad('服务不存在', 404);
    const student = text(b.student, 30), phone = text(b.phone, 20);
    if (!student || !PHONE.test(phone)) common.bad('请填写学生姓名和有效的 11 位手机号');
    const slots = serviceSlots(s);
    const multi = b.sessions !== undefined;
    if (multi && s.type !== 'tutor') common.bad('仅伴学服务支持按日期多时段预约');
    if (multi && b.slot !== undefined) common.bad('多时段预约请通过 sessions 提交时段，不要同时传 slot');
    const sessions = multi ? validateSessions(s, b.sessions) : null;
    if (!multi && s.type === 'tutor') {
      const slot = text(b.slot, 60);
      if (!slots.includes(slot)) common.bad('请选择有效的预约时段');
      if (b.date !== undefined && b.date !== null && b.date !== '') {
        const weekday = common.slotWeekday(slot);
        if (!weekday) common.bad('该时段未配置星期，暂不支持按日期预约：' + slot);
        const day = text(b.date, 10);
        if (common.validDate(day) && day > common.cnToday() && WEEKDAYS[weekday] !== common.weekdayOf(day)) {
          common.bad('预约日期与所选时段的星期不一致');
        }
      }
    }
    const extra = validateExtra(s, b);
    let chosen = null;
    const packageId = b.packageId === undefined || b.packageId === null || b.packageId === '' ? '' : text(b.packageId, 64);
    if (packageId) {
      if (s.type !== 'course') common.bad('仅课程服务支持选择套餐');
      chosen = lib.findPackage(s, packageId);
      if (!chosen) common.bad('套餐不存在或已下架', 404);
    }
    const orderId = common.newId('o');
    const now = new Date().toISOString();
    const order = {
      _id: orderId, id: orderId, number: 'ED' + Date.now(),
      serviceId: s.id, title: s.title, type: s.type, student, phone,
      amount: chosen ? chosen.price : s.price, status: 'pending',
      userId: user._id, createdAt: now, ...extra
    };
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
    await db.collection('orders').add({ data: order });
    return common.ok(order);
  }

  const orderId = text(event.id, 64);
  if (action === 'pay' || action === 'cancel' || action === 'complete') {
    /* 核销允许平台管理员代为操作，支付与取消仍限本人 */
    const adminComplete = action === 'complete' && common.isAdmin(event);
    const user = adminComplete ? null : await common.resolveUser(db, event);
    const found = await db.collection('orders').where({ id: orderId }).limit(1).get();
    const order = found.data && found.data[0];
    if (!order) common.bad('订单不存在', 404);
    if (!adminComplete && order.userId !== user._id) common.bad('无权操作他人订单', 403);
    const s = await serviceById(order.serviceId);
    if (action === 'pay') {
      if (order.status !== 'pending') common.bad('仅待支付订单可以支付', 409);
      if (!s) common.bad('服务已下架，无法支付', 409);
      const sessions = orderSessions(order);
      if (order.type === 'tutor' && sessions.length && Array.isArray(order.slotsSnapshot)) {
        for (const item of sessions) {
          if (!order.slotsSnapshot.includes(item.slot)) common.bad('该预约时段已不可用，请重新选择时段下单', 409);
        }
      }
      const activeFound = await db.collection('orders')
        .where({ serviceId: order.serviceId, status: db.command.in(['paid', 'completed']) })
        .get();
      const active = (activeFound.data || []).filter(x => x.id !== order.id);
      if (s.type === 'tutor') {
        const taken = new Set();
        for (const x of active) {
          for (const item of orderSessions(x)) taken.add((item.date || '*') + '|' + item.slot);
        }
        for (const item of sessions) {
          if (taken.has((item.date || '*') + '|' + item.slot) || (!item.date && taken.has('*|' + item.slot))) {
            common.bad('当前名额或预约时段已售出', 409);
          }
        }
      }
      if (s.type !== 'tutor' && active.length >= Number(s.remaining || 0)) common.bad('当前名额或预约时段已售出', 409);
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      await db.collection('orders').doc(order._id).update({ data: { status: 'paid', code } });
      order.status = 'paid';
      order.code = code;
      return common.ok(order);
    }
    if (action === 'complete') {
      if (order.status !== 'paid') common.bad('仅已支付订单可以核销', 409);
      await db.collection('orders').doc(order._id).update({ data: { status: 'completed' } });
      order.status = 'completed';
      return common.ok(order);
    }
    if (order.status !== 'pending') common.bad('仅待支付订单可以取消', 409);
    await db.collection('orders').doc(order._id).update({ data: { status: 'cancelled' } });
    order.status = 'cancelled';
    return common.ok(order);
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
