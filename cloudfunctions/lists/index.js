/* 学鹭伴学 · 本地清单云函数（模拟志愿表 / 报考清单）
 *
 * 网页版把这两张清单存在浏览器 localStorage；小程序版按账号存到云数据库，
 * 换设备也能看到自己的清单。
 *
 * action:
 *   admissionGet   读取我的模拟志愿表
 *   admissionSave  保存模拟志愿表（最多 60 行）
 *   examGet        读取我的报考清单
 *   examSave       保存报考清单（最多 60 行）
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');

cloud.init({ traceUser: false });
const db = cloud.database();

function text(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

async function readList(db, userId, field) {
  const found = await db.collection('lists').where({ userId, field }).limit(1).get();
  const row = found.data && found.data[0];
  return row && Array.isArray(row.rows) ? row.rows : [];
}

async function writeList(db, userId, field, rows) {
  const found = await db.collection('lists').where({ userId, field }).limit(1).get();
  const row = found.data && found.data[0];
  const now = new Date().toISOString();
  if (row) {
    await db.collection('lists').doc(row._id).update({ data: { rows, updatedAt: now } });
  } else {
    await db.collection('lists').add({ data: { userId, field, rows, updatedAt: now } });
  }
}

async function handle(event) {
  const user = await common.resolveUser(db, event);
  const action = event.action;

  if (action === 'admissionGet') return common.ok(await readList(db, user._id, 'admission'));
  if (action === 'admissionSave') {
    const rows = Array.isArray(event.rows) ? event.rows.slice(0, 60) : [];
    for (const r of rows) {
      if (!r || typeof r !== 'object' || !text(r.id, 64) || !text(r.name, 60)) common.bad('志愿行缺少院校信息');
    }
    await writeList(db, user._id, 'admission', rows);
    return common.ok(rows);
  }
  if (action === 'examGet') return common.ok(await readList(db, user._id, 'exam'));
  if (action === 'examSave') {
    const rows = Array.isArray(event.rows) ? event.rows.slice(0, 60) : [];
    for (const r of rows) {
      if (!r || typeof r !== 'object' || !text(r.id, 64)) common.bad('清单行缺少条目信息');
    }
    await writeList(db, user._id, 'exam', rows);
    return common.ok(rows);
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
