/* 学鹭伴学 · 静态内容云函数（帮助中心 / 关于平台 / 联系我们 / 分类） */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const { SEED_CONTENT } = require('./seed-data.js');

cloud.init({ traceUser: false });

async function handle(event) {
  if (event.action === 'all') return common.ok(SEED_CONTENT);
  const part = common.text(event.part, 20);
  if (part && SEED_CONTENT[part]) return common.ok(SEED_CONTENT[part]);
  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
