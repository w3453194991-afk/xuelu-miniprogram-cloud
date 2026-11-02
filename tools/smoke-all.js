/* 全链路接口冒烟：按页面真实调用顺序跑一遍本地模拟后端，校验返回结构与关键状态流转 */
const store = {};
global.wx = {
  getStorageSync: k => (k in store ? store[k] : ''),
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: k => { delete store[k]; }
};

const api = require('../miniprogram/utils/api.js');
const logic = require('../miniprogram/utils/logic.js');
const config = require('../miniprogram/utils/config.js');

let pass = 0;
const fails = [];
function check(label, condition, extra) {
  if (condition) { pass++; return true; }
  fails.push(label + (extra ? ' → ' + JSON.stringify(extra) : ''));
  return false;
}

(async () => {
  /* ---------- 游客可访问 ---------- */
  let r = await api.services.list();
  check('服务目录', r.ok && r.data.length >= 10, r.error);
  const learningSvc = r.data.find(s => s.id === 'l1');
  check('学习方向课程存在', !!learningSvc && !!learningSvc.learning);
  getAppCache(r.data);

  r = await api.content.all();
  check('静态内容', r.ok && r.data.about && r.data.faq.length > 0, r.error);

  r = await api.institutions.list();
  check('机构目录', r.ok && r.data.length >= 3, r.error);
  const org = r.data[0];
  check('机构视图完整', !!org.name && typeof org.courseCount === 'number');

  /* 机构主页：环境图 / 课程 / 教师介绍 / 价格区间 */
  r = await api.institutions.detail({ id: org.id });
  const orgDetail = r.ok ? r.data : {};
  check('机构主页可打开', r.ok && !!orgDetail.name, r.error);
  check('机构主页有环境图', (orgDetail.images || []).length > 0, (orgDetail.images || []).length);
  check('机构主页有课程', (orgDetail.courses || []).length > 0 && !!orgDetail.courses[0].title);
  check('机构主页有教师介绍', (orgDetail.teachers || []).length > 0 && !!orgDetail.teachers[0].name, JSON.stringify(orgDetail.teachers));
  check('机构主页有价格区间', !!orgDetail.priceRangeText && !!orgDetail.priceRange, orgDetail.priceRangeText);
  check('机构主页有成立年份与资质', !!orgDetail.foundText && (orgDetail.licenses || []).length > 0, orgDetail.foundText);
  r = await api.institutions.detail({ name: '不存在的机构' });
  check('机构主页名称兜底 404', !r.ok && r.status === 404, r.status);
  /* 上面把 r 换成了详情/404 结果，后面的人群分区要从目录重新取 */
  r = await api.institutions.list();
  check('机构目录可复取', r.ok && r.data.length >= 3, r.error);
  /* ---------- 首页四个 Tab 的子分类 ---------- */
  const svcRes = await api.services.list();
  const allSvc = svcRes.ok ? svcRes.data : [];
  const bySection = {};
  allSvc.forEach(item => {
    const key = logic.sectionOf(item);
    bySection[key] = (bySection[key] || 0) + 1;
  });
  check('课程四个子分类都有课', ['k12', 'art', 'gwy', 'zk'].every(k => bySection[k] > 0), JSON.stringify(bySection));
  check('伴学三个子分类都有人', ['tutor', 'read', 'home'].every(k => bySection[k] > 0), JSON.stringify(bySection));
  check('校车单独成类', bySection.bus >= 2, bySection.bus);
  const featured = logic.featuredGroups(allSvc, 2);
  check('精选四条推荐线', featured.length === 4 && featured.every(g => g.items.length === 2), featured.map(g => g.name + ':' + g.items.length).join(','));
  check('精选每条线不混类', featured.every(g => g.items.every(i => i.type === (g.id === 'tutor' ? 'tutor' : g.id === 'bus' ? 'bus' : 'course'))));
  check('子分类表与页面一致', logic.sectionsFor('course').length === 4 && logic.sectionsFor('tutor').length === 3);

  /* 伴学老师：学校 / 专业 / 星级 / 个人介绍 */
  const tutorSvc = allSvc.find(s => s.type === 'tutor');
  const brief = logic.listView(tutorSvc).tutor;
  check('伴学卡带学校与专业', !!brief.school && !!brief.major, brief.schoolText);
  check('伴学卡带星级与评价数', brief.score > 0 && brief.stars.length === 5 && brief.count > 0, brief.scoreText + '/' + brief.countText);
  const tutorFull = logic.tutorView(tutorSvc);
  check('伴学详情带个人介绍', !!tutorFull.intro && tutorFull.intro.length > 20, (tutorFull.intro || '').length);

  /* 服务人群：家长端目录只保留对家长开放的机构 */
  check('机构目录按人群分区', r.ok && r.data.every(i => Array.isArray(i.audience) && i.audience.includes('家长')));
  check('机构人群文案', r.ok && !!r.data[0].audienceText);

  r = await api.learning.resources('ky', '');
  check('学习资源-考研', r.ok && r.data.items.length >= 2, r.error);
  check('学习资源含科目目录', r.ok && r.data.subjects.length === 4);
  const item = r.data.items[0];
  check('学习资源视图', logic.learningItemView(item).title === item.title);

  /* 成人职考：每个科目都要有课，避免出现空科目 */
  r = await api.learning.resources('zk', '');
  check('学习资源-职考技能', r.ok && r.data.kindName === '职考技能', r.error);
  check('职考技能科目数', r.ok && r.data.subjects.length === 7, r.data && r.data.subjects.length);
  const zkSubjects = r.ok ? r.data.subjects : [];
  const zkCovered = r.ok ? zkSubjects.filter(s => r.data.items.some(i => i.subject === s)) : [];
  check('职考技能科目均有课程', zkCovered.length === zkSubjects.length, zkSubjects.filter(s => !zkCovered.includes(s)).join(','));
  r = await api.learning.resources('zk', '教师资格');
  check('职考技能按科目筛选', r.ok && r.data.items.length >= 1 && r.data.items.every(i => i.subject === '教师资格'));

  /* ---------- 升学规划 ---------- */
  r = await api.plan.overview();
  check('升学规划总览', r.ok && r.data.meta.grades.length === 6 && r.data.stages.length === 5, r.error);
  const planOv = r.data;
  check('升学规划六个板块', !!planOv.subjects && !!planOv.gap && planOv.timeline.nodes.length > 0);
  check('升学规划默认档案', planOv.profile.grade === '高一' && planOv.profile.second.length === 2);
  check('升学规划节点带倒计时', planOv.timeline.nodes.every(n => typeof n.daysUntil === 'number'), '');

  r = await api.plan.profileSave({ grade: '高三', province: '黑龙江', first: '历史', second: ['政治', '地理'], targetTier: '211', interest: ['法学'] });
  check('保存学生档案', r.ok && r.data.profile.grade === '高三' && r.data.profile.targetTier === '211', r.error);
  r = await api.plan.profileSave({ grade: '大一', province: '黑龙江', first: '历史', second: ['政治', '地理'], targetTier: '211', interest: [] });
  check('非法年级被拒', !r.ok && r.status === 400, r.status);
  r = await api.plan.profileSave({ grade: '高三', province: '黑龙江', first: '历史', second: ['政治'], targetTier: '211', interest: [] });
  check('再选科目不足 2 门被拒', !r.ok && r.status === 400, r.status);

  r = await api.plan.examAdd({ name: '高三一模', date: '2026-11-10', total: 620 });
  check('录入考试成绩', r.ok && r.data.count >= 1 && r.data.average > 0, r.error);
  r = await api.plan.examAdd({ name: '坏数据', date: '2026/11/10', total: 0 });
  check('坏成绩被拒', !r.ok && r.status === 400, r.status);
  r = await api.plan.overview();
  check('成绩进入差距计算', r.ok && r.data.gap.avgScore > 0 && r.data.gap.gap !== null);
  check('成绩进入多元升学默认分', r.ok && r.data.exams.average === r.data.gap.avgScore);

  r = await api.plan.subjects({ first: '物理', second: ['化学', '生物'] });
  check('选科覆盖率', r.ok && r.data.coverage >= 90 && r.data.combos.length === 12, r.error);
  r = await api.plan.subjects({ first: '历史', second: ['政治', '地理'] });
  check('选科覆盖率随组合变化', r.ok && r.data.coverage < 60, r.data && r.data.coverage);

  r = await api.plan.pathways({ score: 620 });
  check('多元升学自查', r.ok && r.data.pathways.length === 4 && r.data.eligibleCount >= 1, r.error);
  check('多元升学按条件判档', r.ok && r.data.pathways.every(p => ['eligible', 'manual', 'ineligible'].includes(p.status)));
  r = await api.plan.pathways({ score: 999 });
  check('超满分分数被拒', !r.ok && r.status === 400, r.status);

  r = await api.plan.reset();
  check('重置升学档案', r.ok && r.data.profile.grade === '高一', r.error);
  r = await api.plan.overview();
  check('重置后成绩清空', r.ok && r.data.exams.count === 0 && r.data.gap.avgScore === null);

  /* ---------- 高考 ---------- */
  r = await api.gaokao.meta();
  check('高考元数据', r.ok && r.data.provinces.length === 31 && r.data.years.length === 10, r.error);
  const meta = r.data;

  r = await api.gaokao.universities({ page: 1, size: 20, scoreProvince: '黑龙江', year: 2025, sort: 'rank' });
  check('院校列表', r.ok && r.data.items.length === 20 && r.data.total > 100, r.error);
  const uni = logic.universityView(r.data.items[0]);
  check('院校视图字段', !!uni.name && uni.line !== '');

  r = await api.gaokao.detail(uni.id, '黑龙江', 2025);
  check('院校详情', r.ok && r.data.majors.length > 0 && r.data.lines.national.length === 10, r.error);
  const detail = r.data;

  r = await api.gaokao.majorSeries(uni.id, detail.majors[0].name, '黑龙江');
  check('专业趋势', r.ok && r.data.series.length === 10, r.error);

  r = await api.gaokao.recommend({ province: '黑龙江', score: 520, subject: '物理', year: 2025, limit: 8 });
  check('推荐方案', r.ok && Array.isArray(r.data.buckets.chong), r.error);
  check('推荐分档计数', r.ok && r.data.counts.chong + r.data.counts.wen + r.data.counts.bao > 0);

  r = await api.gaokao.recommend({ province: '黑龙江', score: 9999, subject: '物理' });
  check('分数越界被拒', !r.ok, r);

  /* ---------- 备考 ---------- */
  r = await api.exam.meta();
  check('备考元数据', r.ok && r.data.kinds.length === 3, r.error);

  r = await api.exam.items({ kind: 'gwy', page: 1, size: 12, education: '本科', sort: 'line' });
  check('岗位列表', r.ok && r.data.items.length === 12 && r.data.total > 50, r.error);
  const examItem = logic.examItemView(r.data.items[0]);
  check('岗位视图字段', !!examItem.org && examItem.quota > 0);

  r = await api.exam.detail('gwy', examItem.id, 2025);
  check('岗位详情', r.ok && r.data.series.length === 10, r.error);

  r = await api.exam.match({ kind: 'gwy', score: 130, education: '本科', limit: 8 });
  check('分数匹配', r.ok && Array.isArray(r.data.buckets.chong), r.error);

  r = await api.exam.resources('ky', 0);
  check('备考资料', r.ok && r.data.orgs.length > 0 && r.data.courses.length > 0 && r.data.books.length > 0, r.error);

  /* ---------- 注册登录 ---------- */
  r = await api.auth.register('13900000001', 'password123', 'parent');
  check('家长注册', r.ok && r.data.token && r.data.user.role === 'parent', r.error);
  api.setToken(r.data.token);
  api.setUser(r.data.user);
  const parentToken = r.data.token;

  r = await api.auth.me();
  check('会话校验', r.ok && r.data.authenticated && r.data.user.role === 'parent', r.error);

  r = await api.auth.login('13900000001', 'wrongpass1');
  check('错误密码返回 401 但不清会话', !r.ok && r.status === 401 && !r.needLogin, r);
  check('令牌仍在', !!api.token());

  /* ---------- 下单支付核销 ---------- */
  r = await api.orders.create({
    serviceId: 'l1', student: '小明', phone: '13900000001',
    packageId: (learningSvc.packages || [])[0] ? learningSvc.packages[0].id : undefined
  });
  check('下单', r.ok && r.data.status === 'pending', r.error);
  const order = r.data;
  check('订单金额取套餐价', order.amount === learningSvc.packages[0].price, order.amount);

  r = await api.orders.pay(order.id);
  check('支付', r.ok && r.data.status === 'paid' && r.data.code, r.error);

  r = await api.orders.list();
  check('我的订单', r.ok && r.data.length === 1, r.error);

  r = await api.orders.complete(order.id);
  check('核销', r.ok && r.data.status === 'completed', r.error);

  /* ---------- 学习清单 / 志愿表 ---------- */
  r = await api.lists.admissionSave([{ id: uni.id, name: uni.name, major: detail.majors[0].name, line: uni.line, probability: 60 }]);
  check('保存志愿表', r.ok && r.data.length === 1, r.error);
  r = await api.lists.admissionGet();
  check('读取志愿表', r.ok && r.data[0].id === uni.id, r.error);

  r = await api.lists.examSave([{ id: examItem.id, kind: 'gwy', org: examItem.org, title: examItem.title, line: examItem.line }]);
  check('保存报考清单', r.ok && r.data.length === 1, r.error);

  /* ---------- 档案 / 反馈 ---------- */
  r = await api.profile.update({
    name: '家长甲', address: '哈尔滨市道里区',
    students: [{ name: '小明', age: 9, gender: '男', stage: '小学', guardian: '家长甲', relation: '父亲', phone: '13900000001' }]
  });
  check('更新档案', r.ok && r.data.students.length === 1, r.error);
  r = await api.profile.get();
  check('读取档案', r.ok && r.data.name === '家长甲' && r.data.orders === 1, r.error);
  check('档案字段类型', typeof r.data.students[0].age === 'number' || r.data.students[0].age === null);

  r = await api.feedback.submit({ category: '课程', content: '课程安排很清晰，希望增加周末班次。', contact: '13900000001', rating: 5 });
  check('提交反馈', r.ok && r.data.status === 'pending', r.error);
  r = await api.feedback.list();
  check('反馈列表', r.ok && r.data.length === 1, r.error);

  /* ---------- 机构入驻 → 审核 → 发布课程 ---------- */
  r = await api.auth.register('13900000002', 'password123', 'institution');
  check('机构注册', r.ok && r.data.user.role === 'institution', r.error);
  api.setToken(r.data.token);
  api.setUser(r.data.user);

  r = await api.services.create({ type: 'course', title: '尝试未入驻', category: '测试', price: 100, unit: '课时', description: '未审核应被拒绝' });
  check('未入驻不能发课', !r.ok && r.status === 403, r);

  r = await api.applications.submit({ name: '启明学社', phone: '13900000002', type: '机构', contact: '孙老师' });
  check('提交入驻', r.ok && r.data.status === 'pending', r.error);
  const appId = r.data.id;

  r = await api.applications.submit({ name: '启明学社', phone: '13900000002', type: '机构', contact: '孙老师' });
  check('重复待审核被拒', !r.ok && r.status === 409, r);

  r = await api.applications.approve(appId, config.ADMIN_TOKEN);
  check('审核通过', r.ok && r.data.status === 'approved' && !!r.data.institutionId, r.error);
  const institutionId = r.data.institutionId;

  r = await api.institutions.update(institutionId, { intro: '专注中学理科小班教学', contact: '孙老师', phone: '0451-88990011' });
  check('更新机构资料', r.ok && r.data.intro === '专注中学理科小班教学', r.error);

  r = await api.services.create({
    type: 'course', title: '中考物理冲刺班', category: '学科提升', price: 980, unit: '12课时',
    description: '力学与电学专题突破，配套每周一测。', location: '南岗区 · 学府路', remaining: 15,
    learning: { kind: 'ky', subject: '数学' },
    packages: [{ name: '冲刺班', price: 980, lessons: 12, description: '共 6 周' }]
  });
  check('发布课程', r.ok && r.data.packages.length === 1, r.error);
  const courseId = r.data.id;
  check('发布后归到本机构', r.data.merchant === '启明学社', r.data.merchant);

  r = await api.services.update(courseId, { price: 1080, packages: [{ id: r.data.packages[0].id, name: '冲刺班', price: 1080, lessons: 12, description: '共 6 周' }] });
  check('修改课程', r.ok && r.data.price === 1080, r.error);

  /* 服务人群：只开给家长的机构课程不进大学生学习资源 */
  r = await api.learning.resources('ky', '数学');
  check('家长机构课程不进学习资源', r.ok && !r.data.items.some(i => i.id === courseId), r.error);

  /* 机构把服务人群改成「家长 + 大学生」后，课程立即进入学习资源 */
  r = await api.institutions.list();
  const orgId = r.ok && r.data[0] ? r.data[0].id : '';
  r = await api.institutions.update(orgId, { audience: ['家长', '大学生'] });
  check('工作台修改服务人群', r.ok && r.data.audience.length === 2, r.error);
  r = await api.learning.resources('ky', '数学');
  check('改成大学生后进入学习资源', r.ok && r.data.items.some(i => i.id === courseId), r.error);
  r = await api.institutions.update(orgId, { audience: [] });
  check('服务人群不能为空', !r.ok && r.status === 400, r);

  r = await api.institutions.list();
  check('机构账号只看自己', r.ok && r.data.length === 1 && r.data[0].name === '启明学社', r.error);
  check('机构课程数', r.ok && r.data[0].courseCount === 1, r.data[0] && r.data[0].courseCount);

  /* ---------- 平台管理 ---------- */
  r = await api.applications.list(config.ADMIN_TOKEN);
  check('管理员查看申请', r.ok && r.data.length >= 1, r.error);
  r = await api.applications.list('wrong-token');
  check('错误令牌被拒', !r.ok && r.status === 403, r);

  r = await api.orders.adminList(config.ADMIN_TOKEN);
  check('管理员查看全部订单', r.ok && r.data.length >= 1, r.error);
  r = await api.orders.adminList('wrong-token');
  check('订单列表需令牌', !r.ok, r);

  /* ---------- 家长视角读机构课程 ---------- */
  api.setToken(parentToken);
  api.setUser({ id: 'p', phone: '13900000001', role: 'parent' });
  r = await api.services.list();
  const created = r.data.find(s => s.id === courseId);
  check('家长可见新课程', !!created && created.merchant === '启明学社', !!created);

  r = await api.orders.create({ serviceId: courseId, student: '小红', phone: '13900000001', packageId: created.packages[0].id });
  check('家长下单新课程', r.ok && r.data.amount === 1080, r.error);
  const order2 = r.data;
  r = await api.orders.adminComplete(order2.id, config.ADMIN_TOKEN);
  check('未支付不能核销', !r.ok && r.status === 409, r);

  /* ---------- 私家车入驻（接送板块） ---------- */
  r = await api.applications.submit({
    type: '接送', name: '家长甲', phone: '13900000001',
    area: '南岗区 · 学府小区', school: '学府小学', childGrade: '三年级',
    vehicle: '5 座轿车 · 配安全座椅', timeText: '工作日早 07:30 送上 · 晚 16:40 接回',
    seat: 2, years: 3
  });
  check('未勾选安全承诺被拒', !r.ok && r.status === 400, r);
  r = await api.applications.submit({
    type: '接送', name: '家长甲', phone: '13900000001',
    area: '南岗区 · 学府小区', school: '学府小学', childGrade: '三年级',
    vehicle: '5 座轿车', timeText: '随时', seat: 9, years: 3, safety: true
  });
  check('可接孩子数须 1–6', !r.ok && r.status === 400, r);
  r = await api.applications.submit({
    type: '接送', name: '家长甲', phone: '13900000001',
    area: '南岗区 · 学府小区', school: '学府小学', childGrade: '三年级',
    vehicle: '5 座轿车 · 配安全座椅', timeText: '工作日早 07:30 送上 · 晚 16:40 接回',
    seat: 2, years: 3, safety: true
  });
  check('私家车入驻提交', r.ok && r.data.status === 'pending' && r.data.childGrade === '三年级', r.error);
  r = await api.applications.mine();
  check('家长可查接送申请', r.ok && r.data.some(a => a.type === '接送'), r.error);

  /* ---------- 学鹭助手 ---------- */
  r = await api.assistant.chat('怎么预约课程？', []);
  check('助手命中常见问题', r.ok && r.data.matched && String(r.data.answer).length > 10, r.error);
  check('助手给出跳转', r.ok && !!r.data.route && r.data.route.path.indexOf('/pages/') === 0);
  check('助手跳转带 tab 标记', r.ok && typeof r.data.route.tab === 'boolean');
  r = await api.assistant.chat('今天天气怎么样', []);
  check('助手无法回答时兜底', r.ok && !r.data.matched && !!r.data.answer);

  r = await api.assistant.chat('我是一个十一岁孩子的家长，我想要给孩子找一个数学课程', []);
  check('助手按年龄推荐数学课程', r.ok && r.data.matched && r.data.answer.indexOf('数学课程') >= 0, r.data && r.data.answer);
  check('推荐带课程跳转', r.ok && r.data.route && r.data.route.key === 'course', r.data && r.data.route);
  check('推荐带可点课程卡', r.ok && Array.isArray(r.data.courses) && r.data.courses.length > 0 && r.data.courses.every(c => c.id && c.title && c.price !== undefined), JSON.stringify(r.data && r.data.courses));
  r = await api.assistant.chat('孩子上初三，有没有语文课程推荐', []);
  check('助手按年级推荐语文课程', r.ok && r.data.matched && r.data.answer.indexOf('初中语文') >= 0, r.data && r.data.answer);

  /* ---------- 服务人群 ---------- */
  r = await api.learning.resources('other', '');
  check('学习资源-其他课程', r.ok && r.data.items.some(i => i.kind === 'other'), r.error);
  r = await api.services.list('course');
  check('课程带服务人群', r.ok && r.data.every(s => Array.isArray(s.audience) && s.audience.length), r.error + ' / ' + JSON.stringify((r.data||[]).filter(s => !Array.isArray(s.audience) || !s.audience.length).map(s => [s.id, s.merchant])));
  r = await api.services.list('course');
  const parentVisible = (r.data || []).filter(s => !s.audience || s.audience.includes('家长')).length;
  check('家长端课程少于全部课程', parentVisible < (r.data || []).length);

  /* ---------- 登出 ---------- */
  r = await api.auth.logout();
  check('登出', r.ok, r.error);
  r = await api.orders.list();
  check('登出后需要登录', !r.ok && r.needLogin, r);

  console.log('通过：' + pass + ' 项');
  if (fails.length) {
    console.log('失败：' + fails.length + ' 项');
    for (const f of fails) console.log('  ✗ ' + f);
    process.exit(1);
  }
  console.log('全部通过');
})();

function getAppCache(list) {
  global.getApp = () => ({ globalData: { services: list }, cacheServices() {}, findService() {} });
}
