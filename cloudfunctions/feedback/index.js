/* 学鹭伴学 · 意见反馈云函数
 *
 * action:
 *   submit   提交反馈（可选登录；关联订单号会校验存在性）
 *   list     我的反馈（登录用户）
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');

cloud.init({ traceUser: false });
const db = cloud.database();

const PHONE = /^1\d{10}$/;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function handle(event) {
  if (event.action === 'submit') {
    const user = await common.optionalUser(db, event);
    const b = {};
    for (const [k, v] of Object.entries(event)) {
      if (k === 'token' || k === 'action') continue;
      b[k] = v;
    }
    const categories = ['课程', '伴学', '校车', '订单', '账号', '其他'];
    const category = b.category === undefined ? '其他' : text(b.category, 10);
    if (!categories.includes(category)) common.bad('请选择有效的反馈类型');
    const content = text(b.content, 500);
    if (content.length < 5) common.bad('反馈内容请填写 5–500 字');
    const contact = text(b.contact, 60);
    if (contact && !PHONE.test(contact) && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(contact)) common.bad('联系方式须为手机号或邮箱');
    const orderNumber = text(b.orderNumber, 30);
    if (orderNumber) {
      const found = await db.collection('orders').where({ number: orderNumber }).limit(1).get();
      if (!found.data || !found.data.length) common.bad('订单号不存在', 404);
    }
    let rating = null;
    if (b.rating !== undefined && b.rating !== null && b.rating !== '') {
      const n = Number(b.rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) common.bad('评分须为 1–5');
      rating = n;
    }
    const id = common.newId('f');
    const item = {
      _id: id, id, category, content, contact, orderNumber, rating,
      userId: user ? user._id : '',
      status: 'pending', reply: '', createdAt: new Date().toISOString()
    };
    await db.collection('feedback').add({ data: item });
    return common.ok(item);
  }

  if (event.action === 'list') {
    const user = await common.optionalUser(db, event);
    if (!user) return common.ok([]);
    const found = await db.collection('feedback').where({ userId: user._id }).get();
    return common.ok(found.data || []);
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
