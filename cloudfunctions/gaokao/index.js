/* 学鹭伴学 · 高考志愿模拟填报云函数
 *
 * 院校、排名、分数线全部由「院校 id + 年份 + 省份 + 专业」的哈希种子确定性生成，
 * 不需要数据库，同一请求永远得到同一结果。全部为模拟数据。
 *
 * action:
 *   meta           元数据（年份/省份/层次/类型/联盟/科目/数据规模）
 *   universities   院校列表（筛选 + 排序 + 分页）
 *   detail         院校详情（专业 + 近十年走势 + 各省投档线）
 *   majorSeries    某专业近十年走势
 *   recommend      冲稳保推荐
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const gk = require('./gaokao-model.js');

cloud.init({ traceUser: false });

function text(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function int(v, min, max, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) common.bad('参数须为 ' + min + '–' + max + ' 的整数');
  return n;
}

async function handle(event) {
  const action = event.action;

  if (action === 'meta') return common.ok(gk.meta());

  if (action === 'universities') {
    return common.ok(gk.listUniversities({
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
    if (!uni) common.bad('院校不存在', 404);
    return common.ok(gk.detail(uni, text(event.province, 40) || '黑龙江', int(event.year, 2016, 2025, 2025)));
  }

  if (action === 'majorSeries') {
    const uni = gk.findUniversity(text(event.id, 64));
    if (!uni) common.bad('院校不存在', 404);
    const result = gk.majorSeries(uni, text(event.major, 60), text(event.province, 40) || '黑龙江');
    if (!result) common.bad('该院校没有这个专业', 404);
    return common.ok(result);
  }

  if (action === 'recommend') {
    return common.ok(gk.recommend({
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

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
