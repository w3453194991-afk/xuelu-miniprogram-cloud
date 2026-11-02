/* 学鹭伴学 · 升学规划云函数
 *
 * 档案与考试记录按账号存到云数据库；未登录时按微信 openid 存一份「游客档案」，
 * 换设备看不到游客档案，但登录后会跟着账号走。
 *
 * action:
 *   overview     六个板块一次拿全（档案 / 阶段 / 节点 / 差距 / 选科 / 考试统计）
 *   profileSave  保存学生档案
 *   exams        考试记录与目标线
 *   examAdd      录入一次考试
 *   examRemove   删除一条考试记录
 *   subjects     选科覆盖率分析
 *   pathways     多元升学自查
 *   reset        清空我的档案与考试
 *
 * 计算全部委托给 plan-model.js 的纯函数，这里只做校验、存取与拼装。
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const plan = require('./plan-model.js');
const gk = require('./gaokao-model.js');

cloud.init({ traceUser: false });
const db = cloud.database();
const COLLECTION = 'planProfiles';

function text(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function newId(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 10); }

const META = {
  grades: plan.GRADES,
  provinces: plan.PROVINCES.map(p => p.name),
  firstSubjects: plan.FIRST_SUBJECTS,
  secondSubjects: plan.SECOND_SUBJECTS,
  tiers: plan.TARGET_TIERS,
  interests: plan.INTERESTS
};

/* 游客也能用：没有登录态时按 openid 存一份 */
async function identityOf(event) {
  const user = await common.optionalUser(db, event);
  if (user) return { key: user._id, storage: 'db', guest: false };
  const ctx = cloud.getWXContext ? cloud.getWXContext() : {};
  const openid = ctx && ctx.OPENID ? String(ctx.OPENID) : 'anonymous';
  return { key: 'guest:' + openid, storage: 'db', guest: true };
}

async function readRecord(key) {
  const found = await db.collection(COLLECTION).where({ key }).limit(1).get();
  return (found.data && found.data[0]) || null;
}

async function writeRecord(row, patch) {
  const now = new Date().toISOString();
  if (row && row._id) {
    await db.collection(COLLECTION).doc(row._id).update({ data: Object.assign({}, patch, { updatedAt: now }) });
    return Object.assign({}, row, patch, { updatedAt: now });
  }
  const data = Object.assign({ profile: plan.defaultProfile(), exams: [] }, patch, { createdAt: now, updatedAt: now });
  const added = await db.collection(COLLECTION).add({ data: Object.assign({ key: row && row.key ? row.key : data.key }, data) });
  return Object.assign({ _id: added._id }, data);
}

/* 已存档案与默认值合并，脏数据不会让页面崩掉 */
function profileOf(row) {
  const base = plan.defaultProfile();
  const saved = row && row.profile && typeof row.profile === 'object' ? row.profile : {};
  const merged = Object.assign({}, base, saved);
  if (!plan.isGrade(merged.grade)) merged.grade = base.grade;
  if (!plan.isProvinceName(merged.province)) merged.province = base.province;
  if (!plan.FIRST_SUBJECTS.includes(merged.first)) merged.first = base.first;
  if (!Array.isArray(merged.second) || merged.second.length !== 2) merged.second = base.second;
  if (!plan.TARGET_TIERS.includes(merged.targetTier)) merged.targetTier = base.targetTier;
  if (!Array.isArray(merged.interest) || !merged.interest.length) merged.interest = base.interest;
  return merged;
}

async function handle(event) {
  const id = await identityOf(event);
  const row = await readRecord(id.key);
  const profile = profileOf(row);
  const exams = row && Array.isArray(row.exams) ? row.exams : [];
  const stats = plan.examStats(exams);
  const now = new Date();
  const action = event.action || 'overview';

  const gradeOf = () => {
    const grade = text(event.grade, 8) || profile.grade;
    if (!plan.isGrade(grade)) common.bad('年级不存在：' + grade);
    return grade;
  };
  const provinceOf = () => {
    const province = text(event.province, 20) || profile.province;
    if (!plan.isProvinceName(province)) common.bad('省份不存在：' + province);
    return province;
  };

  if (action === 'overview') {
    const grade = gradeOf();
    const province = provinceOf();
    const stage = plan.stagesFor(grade);
    return common.ok({
      profile,
      grade,
      stages: stage.stages,
      currentStage: stage.current,
      stageNote: stage.note,
      timeline: plan.timeline({ grade, now }),
      gap: plan.gapAnalysis({
        province, grade, targetTier: profile.targetTier, avgScore: stats.average, now
      }),
      exams: {
        count: stats.count, average: stats.average, latest: stats.latest,
        highest: stats.highest, lowest: stats.lowest, trend: stats.trend,
        label: stats.label, recent: stats.recent, items: plan.examList(exams)
      },
      subjects: plan.subjectAnalysis({ first: profile.first, second: profile.second, province }),
      meta: META,
      disclaimer: plan.DISCLAIMER,
      storage: id.storage
    });
  }

  if (action === 'profileSave') {
    const result = plan.normalizeProfile(event.profile || {});
    if (!result.ok) common.bad(result.errors.join('；'));
    const iso = new Date().toISOString();
    const saved = await writeRecord(row || { key: id.key }, {
      profile: Object.assign({}, result.profile, { updatedAt: iso })
    });
    return common.ok({ profile: profileOf(saved), saved: true, updatedAt: iso, disclaimer: plan.DISCLAIMER });
  }

  if (action === 'examAdd') {
    const result = plan.normalizeExam(event.exam || {});
    if (!result.ok) common.bad(result.errors.join('；'));
    const exam = Object.assign({ id: newId('pex'), createdAt: new Date().toISOString() }, result.exam);
    const next = exams.concat([exam]).slice(-60);
    await writeRecord(row || { key: id.key }, { exams: next });
    const nextStats = plan.examStats(next);
    return common.ok({
      exam,
      exams: plan.examList(next),
      count: nextStats.count, average: nextStats.average, latest: nextStats.latest, trend: nextStats.trend,
      saved: true, message: '已记录本次考试'
    });
  }

  if (action === 'examRemove') {
    const examId = text(event.id, 40);
    if (!examId) common.bad('缺少考试记录编号');
    const next = exams.filter(e => e.id !== examId);
    await writeRecord(row || { key: id.key }, { exams: next });
    return common.ok({ exams: plan.examList(next), count: next.length });
  }

  if (action === 'exams') {
    const target = plan.gapAnalysis({
      province: profile.province, grade: profile.grade,
      targetTier: profile.targetTier, avgScore: stats.average, now
    });
    return common.ok({
      exams: plan.examList(exams),
      count: stats.count, average: stats.average, latest: stats.latest,
      highest: stats.highest, lowest: stats.lowest, trend: stats.trend,
      label: stats.label, recent: stats.recent,
      targetLine: target.targetLine, targetTier: target.targetTier, gap: target.gap,
      disclaimer: plan.DISCLAIMER
    });
  }

  if (action === 'subjects') {
    const province = provinceOf();
    const first = text(event.first, 8) || profile.first;
    const second = Array.isArray(event.second) && event.second.length ? event.second : profile.second;
    const data = plan.subjectAnalysis({ first, second, province });
    if (!data.ok) common.bad(data.errors.join('；'));
    return common.ok(data);
  }

  if (action === 'pathways') {
    const province = provinceOf();
    const grade = gradeOf();
    let score = stats.average;
    if (event.score !== undefined && event.score !== null && event.score !== '') {
      const n = Number(event.score);
      if (!Number.isFinite(n)) common.bad('分数须为数字');
      const total = gk.provinceInfo(province).total;
      if (!(n > 0 && n <= total)) common.bad('分数须为 0–' + total + ' 之间的数字（' + province + '满分 ' + total + '）');
      score = n;
    }
    let rank = null;
    if (event.rank !== undefined && event.rank !== null && event.rank !== '') {
      const n = Number(event.rank);
      if (!Number.isInteger(n) || n < 1 || n > 5000000) common.bad('位次须为 1–5000000 的整数');
      rank = n;
    }
    const award = text(event.award, 40);
    const data = plan.pathwaysCheck({ grade, score, rank, province, award });
    if (rank === null && data.score !== null && data.rank !== null) {
      data.rankEstimated = true;
      data.rankSource = 'model.rankOf';
    }
    return common.ok(data);
  }

  if (action === 'reset') {
    const saved = await writeRecord(row || { key: id.key }, {
      profile: plan.defaultProfile(), exams: []
    });
    return common.ok({ reset: true, profile: profileOf(saved) });
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
