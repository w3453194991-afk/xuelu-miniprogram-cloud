/* 业务视图层：把云函数返回的原始数据转成页面直接渲染的结构。
 * 只做纯函数转换，不碰 wx / 不发请求，自检脚本可以完整覆盖。 */

const fmt = require('./format.js');

const TYPES = [
  { id: 'course', name: '课程' },
  { id: 'tutor', name: '伴学' },
  { id: 'bus', name: '校车' }
];

/* 星级：把 4.8 拆成 5 颗星的亮/灰，模板按顺序渲染即可 */
function starList(score) {
  const value = Number(score) || 0;
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return [1, 2, 3, 4, 5].map(index => ({ key: 'star-' + index, on: index <= filled }));
}

/* 伴学老师的公开资料摘要：首页卡片 / 详情页共用一份口径 */
function tutorBrief(s) {
  const d = (s && s.tutorDetail) || {};
  const rating = d.rating || {};
  const score = Number(rating.score) || 0;
  const count = Number(rating.count) || 0;
  return {
    name: d.name || (s && s.merchant) || '',
    initial: (d.name || (s && s.merchant) || '').slice(0, 1),
    school: d.school || '',
    major: d.major || '',
    education: d.education || '',
    score,
    scoreText: score ? score.toFixed(1) : '',
    count,
    countText: count ? count + ' 条评价' : '暂无评价',
    stars: starList(score),
    schoolText: [d.school, d.major].filter(Boolean).join(' · ')
  };
}

/* 帮忙接：个人顺路代接孩子的公开资料 */
function pickupBrief(s) {
  const d = (s && s.pickupDetail) || {};
  if (!d.person) return null;
  const seat = Number(d.seat) || 0;
  const used = Number(d.used) || 0;
  const free = Math.max(0, seat - used);
  const years = Number(d.years) || 0;
  return {
    person: d.person,
    initial: String(d.person).slice(0, 1),
    kind: d.kind === 'car' ? 'car' : 'pickup',
    isCar: d.kind === 'car',
    gender: d.gender || '',
    childGrade: d.childGrade || '',
    childText: d.childGrade ? '自家孩子 ' + d.childGrade + ' · 同校顺路' : '',
    years: years,
    yearsText: years ? '接送 ' + years + ' 年' : '刚开始接',
    area: d.area || '',
    school: d.school || '',
    schoolGate: d.schoolGate || '',
    timeText: d.timeText || '',
    vehicle: d.vehicle || '',
    seat: seat,
    used: used,
    free: free,
    seatText: seat ? (free > 0 ? '还能接 ' + free + ' 个孩子' : '本期已满') : '',
    idChecked: !!d.idChecked,
    credit: d.credit || '',
    note: d.note || ''
  };
}

/* ---------------- 列表 ---------------- */
function listView(service) {
  const s = service || {};
  const remaining = Number(s.remaining || 0);
  return {
    id: s.id || '',
    type: s.type || 'course',
    typeName: fmt.typeName(s.type),
    title: s.title || '未命名服务',
    tag: s.tag || '',
    icon: s.icon || '📘',
    tone: s.tone || 'peach',
    merchant: s.merchant || '',
    category: s.category || '',
    location: s.location || '',
    city: s.city || '',
    price: Number(s.price) || 0,
    priceText: fmt.money(s.price),
    unit: s.unit || '',
    remaining: remaining,
    remainingText: '余位 ' + remaining,
    lowSeat: remaining <= 3,
    subtitle: s.category || s.location || '',
    learning: s.learning || null,
    /* 伴学老师：学校 / 专业 / 星级，列表卡直接展示 */
    tutor: s.type === 'tutor' ? tutorBrief(s) : null,
    /* 帮忙接：接送人 / 小区 / 学校 / 余位 */
    pickup: s.type === 'bus' ? pickupBrief(s) : null
  };
}

/* ---------------- 首页内容区：四个 Tab 的子分类 ---------------- */
const COURSE_SECTIONS = [
  { id: 'k12', name: 'K12提升', hint: '学科、素养与体能' },
  { id: 'art', name: '艺考课', hint: '美术、音乐、播音' },
  { id: 'gwy', name: '公考课', hint: '考公、考研、考编' },
  { id: 'zk', name: '职业课', hint: '职业资格与技能证书' }
];
const TUTOR_SECTIONS = [
  { id: 'tutor', name: '大学生家教', hint: '在校大学生一对一带' },
  { id: 'read', name: '作业陪读', hint: '陪写作业、检查与答疑' },
  { id: 'home', name: '上门辅导', hint: '老师上门，家里上课' }
];
/* 接送：机构固定线路 + 个人「帮忙接」+ 家长「私家车」顺路 */
const BUS_SECTIONS = [
  { id: 'route', name: '固定线路', hint: '按月订，准点接送' },
  { id: 'pickup', name: '帮忙接', hint: '个人顺路代接，按次或按月' },
  { id: 'car', name: '私家车', hint: '接送自家孩子的家长顺路带一程' }
];
/* 精选里的四条推荐线 */
const FEATURED_GROUPS = [
  { id: 'student', name: '学生课程', desc: 'K12 与艺考', tab: 'course', sub: 'k12' },
  { id: 'adult', name: '成人考证课', desc: '公考、考研、职考', tab: 'course', sub: 'gwy' },
  { id: 'tutor', name: '家教伴学', desc: '大学生家教与陪读', tab: 'tutor', sub: 'tutor' },
  { id: 'bus', name: '接送服务', desc: '固定线路 · 帮忙接 · 私家车', tab: 'bus', sub: 'all' }
];

function has(text, words) {
  const s = String(text || '');
  return words.some(w => s.indexOf(w) >= 0);
}

/* 课程：按类目与考试方向归到四个子分类 */
function courseSection(item) {
  const s = item || {};
  const kind = s.learning && s.learning.kind ? s.learning.kind : '';
  const category = s.category || '';
  const title = s.title || '';
  if (kind === 'zk' || has(category, ['职考', '职业', '技能', '证书'])) return 'zk';
  if (kind === 'gwy' || kind === 'ky' || kind === 'sb') return 'gwy';
  if (has(category, ['考公', '考研', '考编', '公务员', '事业单位', '申论', '行测'])) return 'gwy';
  if (has(category, ['少儿', '启蒙', '素养', '探索', '成长营', '体能', '篮球', '科学', '学科'])) return 'k12';
  if (has(category, ['艺考', '美术', '音乐', '播音', '编导', '舞蹈', '传媒']) || has(title, ['艺考', '集训'])) return 'art';
  return 'k12';
}

/* 伴学：大学生家教 / 作业陪读 / 上门辅导 */
function tutorSection(item) {
  const s = item || {};
  const category = s.category || '';
  const title = s.title || '';
  const detail = s.tutorDetail || {};
  const methods = Array.isArray(detail.methods) ? detail.methods.join(' ') : '';
  if (has(methods, ['上门']) || has(category, ['上门', '学科辅导', '课业辅导'])) return 'home';
  if (has(category, ['阅读', '陪读', '作业', '习惯']) || has(title, ['陪读', '作业'])) return 'read';
  return 'tutor';
}

function busSection(item) {
  const s = item || {};
  if (s.pickupDetail) {
    if (s.pickupDetail.kind === 'car' || has(s.category, ['私家车'])) return 'car';
    return 'pickup';
  }
  if (s.busDetail) return 'route';
  /* 只能靠分类兜底，注意「校车接送」属于固定线路，不能只看「接送」两个字 */
  if (has(s.category, ['私家车'])) return 'car';
  if (has(s.category, ['帮忙接', '代接', '顺路接'])) return 'pickup';
  return 'route';
}

function sectionOf(item) {
  const s = item || {};
  if (s.type === 'bus') return 'bus';
  if (s.type === 'tutor') return tutorSection(s);
  return courseSection(s);
}

function sectionsFor(tab) {
  if (tab === 'course') return COURSE_SECTIONS;
  if (tab === 'tutor') return TUTOR_SECTIONS;
  if (tab === 'bus') return BUS_SECTIONS;
  return [];
}

/* 精选排序：带推荐标签、有余位、套餐多的排前面；同分按 id 稳定排序 */
function scoreOf(item) {
  const s = item || {};
  let score = 0;
  if (has(s.tag, ['推荐', '人气', '热门', '精选'])) score += 3;
  if (Number(s.remaining || 0) > 0) score += 1;
  if (Number(s.remaining || 0) <= 3 && Number(s.remaining || 0) > 0) score += 1;
  if (Array.isArray(s.packages) && s.packages.length >= 2) score += 1;
  return score;
}

function featuredGroups(rows, perGroup) {
  const limit = perGroup || 2;
  const list = Array.isArray(rows) ? rows : [];
  return FEATURED_GROUPS.map(group => {
    const pool = list.filter(item => {
      const sec = sectionOf(item);
      if (group.id === 'student') return item.type === 'course' && (sec === 'k12' || sec === 'art');
      if (group.id === 'adult') return item.type === 'course' && (sec === 'gwy' || sec === 'zk');
      if (group.id === 'tutor') return item.type === 'tutor';
      return item.type === 'bus';
    });
    const ranked = pool
      .map((item, index) => ({ item, score: scoreOf(item), index }))
      .sort((a, b) => (b.score - a.score) || (a.index - b.index))
      .slice(0, limit)
      .map(row => listView(row.item));
    return { id: group.id, name: group.name, desc: group.desc, tab: group.tab, sub: group.sub, total: pool.length, items: ranked };
  });
}

function matchesKeyword(service, keyword) {
  const word = String(keyword == null ? '' : keyword).trim().toLowerCase();
  if (!word) return true;
  const s = service || {};
  const hay = [s.title, s.merchant, s.category, s.location, s.city, s.description]
    .map(v => String(v == null ? '' : v).toLowerCase())
    .join(' ');
  return hay.indexOf(word) >= 0;
}

/* 目录筛选：先按类型，再按关键词；不修改入参
 * type 为 'all' 或空表示不按类型筛选（"精选"标签）
 * audience：家长端默认只展示对家长开放的课程；传 '' 表示不做人群过滤 */
function filterServices(list, options) {
  const opts = options || {};
  const rows = Array.isArray(list) ? list : [];
  const type = opts.type && opts.type !== 'all' ? opts.type : '';
  const audience = opts.audience === undefined ? '家长' : opts.audience;
  return rows.filter(s => {
    if (!s) return false;
    if (type && s.type !== type) return false;
    /* 机构把课程只开放给大学生时，家长端课程页不展示 */
    if (audience && s.type === 'course' && Array.isArray(s.audience) && s.audience.length && !s.audience.includes(audience)) return false;
    return matchesKeyword(s, opts.keyword);
  });
}

/* ---------------- 详情 ---------------- */
function imageView(images) {
  return (Array.isArray(images) ? images : []).map((img, index) => ({
    key: 'img-' + index,
    name: img && img.name ? img.name : '机构图片',
    caption: img && img.caption ? img.caption : '',
    tone: img && img.tone ? img.tone : 'peach',
    kind: img && img.kind ? img.kind : 'photo'
  }));
}

function packageView(packages) {
  return (Array.isArray(packages) ? packages : []).map((item, index) => ({
    key: 'pkg-' + index,
    id: item && item.id ? item.id : '',
    name: item && item.name ? item.name : '套餐',
    price: Number(item && item.price) || 0,
    priceText: fmt.money(item && item.price),
    lessons: Number(item && item.lessons) || 0,
    description: item && item.description ? item.description : '',
    videoUrl: item && typeof item.videoUrl === 'string' ? item.videoUrl : ''
  }));
}

function tutorView(s) {
  const d = (s && s.tutorDetail) || {};
  const list = value => (Array.isArray(value) ? value.filter(Boolean) : []);
  const brief = tutorBrief(s);
  return {
    name: d.name || s.merchant || '',
    initial: brief.initial,
    school: d.school || '',
    major: d.major || '',
    education: d.education || '',
    score: brief.score,
    scoreText: brief.scoreText,
    count: brief.count,
    countText: brief.countText,
    stars: brief.stars,
    subjects: list(d.subjects),
    methods: list(d.methods),
    experience: d.experience || '',
    intro: d.intro || '',
    certificate: d.certificate || '',
    grades: d.grades || ''
  };
}

function busView(s) {
  /* 帮忙接也复用线路结构，上/下车点与时刻表一致 */
  const d = (s && (s.pickupDetail || s.busDetail)) || {};
  const routes = Array.isArray(d.routes) ? d.routes : (Array.isArray(s && s.routes) ? s.routes : []);
  const period = Array.isArray(d.period) && d.period.length ? d.period : ['月付'];
  return {
    driver: d.driver || '',
    phone: d.phone || '',
    plate: d.plate || '',
    vehicle: d.vehicle || '',
    period: period,
    routes: routes.map((row, index) => ({
      key: 'stop-' + index,
      index: index,
      name: row && row.name ? row.name : '站点',
      arrival: row && row.arrival ? row.arrival : '',
      departure: row && row.departure ? row.departure : ''
    })),
    stops: routes.map(row => (row && row.name ? row.name : '')).filter(Boolean),
    pickup: pickupBrief(s)
  };
}

function merchantView(s) {
  const d = (s && s.merchantDetail) || {};
  return {
    name: d.name || (s && s.merchant) || '',
    intro: d.intro || '',
    foundYear: d.foundYear || '',
    verified: !!d.verified,
    address: d.address || (s && s.address) || '',
    contact: d.contact || '',
    phone: d.phone || (s && s.phone) || '',
    licenses: Array.isArray(d.licenses) ? d.licenses.filter(Boolean) : [],
    teachers: Array.isArray(d.teachers) ? d.teachers.filter(Boolean) : []
  };
}

function detailView(service) {
  const s = service || {};
  const slots = Array.isArray(s.calendar && s.calendar.slots) ? s.calendar.slots : [];
  const base = listView(s);
  return {
    ...base,
    description: s.description || '',
    address: s.address || '',
    phone: s.phone || '',
    images: imageView(s.images),
    packages: packageView(s.packages),
    tutor: s.type === 'tutor' ? tutorView(s) : null,
    bus: s.type === 'bus' ? busView(s) : null,
    /* merchant 是结构化对象（供「机构与师资」区块使用），
       标题栏要显示纯文本，另给一个 merchantName */
    merchantName: s.merchant || '',
    merchant: merchantView(s),
    slots: slots.map((slot, index) => ({
      key: 'slot-' + index,
      text: slot,
      weekday: fmt.slotWeekday(slot)
    })),
    slotNote: (s.calendar && s.calendar.note) || '',
    priceSuffix: s.unit ? '/' + s.unit : ''
  };
}

/* ---------------- 下单辅助 ---------------- */
/* 上车站点候选：整条线路 */
function busStartOptions(bus) {
  const rows = (bus && Array.isArray(bus.routes)) ? bus.routes : [];
  return rows.map(row => row.name);
}

/* 下车站点候选：必须严格排在所选上车站点之后（与服务端校验一致） */
function busEndOptions(bus, startName) {
  const rows = (bus && Array.isArray(bus.routes)) ? bus.routes : [];
  const index = rows.findIndex(row => row.name === startName);
  if (index < 0) return [];
  return rows.slice(index + 1).map(row => row.name);
}

/* 可约时段：服务端只回当天星期匹配的时段，附带 available 标记 */
function availabilityView(res) {
  const rows = (res && Array.isArray(res.slots)) ? res.slots : [];
  return rows.map(row => ({
    slot: row && row.slot ? row.slot : '',
    available: !!(row && row.available)
  }));
}

/* 已选课次去重键 */
function sessionKey(date, slot) {
  return String(date || '') + '|' + String(slot || '');
}

function addSession(list, date, slot) {
  const rows = Array.isArray(list) ? list.slice() : [];
  const key = sessionKey(date, slot);
  if (rows.some(row => sessionKey(row.date, row.slot) === key)) return rows;
  rows.push({ date: date, slot: slot });
  return rows;
}

function removeSession(list, date, slot) {
  const key = sessionKey(date, slot);
  return (Array.isArray(list) ? list : []).filter(row => sessionKey(row.date, row.slot) !== key);
}

/* ---------------- 订单 ---------------- */
function sessionText(order) {
  const o = order || {};
  if (Array.isArray(o.sessions) && o.sessions.length) {
    return o.sessions.map(s => fmt.shortDate(s.date) + ' ' + s.slot).join('；') +
      '（共 ' + (o.hours || o.sessions.length) + ' 小时）';
  }
  return o.slot ? o.slot : '—';
}

function orderView(order, services) {
  const o = order || {};
  const svc = (Array.isArray(services) ? services : []).find(s => s && s.id === o.serviceId) || {};
  return {
    id: o.id || '',
    number: o.number || '',
    title: o.title || svc.title || '服务',
    type: o.type || svc.type || '',
    typeName: fmt.typeName(o.type || svc.type),
    status: o.status || 'pending',
    statusText: fmt.statusText(o.status),
    statusTone: fmt.statusTone(o.status),
    amount: Number(o.amount) || 0,
    amountText: fmt.money(o.amount),
    student: o.student || '',
    phone: o.phone || '',
    phoneMasked: fmt.maskPhone(o.phone),
    slot: o.slot || '',
    sessionText: sessionText(o),
    packageName: (o.packageSnapshot && o.packageSnapshot.name) || '',
    code: o.code || '',
    createdAt: fmt.dateTime(o.createdAt),
    guardian: o.guardian || '',
    relation: o.relation || '',
    startPoint: o.startPoint || '',
    endPoint: o.endPoint || '',
    period: o.period || '',
    busInfo: o.type === 'bus' && svc.busDetail
      ? (svc.busDetail.driver || '演示驾驶员') + ' · ' + (svc.busDetail.plate || '演示车牌')
      : ''
  };
}

/* 订单统计 */
function orderStats(orders) {
  const rows = Array.isArray(orders) ? orders : [];
  const paid = rows.filter(o => ['paid', 'completed'].includes(o.status));
  return {
    total: rows.length,
    pending: rows.filter(o => o.status === 'pending').length,
    paid: rows.filter(o => o.status === 'paid').length,
    completed: rows.filter(o => o.status === 'completed').length,
    cancelled: rows.filter(o => o.status === 'cancelled').length,
    amount: paid.reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
    amountText: fmt.money(paid.reduce((sum, o) => sum + (Number(o.amount) || 0), 0))
  };
}

/* ---------------- 学习资源 ---------------- */
function learningItemView(item) {
  const row = item || {};
  return {
    id: row.id || '',
    title: row.title || '',
    merchant: row.merchant || '',
    kind: row.kind || '',
    kindName: row.kindName || '',
    subject: row.subject || '',
    category: row.category || '',
    description: row.description || '',
    price: Number(row.price) || 0,
    priceText: fmt.money(row.price),
    unit: row.unit || '',
    location: row.location || '',
    icon: row.icon || '📚',
    tone: row.tone || 'mint',
    packages: Number(row.packages) || 0,
    institution: row.institution || {}
  };
}

/* ---------------- 高考 ---------------- */
function universityView(row) {
  const u = row || {};
  return {
    id: u.id || '',
    name: u.name || '',
    province: u.province || '',
    city: u.city || '',
    tier: u.tier || '',
    type: u.type || '',
    alliance: Array.isArray(u.alliance) ? u.alliance : [],
    alumniRank: u.alumniRank || '',
    line: u.line == null ? '' : u.line,
    rank: u.rank == null ? '' : u.rank,
    majorsCount: u.majorsCount || 0,
    diff: u.diff == null ? null : u.diff,
    probability: u.probability == null ? null : u.probability
  };
}

/* 志愿表行（本地清单，按账号保存） */
function admissionRowView(row) {
  const r = row || {};
  return {
    key: r.key || (r.id + '|' + (r.major || '')),
    id: r.id || '',
    name: r.name || '',
    major: r.major || '',
    line: r.line == null ? '' : r.line,
    probability: r.probability == null ? null : r.probability,
    note: r.note || ''
  };
}

/* ---------------- 备考 ---------------- */
function examItemView(row) {
  const r = row || {};
  return {
    id: r.id || '',
    kind: r.kind || '',
    org: r.org || '',
    title: r.title || '',
    region: r.region || '',
    city: r.city || '',
    category: r.category || '',
    examType: r.examType || '',
    quota: r.quota || 0,
    applicants: r.applicants || 0,
    ratio: r.ratio == null ? '' : r.ratio,
    heat: r.heat || '',
    line: r.line == null ? '' : r.line,
    requirements: r.requirements || {},
    diff: r.diff == null ? null : r.diff,
    probability: r.probability == null ? null : r.probability
  };
}

module.exports = {
  TYPES,
  listView, matchesKeyword, filterServices,
  imageView, packageView, tutorView, busView, merchantView, detailView,
  busStartOptions, busEndOptions, availabilityView,
  sessionKey, addSession, removeSession,
  sessionText, orderView, orderStats,
  learningItemView, universityView, admissionRowView, examItemView,
  COURSE_SECTIONS, TUTOR_SECTIONS, BUS_SECTIONS, FEATURED_GROUPS,
  sectionOf, sectionsFor, scoreOf, featuredGroups,
  starList, tutorBrief, pickupBrief, busSection
};
