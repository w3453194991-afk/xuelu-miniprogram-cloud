/* 学鹭伴学 · 考公 / 考研 / 考编 云函数
 *
 * 分数线、报名人数、竞争比全部由「条目 id + 年份」的哈希种子确定性生成。
 * 全部为模拟数据。三类考试共用一套条目结构。
 *
 * action:
 *   meta        元数据（考试类型/满分/标签/学历/政治面貌）
 *   resources   备考服务推荐（机构/课程/图书，换一批改 seed）
 *   items       岗位或院校列表（筛选 + 排序 + 分页）
 *   detail      条目详情（近十年走势 / 国家线 / 报考条件）
 *   match       按我的分数做冲稳保匹配（学历/专业/政治面貌过滤）
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const ex = require('./exam-model.js');

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

  if (action === 'meta') return common.ok(ex.meta());

  if (action === 'resources') {
    const kind = text(event.kind, 10) || 'gwy';
    if (!ex.isKind(kind)) common.bad('考试类型不存在', 404);
    return common.ok(ex.resources(kind, int(event.seed, 0, 9999, 0)));
  }

  if (action === 'items') {
    const kind = text(event.kind, 10);
    if (!ex.isKind(kind)) common.bad('考试类型不存在', 404);
    return common.ok(ex.listItems({
      kind,
      region: text(event.region, 40) || undefined,
      category: text(event.category, 40) || undefined,
      examType: text(event.examType, 20) || undefined,
      education: text(event.education, 10) || undefined,
      q: text(event.q, 40),
      sort: text(event.sort, 20) || 'line',
      page: int(event.page, 1, 9999, 1),
      size: int(event.size, 1, 60, 12),
      year: int(event.year, 2016, 2025, 2025)
    }));
  }

  if (action === 'detail') {
    const kind = text(event.kind, 10);
    if (!ex.isKind(kind)) common.bad('考试类型不存在', 404);
    const item = ex.findItem(kind, text(event.id, 64));
    if (!item) common.bad('条目不存在', 404);
    return common.ok(ex.detail(item, int(event.year, 2016, 2025, 2025)));
  }

  if (action === 'match') {
    const kind = text(event.kind, 10);
    if (!ex.isKind(kind)) common.bad('考试类型不存在', 404);
    return common.ok(ex.match({
      kind,
      score: Number(event.score),
      region: text(event.region, 40) || undefined,
      education: text(event.education, 10) || undefined,
      major: text(event.major, 40) || undefined,
      category: text(event.category, 40) || undefined,
      political: text(event.political, 10) || undefined,
      limit: int(event.limit, 1, 30, 10),
      year: int(event.year, 2016, 2025, 2025)
    }));
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
