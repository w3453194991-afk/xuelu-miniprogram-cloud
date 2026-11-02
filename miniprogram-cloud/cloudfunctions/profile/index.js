/* 学鹭伴学 · 学员档案云函数
 *
 * action:
 *   get     读取本人档案（含学员列表、订单数、反馈数）
 *   update  更新档案（name/address/note/students，登录用户按账号隔离）
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');

cloud.init({ traceUser: false });
const db = cloud.database();

const PHONE = /^1\d{10}$/;
const RELATIONS = ['父亲', '母亲', '家长', '祖父母', '其他监护人'];
const GENDERS = ['男', '女', '未填写'];
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function emptyProfile(phone) {
  return { name: '', phone: phone || '', address: '', students: [], note: '', updatedAt: null };
}

async function handle(event) {
  const user = await common.resolveUser(db, event);

  if (event.action === 'get') {
    const found = await db.collection('profiles').where({ userId: user._id }).limit(1).get();
    const own = found.data && found.data[0]
      ? { name: found.data[0].name || '', phone: found.data[0].phone || '', address: found.data[0].address || '',
          students: found.data[0].students || [], note: found.data[0].note || '', updatedAt: found.data[0].updatedAt || null }
      : emptyProfile(user.phone);
    const orders = (await db.collection('orders').where({ userId: user._id }).count()).total;
    const feedback = (await db.collection('feedback').where({ userId: user._id }).count()).total;
    return common.ok({ ...own, phone: own.phone || user.phone || '', orders, feedback });
  }

  if (event.action === 'update') {
    const b = {};
    for (const [k, v] of Object.entries(event)) {
      if (k === 'token' || k === 'action') continue;
      b[k] = v;
    }
    const allowed = new Set(['name', 'phone', 'address', 'students', 'note']);
    for (const key of Object.keys(b)) if (!allowed.has(key)) common.bad('不支持的字段：' + key);
    const found = await db.collection('profiles').where({ userId: user._id }).limit(1).get();
    const row = found.data && found.data[0];
    const base = row
      ? { name: row.name || '', phone: row.phone || '', address: row.address || '',
          students: row.students || [], note: row.note || '', updatedAt: row.updatedAt || null }
      : emptyProfile(user.phone);
    const next = { ...base };
    if (b.name !== undefined) {
      const v = text(b.name, 30);
      if (!v) common.bad('请填写称呼');
      next.name = v;
    }
    if (b.phone !== undefined) {
      const v = text(b.phone, 20);
      if (v && !PHONE.test(v)) common.bad('请填写有效的 11 位手机号');
      if (v && v !== user.phone) common.bad('档案手机号须与账号手机号一致', 400);
      next.phone = v;
    }
    if (b.address !== undefined) {
      const v = text(b.address, 200);
      if (!v) common.bad('请填写地址');
      next.address = v;
    }
    if (b.note !== undefined) next.note = text(b.note, 200);
    if (b.students !== undefined) {
      if (!Array.isArray(b.students) || b.students.length > 5) common.bad('学员信息须为数组，最多 5 名');
      next.students = b.students.map(st => {
        if (!st || typeof st !== 'object' || Array.isArray(st)) common.bad('学员信息格式不正确');
        const name = text(st.name, 30);
        if (!name) common.bad('请填写学员姓名');
        const item = { name, age: null, gender: '未填写', guardian: '', relation: '', phone: '' };
        if (st.age !== undefined && st.age !== null && st.age !== '') {
          const n = Number(st.age);
          if (!Number.isInteger(n) || n < 1 || n > 99) common.bad('学员年龄须为 1–99 的整数');
          item.age = n;
        }
        if (st.gender !== undefined) {
          if (!GENDERS.includes(st.gender)) common.bad('请选择有效的性别');
          item.gender = st.gender;
        }
        if (st.guardian !== undefined) item.guardian = text(st.guardian, 30);
        if (st.relation !== undefined) {
          if (st.relation && !RELATIONS.includes(st.relation)) common.bad('请选择有效的监护人关系');
          item.relation = st.relation;
        }
        if (st.phone !== undefined) {
          const v = text(st.phone, 20);
          if (v && !PHONE.test(v)) common.bad('学员监护人手机号格式不正确');
          item.phone = v;
        }
        return item;
      });
    }
    next.updatedAt = new Date().toISOString();
    const data = { userId: user._id, ...next };
    if (row) await db.collection('profiles').doc(row._id).update({ data: next });
    else await db.collection('profiles').add({ data });
    return common.ok(next);
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
