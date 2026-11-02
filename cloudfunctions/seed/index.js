/* 学鹭伴学 · 种子数据云函数
 *
 * action:
 *   run   把演示种子服务写入云数据库 services 集合（幂等：已存在不覆盖），
 *         并确保 content 集合有静态内容。首次部署云函数后在小程序里调用一次即可。
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const { SEED_SERVICES, SEED_CONTENT } = require('./seed-data.js');

cloud.init({ traceUser: false });
const db = cloud.database();

async function handle(event) {
  if (event.action !== 'run') return common.fail('接口不存在', 404);
  let inserted = 0;
  for (const service of SEED_SERVICES) {
    const found = await db.collection('services').where({ id: service.id }).limit(1).get();
    if (found.data && found.data.length) continue;
    await db.collection('services').add({
      _id: service.id,
      data: Object.assign({}, service, { builtin: true, createdAt: new Date().toISOString() })
    });
    inserted++;
  }
  const contentFound = await db.collection('content').where({ _id: 'singleton' }).limit(1).get();
  if (!contentFound.data || !contentFound.data.length) {
    await db.collection('content').add({ _id: 'singleton', data: SEED_CONTENT });
  }
  return common.ok({ inserted, total: SEED_SERVICES.length });
}

exports.main = async (event) => common.entry(handle, event);
