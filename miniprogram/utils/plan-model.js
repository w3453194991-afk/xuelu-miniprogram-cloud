/* 升学规划模型（纯函数，小程序与云函数共用）
 *
 * 在高考院校 / 分数模型之上，聚合「学生档案 → 阶段任务 → 目标差距 → 选科 → 多元升学 → 时间轴」。
 * 所有函数都不读写存储、不依赖进程状态；时间相关的函数显式接收 now，方便自检。
 * 数值仍是演示用模拟数据，不代表真实招生政策。
 *
 * 移植自网页版 gaokao/plan.mjs，只把 ESM 改成 CommonJS。
 */

/* 升学规划模型（纯函数，可单测）
   在高考院校/分数模型之上，聚合「学生档案 → 阶段任务 → 目标差距 → 选科 → 多元升学 → 时间轴」。
   所有函数都不读写数据库、不依赖当前进程状态；时间相关的函数显式接收 now，方便测试。
   数值仍是演示用模拟数据，不代表真实招生政策。 */

const {PROVINCES, UNDERGRAD_MAJORS} = require('./gaokao-data.js');
const {UNIVERSITIES, provinceLine, rankOf, provinceInfo} = require('./gaokao-model.js');

/* 省份查表（数据层没有单独导出，这里补一个） */
function provinceByName(name) {
  const key = typeof name === 'string' ? name.trim() : '';
  return PROVINCES.find(p => p.name === key) || null;
}

const DISCLAIMER = '升学规划中的分数线、覆盖率与节点日期均为模拟数据，仅用于功能演示，不可作为真实升学依据。';

const GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];
const FIRST_SUBJECTS = ['物理', '历史'];
const SECOND_SUBJECTS = ['化学', '生物', '政治', '地理'];
const TARGET_TIERS = ['985', '211', '本科', '专科'];
const INTERESTS = ['工学', '理学', '医学', '经济', '管理', '法学', '文学', '教育', '艺术'];
const INTEREST_CATEGORY = {
  工学: '工学', 理学: '理学', 医学: '医学', 经济: '经济学', 管理: '管理学',
  法学: '法学', 文学: '文学', 教育: '教育学', 艺术: '艺术学'
};

/* 年级推进顺序：升学规划的时间轴会按学年自动推进到下一学段 */
const GRADE_PATH = ['初一', '初二', '初三', '高一', '高二', '高三', '大学'];
const ACADEMIC_START_MONTH = 9;

const round1 = n => Math.round(n * 10) / 10;

function asDate(value) {
  const d = value instanceof Date ? value : new Date(value === undefined || value === null ? Date.now() : value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
function text(v, max = 40) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function listify(v) {
  if (Array.isArray(v)) return v.map(x => text(x, 20)).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,，、/\s]+/).map(s => s.trim()).filter(Boolean);
  return [];
}
function uniq(list) { return [...new Set(list)]; }
function pad2(n) { return String(n).padStart(2, '0'); }
function formatDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function academicYear(d) { return d.getMonth() + 1 >= ACADEMIC_START_MONTH ? d.getFullYear() : d.getFullYear() - 1; }
function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); }

function isGrade(grade) { return GRADES.includes(grade); }
function isProvinceName(name) { return PROVINCES.some(p => p.name === name); }

/* ---------------- 学生档案 ---------------- */
function defaultProfile() {
  return {
    grade: '高一',
    province: '浙江',
    first: '物理',
    second: ['化学', '生物'],
    targetTier: '本科',
    interest: ['工学'],
    updatedAt: null
  };
}

/* 校验并归一化档案。返回 {ok, errors, profile}，不抛异常，路由层负责 fail。 */
function normalizeProfile(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = [];
  const d = defaultProfile();

  let grade = text(raw.grade, 8) || d.grade;
  if (!GRADES.includes(grade)) {
    errors.push('年级只能是：' + GRADES.join('、'));
    grade = d.grade;
  }

  let province = text(raw.province, 20) || d.province;
  if (!isProvinceName(province)) {
    errors.push('省份不存在：' + province);
    province = d.province;
  }

  let first = text(raw.first, 8) || d.first;
  if (!FIRST_SUBJECTS.includes(first)) {
    errors.push('首选科目只能是：' + FIRST_SUBJECTS.join('、'));
    first = d.first;
  }

  const secondGiven = raw.second !== undefined && raw.second !== null && raw.second !== '';
  let second = secondGiven ? uniq(listify(raw.second)) : [...d.second];
  if (second.length !== 2) {
    errors.push('再选科目必须正好 2 门（' + SECOND_SUBJECTS.join('、') + ' 中选 2 门）');
  }
  const badSecond = second.filter(s => !SECOND_SUBJECTS.includes(s));
  if (badSecond.length) errors.push('再选科目不在可选范围内：' + badSecond.join('、'));
  if (second.length !== 2 || badSecond.length) second = [...d.second];

  let targetTier = text(raw.targetTier, 8) || d.targetTier;
  if (!TARGET_TIERS.includes(targetTier)) {
    errors.push('目标层次只能是：' + TARGET_TIERS.join('、'));
    targetTier = d.targetTier;
  }

  let interest = uniq(listify(raw.interest));
  const badInterest = interest.filter(x => !INTERESTS.includes(x));
  if (badInterest.length) errors.push('兴趣方向不在可选范围内：' + badInterest.join('、'));
  interest = interest.filter(x => INTERESTS.includes(x)).slice(0, 3);

  return {
    ok: errors.length === 0,
    errors,
    profile: {grade, province, first, second, targetTier, interest}
  };
}

/* ---------------- 考试记录 ---------------- */
function normalizeExam(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = [];
  const name = text(raw.name, 40);
  if (!name) errors.push('请填写考试名称（1–40 字）');

  let date = text(raw.date, 10);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!dateOk) {
    errors.push('考试日期格式应为 YYYY-MM-DD');
  } else {
    const [y, m, d] = date.split('-').map(Number);
    const probe = new Date(y, m - 1, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d || y < 2015 || y > 2100) {
      errors.push('考试日期不是有效日期');
      date = '';
    }
  }

  const totalRaw = raw.total;
  const total = totalRaw === '' || totalRaw === null || totalRaw === undefined ? NaN : Number(totalRaw);
  if (!Number.isFinite(total) || total <= 0 || total > 900) {
    errors.push('总分须为 0–900 之间的数字（按考试满分填写）');
  }

  return {
    ok: errors.length === 0,
    errors,
    exam: {name, date, total: Number.isFinite(total) ? round1(total) : 0}
  };
}

function sortExams(exams) {
  return (Array.isArray(exams) ? exams : [])
    .filter(e => e && typeof e === 'object' && Number.isFinite(Number(e.total)) && e.date)
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) ||
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

/* 当前均分取最近 6 次，避免早期低分长期拉低目标差距 */
function examList(exams) {
  return sortExams(exams).map(e => ({
    id: e.id || '',
    name: e.name || '',
    date: e.date || '',
    total: round1(Number(e.total)),
    createdAt: e.createdAt || ''
  }));
}

function examStats(exams) {
  const all = sortExams(exams);
  if (!all.length) {
    return {count: 0, average: null, latest: null, highest: null, lowest: null, trend: null, recent: [], label: '最近 6 次均分'};
  }
  const recent = all.slice(-6);
  const nums = recent.map(e => Number(e.total));
  const latest = recent[recent.length - 1];
  const first = recent[0];
  return {
    count: all.length,
    average: round1(nums.reduce((s, n) => s + n, 0) / nums.length),
    latest: round1(Number(latest.total)),
    latestName: latest.name || '',
    latestDate: latest.date || '',
    highest: round1(Math.max(...nums)),
    lowest: round1(Math.min(...nums)),
    trend: round1(Number(latest.total) - Number(first.total)),
    recent: recent.map(e => ({
      name: e.name || '', date: e.date || '', total: round1(Number(e.total))
    })),
    label: '最近 ' + recent.length + ' 次均分'
  };
}

/* ---------------- 路径规划：五段阶段任务 ---------------- */
const STAGES = [
  {
    key: 'primary', name: '小学', range: '1–6 年级', goal: '把学习习惯和好奇心养起来',
    tasks: [
      {title: '每天固定阅读 20 分钟', detail: '从亲子共读到独立阅读，优先保护兴趣，不追求书单数量。'},
      {title: '计算与书写基本功', detail: '口算、竖式、字迹工整，每天 10 分钟短时高频练习。'},
      {title: '找到一项能坚持的兴趣', detail: '体育、艺术或科学实验任选其一，连续学习 1 年以上再评估。'},
      {title: '学会整理书包与时间', detail: '用可视化的清单管理作业和物品，家长逐步退出代劳。'},
      {title: '建立成长档案', detail: '保存作品、奖状与阅读记录，为后面的综评材料打底。'}
    ]
  },
  {
    key: 'junior', name: '初中', range: '初一–初三', goal: '稳住语数英，读懂本地中考规则',
    tasks: [
      {title: '初一：适应节奏，稳住语数英', detail: '三门主科每天有固定复习时间，避免靠考前突击。'},
      {title: '初二：盯住两极分化', detail: '物理、几何、英语是常见分水岭，出现掉队当月就补。'},
      {title: '体育与实验操作别丢分', detail: '中考体育、理化生实验通常可提前一年开始规律训练。'},
      {title: '研究本地中考政策', detail: '指标到校、名额分配、自主招生等规则每年会微调，以教育局文件为准。'},
      {title: '初三：一轮复习 + 模考复盘', detail: '每次模考后整理失分类型，比单纯刷题更重要。'},
      {title: '中考志愿梯度设计', detail: '按冲、稳、保排列，至少留 1 所明显低于平时水平的保底校。'}
    ]
  },
  {
    key: 'senior', name: '高中', range: '高一–高二', goal: '选对科目，把位次稳定在目标区间',
    tasks: [
      {title: '高一：定首选科目', detail: '物理 / 历史的选择优先看长期兴趣与专业方向，其次才是眼前分数。'},
      {title: '高一：再选科目试读', detail: '化学、生物、政治、地理各学一学期，用真实成绩和感受做判断。'},
      {title: '高二：通过学业水平合格考', detail: '合格考不过会影响毕业与部分高校报名，按学校节奏准备即可。'},
      {title: '高二：接触强基 / 综评 / 专项', detail: '了解报名条件与材料清单，有竞赛特长的尽早进入训练体系。'},
      {title: '高二下：进入一轮复习', detail: '把高一高二的错题按知识点归档，一轮复习以补漏洞为主。'},
      {title: '每学期校准一次目标线', detail: '用校内排名换算全省位次，比只看分数更能反映真实水平。'}
    ]
  },
  {
    key: 'gaokao', name: '高考', range: '高三–录取', goal: '报名、体检、考试、出分、填报，一环都不能漏',
    tasks: [
      {title: '高三上：高考报名与资格审查', detail: '关注本省教育考试院通知，户籍、学籍材料提前准备。'},
      {title: '高三下：体检与外语考试', detail: '体检结论会影响部分专业报考，外语听力 / 口语按本省安排参加。'},
      {title: '一模二模三模：按位次校准', detail: '把每次模考换算成省位次，动态调整目标院校清单。'},
      {title: '强基 / 综评 / 专项材料准备', detail: '报名集中在 3–5 月，个人陈述、获奖证明、推荐材料提前扫描归档。'},
      {title: '出分后 3 天内完成志愿初稿', detail: '先按位次筛出 30 所候选，再用冲稳保比例压缩到本省志愿数量。'},
      {title: '填满志愿并逐条核对', detail: '核对院校代码、专业组、选科要求、体检限制与是否服从调剂。'}
    ]
  },
  {
    key: 'college', name: '大学', range: '大一–毕业', goal: '把专业读深，把出路想清楚',
    tasks: [
      {title: '入学：适应与专业确认', detail: '了解转专业、辅修与实验班选拔的时间窗口，通常在大一。'},
      {title: '大一：绩点与英语四六级', detail: '绩点决定保研、交流与部分奖学金，越早稳定越省力。'},
      {title: '参与社团、科研或实习', detail: '至少有一段能讲清楚的经历，而不是只 collect 头衔。'},
      {title: '大二大三：分流选择', detail: '保研、考研、留学、就业四条路的时间线不同，提前一年准备。'},
      {title: '大四：把选择落地', detail: '秋招、考研初试、申请截止时间都在上学期，倒排时间表。'}
    ]
  }
];

function stageOfGrade(grade) {
  if (grade === '小学') return 'primary';
  if (['初一', '初二', '初三'].includes(grade)) return 'junior';
  if (['高一', '高二'].includes(grade)) return 'senior';
  if (grade === '高三') return 'gaokao';
  if (grade === '大学') return 'college';
  return null;
}

function stagesFor(grade = '高一') {
  const current = stageOfGrade(grade);
  const index = STAGES.findIndex(s => s.key === current);
  return {
    grade,
    current,
    stages: STAGES.map((stage, i) => ({
      key: stage.key,
      name: stage.name,
      range: stage.range,
      goal: stage.goal,
      tasks: stage.tasks.map(t => ({...t})),
      status: i < index ? 'done' : i === index ? 'current' : 'todo'
    })),
    note: '阶段任务按当前年级高亮；高三归入「高考」阶段，因为报名、体检、考试与填报都发生在高三。'
  };
}

/* ---------------- 关键节点：未来 24 个月 ---------------- */
/* month 从 1 开始；grades 为「该月就读年级」，时间轴会按学年自动推进年级 */
const TIMELINE_RULES = [
  {grades: ['初一', '初二'], month: 1, day: 10, type: 'mock', name: '上学期期末质量检测',
    detail: '期末成绩是判断是否需要调整学习方法的第一个信号，重点看排名变化。'},
  {grades: ['初一', '初二'], month: 6, day: 20, type: 'exam', name: '学业水平考试（学考）',
    detail: '按学校通知参加，合格即可；部分地区初二会安排地理、生物考试。'},

  {grades: ['初三'], month: 4, day: 20, type: 'mock', name: '中考一模',
    detail: '第一次全市 / 全区统考，用排名而不是分数定位目标高中。'},
  {grades: ['初三'], month: 5, day: 20, type: 'mock', name: '中考二模',
    detail: '查漏补缺的最后窗口，重点复盘重复失分的题型。'},
  {grades: ['初三'], month: 6, day: 17, type: 'exam', name: '中考',
    detail: '带齐准考证与文具，提前踩点考场，按平时节奏作答。'},
  {grades: ['初三'], month: 7, day: 5, type: 'score', name: '中考出分',
    detail: '出分后先看位次，再对照目标高中近三年录取线。'},
  {grades: ['初三'], month: 7, day: 10, type: 'apply', name: '中考志愿填报',
    detail: '按冲稳保梯度填报，确认是否服从调剂与名额分配规则。'},

  {grades: ['高一'], month: 11, day: 20, type: 'subject', name: '选科确认（预选）',
    detail: '多数学校在高一上学期末收集选科意向，先按兴趣与专业方向预选。'},
  {grades: ['高一'], month: 1, day: 10, type: 'mock', name: '高一上期末统考',
    detail: '用九科总分与单科排名判断首选物理还是历史。'},
  {grades: ['高一'], month: 6, day: 20, type: 'exam', name: '学业水平合格考',
    detail: '合格考成绩影响毕业与部分高校报名，按学校节奏准备。'},
  {grades: ['高一'], month: 6, day: 30, type: 'subject', name: '选科确认（最终）',
    detail: '再选科目一旦确定，高二分班与后续复习都会围绕它展开。'},

  {grades: ['高二'], month: 1, day: 10, type: 'exam', name: '学业水平合格考',
    detail: '未合格的科目还有补考机会，尽早清掉。'},
  {grades: ['高二'], month: 4, day: 15, type: 'subject', name: '选科调整窗口',
    detail: '部分学校允许高二上学期前调整选科，需同时评估专业覆盖率与当前成绩。'},
  {grades: ['高二'], month: 6, day: 20, type: 'mock', name: '高二下期末统考',
    detail: '这次排名是进入高三一轮复习前的基线，建议记录并保存。'},
  {grades: ['高二'], month: 11, day: 10, type: 'exam', name: '学业水平合格考（补考）',
    detail: '仍有不合格科目的同学务必参加，避免影响毕业。'},

  {grades: ['高三'], month: 11, day: 5, type: 'signup', name: '高考报名',
    detail: '网上报名 + 现场确认，户籍、学籍、身份证信息要逐字核对。'},
  {grades: ['高三'], month: 1, day: 10, type: 'exam', name: '学业水平合格考（补考）',
    detail: '高三仍有补考机会，报名前确认自己是否已经全部合格。'},
  {grades: ['高三'], month: 3, day: 15, type: 'health', name: '高考体检',
    detail: '体检结论会限制部分专业报考（如色盲、色弱），填报前务必核对。'},
  {grades: ['高三'], month: 3, day: 25, type: 'mock', name: '高三一模',
    detail: '按高考时间与流程模拟，考后把分数换算成省位次。'},
  {grades: ['高三'], month: 4, day: 25, type: 'mock', name: '高三二模',
    detail: '二模后确定冲稳保院校清单，开始准备强基 / 综评材料。'},
  {grades: ['高三'], month: 5, day: 20, type: 'mock', name: '高三三模',
    detail: '最后一次大考，重点调整作息与答题节奏，不再大幅改动方法。'},
  {grades: ['高三'], month: 6, day: 7, type: 'exam', name: '高考',
    detail: '按准考证安排参加考试，考完一科不对答案，保持节奏。'},
  {grades: ['高三'], month: 6, day: 25, type: 'score', name: '高考出分',
    detail: '同时公布分数线与一分一段表，用位次而不是分数定位院校。'},
  {grades: ['高三'], month: 6, day: 29, type: 'apply', name: '志愿填报',
    detail: '按冲稳保比例填满志愿，逐条核对院校代码、专业组与选科要求。'},
  {grades: ['高三'], month: 7, day: 15, type: 'apply', name: '征集志愿',
    detail: '未被录取的同学关注本省征集志愿公告，部分批次还有补录机会。'},

  {grades: ['大学'], month: 9, day: 1, type: 'college', name: '大学入学',
    detail: '报到后尽快了解转专业、辅修、实验班选拔与奖学金规则。'}
];

function gradeAt(baseGrade, baseDate, date) {
  const base = GRADE_PATH.indexOf(baseGrade);
  if (base < 0) return null;
  const index = base + (academicYear(date) - academicYear(baseDate));
  if (index < 0 || index >= GRADE_PATH.length) return null;
  return GRADE_PATH[index];
}

function timeline({grade = '高一', now = new Date(), months = 24} = {}) {
  const base = asDate(now);
  const from = new Date(base.getFullYear(), base.getMonth(), 1);
  const nodes = [];
  for (let i = 0; i < months; i++) {
    const cursor = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const projected = gradeAt(grade, base, cursor);
    if (!projected) continue;
    for (const rule of TIMELINE_RULES) {
      if (rule.month !== cursor.getMonth() + 1 || !rule.grades.includes(projected)) continue;
      const date = new Date(cursor.getFullYear(), rule.month - 1, rule.day);
      nodes.push({
        date: formatDate(date),
        name: rule.name,
        detail: rule.detail,
        type: rule.type,
        grade: projected,
        passed: date < startOfDay(base),
        daysUntil: Math.round((date - startOfDay(base)) / 86400000)
      });
    }
  }
  nodes.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  const to = new Date(from.getFullYear(), from.getMonth() + months, 0);
  const today = startOfDay(base);
  const passed = nodes.filter(n => n.passed).length;
  return {
    grade,
    months,
    from: formatDate(from),
    to: formatDate(to),
    count: nodes.length,
    passed,
    upcoming: nodes.length - passed,
    next: nodes.find(n => !n.passed) || null,
    nodes,
    note: '日期按学年与常规招生节奏推算，仅作规划提醒，具体以当地教育考试院公告为准。'
  };
}

/* ---------------- 目标拆解 ---------------- */
function tierLine(province = '浙江', tier = '本科', year = 2025) {
  const peers = UNIVERSITIES.filter(u => u.tier === tier);
  if (!peers.length) return null;
  const lines = peers.map(u => provinceLine(u, province, year));
  return round1(lines.reduce((s, n) => s + n, 0) / lines.length);
}

function milestoneDate(grade, now) {
  const ay = academicYear(now);
  if (grade === '高三') return {date: new Date(ay + 1, 5, 7), name: '高考'};
  if (grade === '高二') return {date: new Date(ay + 2, 5, 7), name: '高考'};
  if (grade === '高一') return {date: new Date(ay + 3, 5, 7), name: '高考'};
  if (grade === '初三') return {date: new Date(ay + 1, 5, 17), name: '中考'};
  if (grade === '初二') return {date: new Date(ay + 2, 5, 17), name: '中考'};
  if (grade === '初一') return {date: new Date(ay + 3, 5, 17), name: '中考'};
  return null;
}

function gapAnalysis({province = '浙江', grade = '高一', targetTier = '本科', avgScore = null, now = new Date(), year = 2025} = {}) {
  const p = provinceInfo(province);
  const tier = TARGET_TIERS.includes(targetTier) ? targetTier : '本科';
  const targetLine = tierLine(p.name, tier, year);
  const avg = avgScore === null || avgScore === undefined || avgScore === ''
    ? null
    : (Number.isFinite(Number(avgScore)) ? round1(Number(avgScore)) : null);

  const milestone = milestoneDate(grade, asDate(now));
  const months = milestone ? Math.max(1, monthsBetween(asDate(now), milestone.date)) : null;
  const semesters = months ? Math.max(1, Math.ceil(months / 6)) : null;
  const gap = avg === null || targetLine === null ? null : round1(targetLine - avg);
  const perSemester = gap === null || !semesters ? null : round1(gap / semesters);

  let advice;
  if (avg === null) {
    advice = '先在「学业曲线」录入至少一次考试总分，系统才能算出与目标线的差距。';
  } else if (gap !== null && gap <= 0) {
    advice = `当前均分 ${avg} 已高出${tier}层次模拟线 ${Math.abs(gap)} 分，保持节奏：把重心放在稳定发挥与短板学科上，同时关注位次而不只是分数。`;
  } else if (gap !== null) {
    advice = `还差 ${gap} 分。按剩余约 ${months} 个月（${semesters} 个学期）折算，每学期需要提升约 ${perSemester} 分；建议每月对照一次目标线，优先补提分空间最大的 1–2 门学科。`;
  } else {
    advice = '目标线暂不可用，请稍后重试。';
  }

  return {
    province: p.name,
    total: p.total,
    grade,
    targetTier: tier,
    targetLine,
    targetYear: year,
    targetBasis: `按${p.name}${tier}层次院校 ${year} 年模拟投档线均值估算`,
    avgScore: avg,
    gap,
    onTrack: gap !== null && gap <= 0,
    milestone: milestone ? milestone.name : null,
    monthsToMilestone: months,
    semesters,
    perSemester,
    advice,
    disclaimer: DISCLAIMER
  };
}

/* ---------------- 选科建议 ---------------- */
/* data.mjs 没有逐专业的选科要求字段，这里按学科门类给出 3+1+2 口径的模拟规则，
   因此所有覆盖率结果都标注 simulated。规则本身是确定性的，可单测。 */
const CATEGORY_FIRST = {
  工学: '物理', 理学: '物理', 医学: '物理', 农学: '物理',
  历史学: '历史', 哲学: '历史',
  经济学: '不限', 管理学: '不限', 法学: '不限', 文学: '不限',
  教育学: '不限', 艺术学: '不限'
};
const MAJOR_SECOND = {
  化学: '化学', 材料科学与工程: '化学', 化学工程与工艺: '化学', 环境工程: '化学',
  临床医学: '化学', 口腔医学: '化学', 药学: '化学', '药学（中药方向）': '化学',
  预防医学: '化学', 护理学: '化学', 食品科学与工程: '化学',
  生物科学: '生物', 生物医学工程: '生物', 海洋科学: '生物'
};

function majorRequirement(major) {
  const category = major && major.category ? major.category : '';
  const name = major && major.name ? major.name : '';
  return {
    first: CATEGORY_FIRST[category] || '不限',
    second: MAJOR_SECOND[name] || null
  };
}

function comboAllows(major, first, second) {
  const req = majorRequirement(major);
  if (req.first !== '不限' && req.first !== first) return false;
  if (req.second && !second.includes(req.second)) return false;
  return true;
}

function comboName(first, second) {
  return [first, ...second].join('+');
}

function coverageOf(first, second) {
  const allowed = UNDERGRAD_MAJORS.filter(m => comboAllows(m, first, second));
  return {
    allowed: allowed.length,
    total: UNDERGRAD_MAJORS.length,
    coverage: round1(allowed.length / UNDERGRAD_MAJORS.length * 100),
    majors: allowed.map(m => m.name)
  };
}

function allCombos() {
  const combos = [];
  for (const first of FIRST_SUBJECTS) {
    for (let i = 0; i < SECOND_SUBJECTS.length; i++) {
      for (let j = i + 1; j < SECOND_SUBJECTS.length; j++) {
        const second = [SECOND_SUBJECTS[i], SECOND_SUBJECTS[j]];
        const info = coverageOf(first, second);
        combos.push({
          combination: comboName(first, second),
          first,
          second,
          coverage: info.coverage,
          allowed: info.allowed,
          total: info.total,
          simulated: true
        });
      }
    }
  }
  combos.sort((a, b) => b.coverage - a.coverage ||
    (a.first === b.first ? 0 : a.first === '物理' ? -1 : 1) ||
    a.combination.localeCompare(b.combination, 'zh-Hans-CN'));
  combos.forEach((c, i) => { c.rank = i + 1; });
  return combos;
}

function subjectAnalysis({first = '物理', second = ['化学', '生物'], province = '浙江'} = {}) {
  const errors = [];
  if (!FIRST_SUBJECTS.includes(first)) errors.push('首选科目只能是：' + FIRST_SUBJECTS.join('、'));
  const secondList = uniq(listify(second));
  if (secondList.length !== 2) errors.push('再选科目必须正好 2 门');
  const bad = secondList.filter(s => !SECOND_SUBJECTS.includes(s));
  if (bad.length) errors.push('再选科目不在可选范围内：' + bad.join('、'));
  if (!isProvinceName(province)) errors.push('省份不存在：' + province);
  if (errors.length) return {ok: false, errors};

  const current = coverageOf(first, secondList);
  const combos = allCombos();
  const combination = comboName(first, secondList);
  const me = combos.find(c => c.combination === combination);
  const best = combos[0];

  const categories = [...new Set(UNDERGRAD_MAJORS.map(m => m.category))]
    .map(category => {
      const majors = UNDERGRAD_MAJORS.filter(m => m.category === category);
      const allowed = majors.filter(m => comboAllows(m, first, secondList)).length;
      return {
        category,
        total: majors.length,
        allowed,
        coverage: round1(allowed / majors.length * 100)
      };
    })
    .sort((a, b) => b.allowed - a.allowed || a.category.localeCompare(b.category, 'zh-Hans-CN'));

  return {
    ok: true,
    province,
    first,
    second: secondList,
    combination,
    coverage: current.coverage,
    allowedMajors: current.allowed,
    totalMajors: current.total,
    rank: me ? me.rank : null,
    totalCombos: combos.length,
    best: {combination: best.combination, first: best.first, second: best.second, coverage: best.coverage, allowed: best.allowed},
    gapToBest: me ? round1(best.coverage - me.coverage) : null,
    combos,
    categories,
    allowedMajorNames: current.majors,
    simulated: true,
    coverageBasis: '按学科门类归并的模拟选科要求（3+1+2 口径）',
    note: 'data.mjs 未提供逐专业选科要求，覆盖率按门类规则模拟，仅用于比较组合之间的相对高低。',
    disclaimer: DISCLAIMER
  };
}

/* ---------------- 多元升学 ---------------- */
function pathwayChecks(list) {
  // optional 的检查项只展示，不参与「是否符合」的判断
  const auto = list.filter(c => !c.manual && !c.optional);
  const manual = list.filter(c => c.manual);
  const autoPass = auto.length > 0 && auto.every(c => c.pass);
  let status = 'ineligible';
  if (autoPass) status = manual.length ? 'manual' : 'eligible';
  return {
    checks: list,
    autoPass,
    manualPass: null,
    manualCount: manual.length,
    status
  };
}

function fitPathway(base, checks, extra = {}) {
  const summary = pathwayChecks(checks);
  return {
    key: base.key,
    name: base.name,
    tag: base.tag,
    summary: base.summary,
    requirements: base.requirements,
    checks: summary.checks,
    autoPass: summary.autoPass,
    manualCount: summary.manualCount,
    status: summary.status,
    eligible: summary.status === 'eligible',
    needsManual: summary.status === 'manual',
    ...extra
  };
}

function pathwaysCheck({grade = '高三', score = null, rank = null, province = '浙江', award = ''} = {}) {
  const p = provinceInfo(province);
  const scoreNum = score === null || score === undefined || score === ''
    ? null
    : (Number.isFinite(Number(score)) ? round1(Number(score)) : null);
  const rankNum = rank === null || rank === undefined || rank === ''
    ? (scoreNum === null ? null : rankOf(p.name, scoreNum))
    : Math.max(1, Math.round(Number(rank)) || 1);

  const ratio = p.total / 750;
  const controlLine = round1(600 * ratio);
  const batchLine = round1(480 * ratio);
  const hasScore = scoreNum !== null;
  const awardText = text(award, 40) || '未登记';
  const nationalAward = /国家集训队|金牌|全国决赛|国一|国二/.test(awardText);

  const scoreCheck = (line, label) => ({
    item: '高考成绩', required: `≥ ${line} 分（${label}）`,
    actual: hasScore ? `${scoreNum} 分` : '未提供成绩', pass: hasScore && scoreNum >= line
  });
  const gradeCheck = {
    item: '年级要求', required: '高三应届', actual: grade,
    pass: grade === '高三'
  };
  const rankCheck = (limit) => ({
    item: '全省位次', required: `≤ ${limit}`,
    actual: rankNum === null ? '未提供' : String(rankNum),
    pass: rankNum !== null && rankNum <= limit
  });

  const strongBase = {
    key: 'qiangji', name: '强基计划', tag: '基础学科 · 本硕博衔接',
    summary: '36 所「双一流」A 类高校招收数学、物理、化学、生物、历史、哲学、古文字等基础学科，高考成绩占综合分 85% 左右。',
    requirements: [
      {label: '年级', value: '高三应届毕业生'},
      {label: '成绩', value: `达到特殊类型招生控制线（模拟 ${controlLine} 分）`},
      {label: '位次', value: '全省前列（模拟参考 ≤ 40000 名）'},
      {label: '奖项', value: '五大学科竞赛银牌及以上可破格入围'}
    ]
  };
  const strongChecks = [
    gradeCheck,
    scoreCheck(controlLine, '模拟特殊类型线'),
    rankCheck(40000),
    {item: '竞赛破格（可选）', required: '银牌及以上', actual: awardText, pass: nationalAward, manual: false, optional: true}
  ];

  const comprehensiveBase = {
    key: 'zonghe', name: '综合评价', tag: '高考 + 校测 + 学考',
    summary: '部分高校按「高考成绩 60% + 校测 30% + 学考 10%」折算录取，适合综合素质档案完整、面试表达稳定的学生。',
    requirements: [
      {label: '年级', value: '高三应届毕业生'},
      {label: '成绩', value: `达到本科批次线（模拟 ${batchLine} 分）`},
      {label: '学考', value: '学业水平考试全 A 或少量 B'},
      {label: '材料', value: '综合素质档案、个人陈述、校测'}
    ]
  };
  const comprehensiveChecks = [
    gradeCheck,
    scoreCheck(batchLine, '模拟本科线'),
    {item: '学业水平考试', required: '全 A 或少量 B', actual: '需按本校成绩单核验', pass: false, manual: true},
    {item: '综合素质档案 / 校测', required: '档案完整并参加校测', actual: '需人工确认', pass: false, manual: true}
  ];

  const specialBase = {
    key: 'zhuanxiang', name: '专项计划', tag: '面向农村和脱贫地区',
    summary: '国家专项、地方专项、高校专项面向实施区域的农村学生，通常可降分录取，报名集中在高三下学期。',
    requirements: [
      {label: '年级', value: '高三应届毕业生'},
      {label: '户籍学籍', value: '本人及父母（或法定监护人）户籍在实施区域连续满 3 年'},
      {label: '成绩', value: `达到相应批次线（模拟 ${batchLine} 分）`},
      {label: '材料', value: '户籍证明、学籍证明、资格审核表'}
    ]
  };
  const specialChecks = [
    gradeCheck,
    scoreCheck(batchLine, '模拟本科线'),
    {item: '户籍在实施区域', required: '连续满 3 年', actual: '需人工核验', pass: false, manual: true},
    {item: '学籍与就读', required: '户籍所在县高中连续 3 年学籍', actual: '需人工核验', pass: false, manual: true}
  ];

  const baosongBase = {
    key: 'baosong', name: '竞赛保送', tag: '国家集训队 / 外语类保送',
    summary: '进入五大学科竞赛国家集训队，或具有外语类保送资格的外国语中学推荐生，可免高考直接录取。',
    requirements: [
      {label: '年级', value: '高三应届毕业生'},
      {label: '奖项', value: '五大学科竞赛国家集训队（数学、物理、化学、生物、信息学）'},
      {label: '资格', value: '外语类保送生需就读具有推荐资格的外国语中学'},
      {label: '成绩', value: `建议不低于本科线（模拟 ${batchLine} 分）`}
    ]
  };
  const baosongChecks = [
    gradeCheck,
    {item: '竞赛奖项', required: '国家集训队 / 全国决赛金牌', actual: awardText, pass: nationalAward}
  ];

  const pathways = [
    fitPathway(strongBase, strongChecks),
    fitPathway(comprehensiveBase, comprehensiveChecks),
    fitPathway(specialBase, specialChecks),
    fitPathway(baosongBase, baosongChecks)
  ];

  return {
    grade,
    province: p.name,
    score: scoreNum,
    rank: rankNum,
    rankEstimated: rank === null || rank === undefined || rank === '',
    award: awardText,
    controlLine,
    batchLine,
    eligibleCount: pathways.filter(x => x.eligible).length,
    manualCount: pathways.filter(x => x.needsManual).length,
    pathways,
    source: hasScore ? 'input' : 'none',
    simulated: true,
    note: hasScore
      ? '自查结果按模拟控制线判断；标注「需人工核验」的条件无法从成绩推导，请以当年招生简章为准。'
      : '还没有成绩数据：请先在「学业曲线」录入考试，或带上 score 参数再自查。',
    disclaimer: DISCLAIMER
  };
}

module.exports = {
  PROVINCES,
  UNDERGRAD_MAJORS,
  DISCLAIMER,
  GRADES,
  FIRST_SUBJECTS,
  SECOND_SUBJECTS,
  TARGET_TIERS,
  INTERESTS,
  INTEREST_CATEGORY,
  GRADE_PATH,
  ACADEMIC_START_MONTH,
  STAGES,
  TIMELINE_RULES,
  CATEGORY_FIRST,
  MAJOR_SECOND,
  isGrade,
  isProvinceName,
  defaultProfile,
  normalizeProfile,
  normalizeExam,
  examList,
  examStats,
  stageOfGrade,
  stagesFor,
  timeline,
  tierLine,
  gapAnalysis,
  majorRequirement,
  subjectAnalysis,
  pathwaysCheck
};
