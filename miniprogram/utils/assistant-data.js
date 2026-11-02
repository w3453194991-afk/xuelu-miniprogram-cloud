/* 学鹭助手 · 常见问题库与匹配逻辑
 * 与网页版 assistant.js 同一套匹配规则：先去停用词 → 整词包含优先 → 二元组重合兜底。
 * 这里只放纯数据与纯函数，页面与云函数都直接复用。
 */

/* [问题, 答案] */
const FAQ = [
  ['怎么注册账号？', '在「我的」页点登录，用手机号注册并选择家长、大学生或机构身份。'],
  ['忘记密码怎么办？', '登录页点「忘记密码」，输入注册手机号获取验证码后重设密码。'],
  ['没有账号能看内容吗？', '可以。课程、院校、岗位都能浏览，只有下单、收藏和提交申请需要登录。'],
  ['账号类型选错了怎么办？', '退出后重新注册一个对应身份的账号即可，已产生的订单和申请不会丢失。'],
  ['一个账号能加几个孩子？', '最多 5 个，在「我的 → 学员信息」里添加和维护。'],
  ['怎么修改孩子信息？', '进入「我的」，找到学员信息卡片，点编辑后保存即可。'],
  ['怎么预约课程？', '在首页选一门课，点进详情页后「立即报名」，填写学员信息提交，再到订单里支付。'],
  ['课程可以试听吗？', '暂不支持单节试听，可以先进详情页看课程介绍、师资与套餐说明。'],
  ['课程套餐怎么选？', '详情页每个套餐单独定价并标注课时数，按需要选一个再报名。'],
  ['课程视频在哪看？', '课程详情页的套餐里有视频时会出现播放器，点开即可观看。'],
  ['课程名额怎么算？', '每门课都有剩余名额，支付成功时再次校验，售满会提示名额冲突。'],
  ['名额满了还能报吗？', '不能，可以等有人退课释放名额，或者先看看同类其他课程。'],
  ['怎么收藏课程？', '课程卡片或详情页点收藏图标，收藏内容在「我的 → 我的收藏」里。'],
  ['收藏的内容在哪看？', '「我的 → 我的收藏」，可按课程、院校、岗位筛选。'],
  ['课程能转让给别人吗？', '不支持，名额绑定报名时填写的学员信息。'],
  ['怎么找附近的机构？', '首页下方有机构目录，可以按名称和地址搜索，点进去看机构和课程。'],
  ['伴学服务是什么？', '大学生提供的阅读陪伴、习惯培养、时间规划支持，不含学科补课。'],
  ['伴学怎么选时间？', '伴学详情页有老师开放的固定时段，选好时段后按小时计价。'],
  ['一次伴学多久？', '一个时段 1 小时，可以一次约多个时段，价格按时段数量自动计算。'],
  ['老师资料可信吗？', '入驻时需提交学历、学校与简历，平台审核通过后才会出现在列表里。'],
  ['可以对老师提要求吗？', '可以在下单备注里写清孩子的年龄、性格和陪伴重点，老师会提前准备。'],
  ['伴学能提分吗？', '不做提分承诺。伴学只提供陪伴与习惯支持，学科问题请找对应课程。'],
  ['校车怎么订购？', '在首页「安心校车」选线路，详情页选上下车点后按月订购。'],
  ['校车能看车辆位置吗？', '可以，详情页有线路站点图和车辆位置示意，能看到当前行驶到哪一站。'],
  ['可以换上下车点吗？', '订购后暂不支持自助修改，需要联系机构在后台调整。'],
  ['校车费用包含什么？', '月付套餐含固定线路接送，不含餐费和其他杂费。'],
  ['校车晚点会通知吗？', '会通过站内消息提醒，也可以在机构主页找到司机电话直接联系。'],
  ['订单多久不支付会失效？', '30 分钟，超时系统自动取消并释放名额。'],
  ['怎么查看我的订单？', '底部「订单」标签，全部订单按状态分组展示。'],
  ['支付是真实的吗？', '当前使用平台内的支付流程，不产生任何真实扣款。'],
  ['核销码在哪里看？', '支付成功后，订单卡片里会显示 8 位核销码。'],
  ['核销码怎么用？', '把码给机构或老师，他们在工作台点核销即可完成订单。'],
  ['订单可以取消吗？', '待支付状态可以直接取消；已支付的要先申请退款。'],
  ['怎么申请退款？', '在订单详情里选订单、填写原因提交，平台审核通过后状态变为已退款。'],
  ['退款多久到账？', '审核通过后即时退回原支付渠道，通常 1–3 个工作日到账。'],
  ['退款被拒绝怎么办？', '可以补充说明后再次申请，或直接联系机构协商解决。'],
  ['可以部分退款吗？', '暂不支持按课次部分退，只能整单退。'],
  ['发票怎么开？', '在订单详情里选已支付订单，填抬头和税号后提交开票申请。'],
  ['能开专票吗？', '目前只支持普通发票，专票需要联系平台客服登记。'],
  ['怎么评价课程？', '订单完成后，订单卡会出现评价入口，星级 1–5 星加文字。'],
  ['评价可以修改吗？', '提交后不能自行修改，可以联系客服处理。'],
  ['怎么入驻成为机构？', '「我的 → 我要入驻」提交资料，平台审核通过后即可发布课程。'],
  ['入驻要准备什么？', '机构名称、联系人、手机号、服务人群；伴学还要学历、学校、简历和照片。'],
  ['入驻审核要多久？', '提交后通常在 1–3 个工作日内处理，进度可在入驻页查看。'],
  ['审核没通过怎么办？', '按驳回说明补充资料后重新提交，同一时间只能有一份待审申请。'],
  ['服务人群怎么选？', '入驻时选家长或大学生，可多选；决定课程进家长课程页还是学习资源页。'],
  ['服务人群能改吗？', '可以，机构工作台的机构资料里随时修改，保存后分区立即变化。'],
  ['机构怎么发布课程？', '工作台点「发布课程」，填名称、分类、价格、课时和介绍，保存即上线。'],
  ['机构能自己改价格吗？', '可以，工作台编辑课程直接改，用户端刷新后立即生效。'],
  ['机构怎么核销订单？', '工作台订单列表里，已支付订单点核销即可。'],
  ['机构能看到收入吗？', '可以，工作台汇总已支付与已完成订单的成交金额。'],
  ['机构怎么回复评价？', '工作台评价列表里，每条评价下方可以写回复。'],
  ['服务可以下架吗？', '可以，把课程设为下架，用户端列表就不再展示。'],
  ['下架的课程订单怎么办？', '已产生的订单不受影响，仍可正常核销。'],
  ['一个机构能发几门课？', '不限数量，课程列表按发布顺序展示。'],
  ['学习资源是什么？', '大学生中心的学习资源页，按考公、考研、考编分类汇总机构课程。'],
  ['为什么我的课程没进学习资源？', '需要机构服务人群包含大学生；没选考试方向的会归到「其他课程」。'],
  ['其他课程是什么分类？', '机构选了大学生但课程没设考试方向时归到这里，课程不会因此消失。'],
  ['学习资源能按科目筛吗？', '可以，先选考试分类，再选科目，只展示对应课程。'],
  ['学习资源怎么报名？', '点进课程详情就能报名，流程和首页课程一样。'],
  ['学习资源收费吗？', '课程由机构定价，按套餐课时收费，详情页有明确价格。'],
  ['升学规划怎么用？', '底部「学习」页进入升学规划，先选省份和分数，再看冲稳保推荐。'],
  ['冲稳保是什么意思？', '冲是分数线略高于你，稳是和你接近，保是明显低于你用来兜底。'],
  ['推荐准吗？', '按往年分数和位次做的参考模型，最终填报请以官方招生计划为准。'],
  ['院校数据有几年？', '2016–2025 共 10 年，含校线、各省投档线和专业线。'],
  ['为什么各省分数线不同？', '各省考生规模、招生计划和竞争程度不同，模型里用省份系数换算。'],
  ['上海海南的分数为什么不一样？', '两地高考满分不同（上海 660、海南 900），系统会自动换算。'],
  ['怎么看某专业在哪些学校有？', '在专业库里选学科门类，能看到开设该专业的院校和各自分数线。'],
  ['选科要求是什么？', '新高考 3+1+2 下部分专业要求必选物理或历史，专业页会标注。'],
  ['一分一段怎么看？', '输入分数能看到累计位次、同分人数，以及这个位次大致能报的院校区间。'],
  ['为什么要看位次不看分数？', '每年题目难度不同，分数会浮动，位次更能反映真实竞争力。'],
  ['升学规划能做什么？', '学生档案、学业曲线、路径规划、选科建议、多元升学、关键节点六个板块放在一页，档案保存后随时回来接着看。'],
  ['目标差距怎么算？', '用目标层次的模拟投档线减去最近 6 次考试均分，再按剩余学期折算成每学期需要提升的分数。'],
  ['院校分数线在哪看？', '升学规划「路径规划」底部进「院校参考」，按省份、层次、类型筛院校，能看到模拟投档线与位次。'],
  ['多元升学是什么？', '强基计划、综合评价、专项计划、竞赛保送四条路径，按年级、分数、位次和奖项逐条核对是否基本符合。'],
  ['分数线预警是什么？', '标出今年比去年涨幅超过 10 分的院校，提示风险。'],
  ['院校对比最多几所？', '4 所，并排比较分数线、位次、专业数和排名。'],
  ['考公考研怎么用？', '「学习」页进入考公考研，三个标签切换考公、考研、考编，支持筛选和分数匹配。'],
  ['岗位数据从哪来？', '按公开招录信息整理的岗位库，报考请以官方公告为准。'],
  ['进面线是什么？', '公务员考试进入面试的最低笔试分数，满分 200。'],
  ['竞争比怎么看？', '报名人数除以招录人数，数值越大竞争越激烈。'],
  ['考研复试线是什么？', '进入复试的最低初试总分，满分 500，还要参考国家线。'],
  ['国家线和院校线什么关系？', '院校线一般不低于国家线，热门院校会高出很多。'],
  ['考编的合格线是多少？', '满分 100，合格线通常 50–80 分，具体看单位和岗位要求。'],
  ['报考条件怎么自查？', '填学历、专业、政治面貌，系统逐条判断能否报考并说明原因。'],
  ['学历不够能报吗？', '不能，学历要求是硬条件，系统会标为不可报。'],
  ['专业不限的岗位多吗？', '有一部分综合管理岗不限专业，竞争通常更激烈。'],
  ['党员身份有什么用？', '部分岗位限中共党员，勾选后只显示这些岗位。'],
  ['报名日历在哪看？', '考公考研页的报名日历，显示报名起止、笔试和出分时间。'],
  ['备考计划怎么生成？', '填目标考试日期和每天可用时长，系统按阶段生成周计划。'],
  ['模拟成绩怎么查？', '输入准考证号，可以查到对应的成绩和排名。'],
  ['进面名单是什么？', '按 3:1 比例估算的进面名单，可以看自己大概排第几。'],
  ['职位表能导出吗？', '可以按当前筛选结果导出清单。'],
  ['全局搜索能找到什么？', '课程、机构、院校、岗位一次搜完，结果按类型分组。'],
  ['消息在哪看？', '「我的」页有消息入口，订单、核销、退款和提醒都会推到这里。'],
  ['平台管理在哪进？', '「我的」页最下方是平台管理，需要管理令牌才能查看申请和全部订单。'],
  ['怎么审核机构入驻？', '平台管理里打开入驻审核，看到待审申请可以直接通过或查看资料。'],
  ['管理令牌是什么？', '平台给管理员的访问凭证，输入后即可查看入驻申请与全部订单。'],
  ['怎么反馈问题？', '「我的 → 意见反馈」提交，可选择类型、写描述并留联系方式。'],
  ['反馈多久回复？', '一般 1–2 个工作日内处理，复杂问题会电话联系。'],
  ['数据存在哪里？', '账号资料与订单存储在云端，志愿表和收藏跟随账号同步。'],
  ['数据会丢吗？', '正常使用不会丢，退出登录不影响已提交的订单和申请。'],
  ['可以多人同时用吗？', '可以，每个账号看到的是自己的订单、申请和收藏。'],
  ['能填真实个人信息吗？', '可以填写必要的联系信息，身份证号等敏感信息不建议填写。'],
  ['手机上能用吗？', '现在就是手机端，微信里直接打开小程序即可。'],
  ['为什么点按钮没反应？', '先看是否已登录，网络慢时稍等一两秒再点一次。'],
  ['页面一直加载怎么办？', '下拉刷新一次；仍然不行就退出小程序重新进入。'],
  ['怎么联系平台？', '「我的 → 帮助中心」有客服电话、邮箱与服务时间。']
];

/* 去停用词：这些词几乎出现在每个问题里，留着会让匹配全跑偏 */
const STOP = ['怎么', '怎样', '如何', '什么', '请问', '一下', '我想', '可以', '能不能', '是否',
  '能', '吗', '呢', '的', '是', '我', '你', '有', '在', '看', '要', '办', '都', '还', '这', '那', '哪', '哪里', '哪个', '几', '多少'];

function coreOf(text) {
  let s = String(text || '');
  for (const w of STOP) s = s.split(w).join(' ');
  return s.replace(/[\s，。？！?、,.;；:：]/g, '').trim();
}

function bigrams(text) {
  const out = new Set();
  for (let i = 0; i < text.length - 1; i++) out.add(text.slice(i, i + 2));
  return out;
}

/* 页面路由：命中关键词就给一个「去这里」按钮。
 * 顺序有意义——越具体的越靠前（退款在订单前，志愿在课程前）。
 * tab: true 表示 tabBar 页面，需要 switchTab 打开。 */
const ROUTES = [
  { key: 'refund', label: '退款与发票', path: '/pages/orders/orders', tab: true, keys: ['退款', '退课', '发票', '开票', '报销'] },
  { key: 'report', label: '订单评价', path: '/pages/orders/orders', tab: true, keys: ['评价', '评分', '星级'] },
  { key: 'favorites', label: '我的收藏', path: '/pages/mine/mine', tab: true, keys: ['收藏'] },
  { key: 'messages', label: '消息中心', path: '/pages/mine/mine', tab: true, keys: ['消息', '通知', '提醒'] },
  { key: 'gaokao', label: '升学规划', path: '/pages/gaokao/gaokao', tab: false, keys: ['志愿', '院校', '专业库', '投档线', '位次', '一分一段', '选科', '升学规划', '学业曲线', '强基', '综评', '专项', '关键节点'] },
  { key: 'exam', label: '考公考研', path: '/pages/exam/exam', tab: false, keys: ['考公', '考研', '考编', '岗位', '进面', '竞争比', '报名日历', '备考', '准考证'] },
  { key: 'learning', label: '学习资源', path: '/pages/learning/learning', tab: true, keys: ['学习资源', '其他课程', '考公考研课'] },
  { key: 'bus', label: '安心校车', path: '/pages/index/index', tab: true, keys: ['校车', '线路', '接送', '站点'] },
  { key: 'tutor', label: '优选伴学', path: '/pages/index/index', tab: true, keys: ['伴学', '伴学', '老师', '课时'] },
  { key: 'course', label: '精品课程', path: '/pages/index/index', tab: true, page: 'course', keys: ['课程', '报课', '试听', '套餐'] },
  { key: 'institutions', label: '机构目录', path: '/pages/institutions/institutions', tab: false, keys: ['机构目录', '附近机构', '找机构'] },
  { key: 'orders', label: '我的订单', path: '/pages/orders/orders', tab: true, keys: ['订单', '核销', '支付', '付款', '取消'] },
  { key: 'join', label: '我要入驻', path: '/pages/join/join', tab: false, keys: ['入驻', '机构注册', '服务人群'] },
  { key: 'workspace', label: '机构工作台', path: '/pages/institution/institution', tab: false, keys: ['工作台', '发布课程', '下架', '上架', '收入'] },
  { key: 'profile', label: '个人中心', path: '/pages/mine/mine', tab: true, keys: ['账号', '密码', '登录', '资料', '孩子', '学员', '手机号'] },
  { key: 'admin', label: '平台管理', path: '/pages/admin/admin', tab: false, keys: ['平台管理', '管理令牌', '审核', '看板'] },
  { key: 'feedback', label: '意见反馈', path: '/pages/feedback/feedback', tab: false, keys: ['反馈', '建议', '投诉'] },
  { key: 'help', label: '帮助中心', path: '/pages/help/help', tab: false, keys: ['帮助', '客服', '联系平台', '电话'] }
];

function routeOf(text) {
  const s = String(text || '');
  for (const r of ROUTES) {
    for (const k of r.keys) {
      if (s.includes(k)) return { key: r.key, label: r.label, path: r.path, tab: !!r.tab };
    }
  }
  return null;
}

function score(question, input) {
  const q = String(question || '');
  const core = coreOf(input);
  if (!core) return 0;
  /* 整词命中：长度越长越可信 */
  if (core.length >= 2 && q.includes(core)) return 100 + core.length * 5;
  const qb = bigrams(q);
  let hit = 0;
  for (const b of bigrams(core)) if (qb.has(b)) hit += 1;
  return hit * 10;
}

/* 整词命中（>=100）或至少两个二元组重合（>=20）才算答上 */

/* ---------- 课程推荐意图 ----------
 * 例：「我是一个十一岁孩子的家长，我想要给孩子找一个数学课程」
 * 识别 学科（数学/语文/英语…）+ 学段（小学/初中/高中、年级、年龄），
 * 从内置目录里筛出真实课程并给出可点的跳转。 */
const seedData = require('./seed-data.js');

const SUBJECT_WORDS = [
  { key: '数学', words: ['数学', '奥数', '算数', '思维'] },
  { key: '语文', words: ['语文', '阅读写作', '作文', '写作'] },
  { key: '英语', words: ['英语', '口语', '拼读'] },
  { key: '物理', words: ['物理'] },
  { key: '化学', words: ['化学'] },
  { key: '美术', words: ['美术', '画画', '绘画'] },
  { key: '编程', words: ['编程', '机器人'] },
  { key: '篮球', words: ['篮球', '运动'] }
];

const STAGES = [
  { key: '小学', grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'], ages: [6, 12] },
  { key: '初中', grades: ['初一', '初二', '初三', '七年级', '八年级', '九年级'], ages: [13, 15] },
  { key: '高中', grades: ['高一', '高二', '高三'], ages: [16, 18] }
];

const NUMBER_WORDS = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12 };

function ageOfYear(text) {
  const s = String(text || '');
  /* 「十一岁」「11岁」「十一周岁」 */
  const cn = s.match(/[一二两三四五六七八九十]{1,2}\s*周?\s*岁/);
  if (cn) {
    const word = cn[0].replace(/周?\s*岁/, '');
    if (NUMBER_WORDS[word]) return NUMBER_WORDS[word];
  }
  const num = s.match(/(\d{1,2})\s*周?\s*岁/);
  if (num) return Number(num[1]);
  return null;
}

function gradeOf(text) {
  const s = String(text || '');
  for (const stage of STAGES) {
    for (const g of stage.grades) {
      if (s.includes(g)) return { stage: stage.key, grade: g };
    }
  }
  return null;
}

function stageByAge(age) {
  if (age === null) return null;
  for (const stage of STAGES) {
    if (age >= stage.ages[0] && age <= stage.ages[1]) return stage.key;
  }
  return age < 6 ? '学前' : '高中';
}

function subjectOf(text) {
  const s = String(text || '');
  for (const subject of SUBJECT_WORDS) {
    for (const w of subject.words) if (s.includes(w)) return subject.key;
  }
  return null;
}

function courseRecommend(input) {
  const raw = String(input || '');
  const subject = subjectOf(raw);
  if (!subject) return null;
  /* 没有找课意向的（如「怎么评价课程」）不进推荐 */
  const want = ['找', '报', '推荐', '想要', '想给', '适合', '选', '学习', '学学', '上什么'];
  if (!want.some(w => raw.includes(w))) return null;

  const age = ageOfYear(raw);
  const grade = gradeOf(raw);
  const stage = grade ? grade.stage : stageByAge(age);
  const isParentAsk = raw.includes('孩子') || raw.includes('儿子') || raw.includes('女儿') || !!stage;

  const pool = (seedData.SEED_SERVICES || []).filter(item =>
    item.type === 'course' &&
    (item.audience || []).includes('家长') &&
    (String(item.title) + item.category + item.description).includes(subject)
  );
  if (!pool.length) {
    return {
      q: subject + '课程推荐',
      a: '学科' + subject + '课程正在上架中，您可以先到首页「课程」Tab 看看其他课，或者用搜索找找。',
      matched: true,
      related: [],
      courses: [],
      go: { key: 'course', label: '精品课程', path: '/pages/index/index', tab: true, page: 'course' }
    };
  }

  /* 有学段信息时优先匹配标题/描述里的学段词，再按余位与推荐标签排序 */
  const scored = pool
    .map(item => {
      let s = 0;
      const text = String(item.title) + item.description;
      if (stage && text.includes(stage)) s += 40;
      if (stage === '小学' && text.includes('小升初')) s += 15;
      if (String(item.tag || '').includes('推荐') || String(item.tag || '').includes('热选')) s += 8;
      s += Math.min(10, Number(item.remaining || 0) / 3);
      return { item, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  const courses = scored.map(({ item }) => ({
    id: item.id,
    title: item.title,
    merchant: item.merchant,
    price: item.price,
    unit: item.unit,
    icon: item.icon || '📖',
    tag: item.tag || ''
  }));
  /* 正文只列名称，价格与跳转放到下方可点课程卡上 */
  const lines = courses.map((c, i) => (i + 1) + '. ' + c.title + '（' + c.merchant + '）');

  const who = isParentAsk && (age !== null || grade)
    ? (age !== null
        ? age + ' 岁的孩子（约' + (age <= 6 ? '学龄前' : age <= 12 ? ['一', '二', '三', '四', '五', '六'][Math.min(5, age - 6)] + '年级' : '初中') + '）'
        : (grade ? grade.stage + ' ' + grade.grade + '的孩子' : '孩子'))
    : '孩子';
  const head = stage
    ? '为' + who + '推荐这几门' + (stage === '小学' ? '小学' : stage) + subject + '课程：'
    : '推荐这几门' + subject + '课程：';

  return {
    q: subject + '课程推荐',
    a: head + '\n' + lines.join('\n') + '\n点课程卡可以直接看详情报名：',
    matched: true,
    related: [],
    courses,
    go: { key: 'course', label: '精品课程', path: '/pages/index/index', tab: true, page: 'course' }
  };
}

function answer(input) {
  /* 找课意图优先：学科 + 学段/年龄命中时直接给课程推荐 */
  const rec = courseRecommend(input);
  if (rec) return rec;

  const ranked = FAQ
    .map(([q, a]) => ({ q, a, s: score(q, input) }))
    .sort((x, y) => y.s - x.s);
  const top = ranked[0];
  if (top && top.s >= 20) {
    return {
      q: top.q,
      a: top.a,
      matched: true,
      related: [],
      go: routeOf(String(input || '') + ' ' + top.q)
    };
  }
  const related = ranked.filter(x => x.s > 0).slice(0, 3);
  return {
    q: '',
    a: '这个问题我还没学会。你可以换个说法，或者点下面的常见问题看看。',
    matched: false,
    related,
    go: routeOf(input)
  };
}

/* 首屏推荐问题：覆盖最主要的几条动线 */
const QUICK = [
  '我想给孩子找一个数学课程',
  '怎么预约课程？',
  '订单怎么取消？',
  '升学规划怎么用？',
  '怎么入驻成为机构？',
  '核销码在哪里看？'
];

module.exports = { FAQ, ROUTES, QUICK, answer, routeOf, coreOf, bigrams };
