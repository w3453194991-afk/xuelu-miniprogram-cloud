/* 学鹭伴学 · 种子数据（小程序内置，本地模拟与云数据库播种共用）
 *
 * 服务目录 = 种子 + 用户新增/覆盖。
 * 云开发模式下由 seed 云函数写入云数据库；本地模拟模式直接用于内存数据库。
 */

const SEED_SERVICES = [
  {id:'c1',type:'course',title:'创意美术 · 少儿色彩探索',merchant:'拾光艺术中心',category:'艺术启蒙',price:299,unit:'8课时',icon:'🎨',tone:'peach',tag:'人气推荐',description:'从观察到表达，让孩子用色彩讲自己的故事。小班教学，适合 6–10 岁。',location:'道里区 · 群力大道',city:'哈尔滨',remaining:18,
   audience:['家长'],
   address:'哈尔滨市道里区群力大道 88 号 3 层',phone:'0451-88001234',
   merchantDetail:{name:'拾光艺术中心',logo:'🎨',intro:'专注 4–12 岁少儿美育的社区机构，小班教学，课程以观察力与表达力为主线。',foundYear:2016,verified:true,address:'哈尔滨市道里区群力大道 88 号 3 层',contact:'王老师',phone:'0451-88001234',licenses:['民办学校办学许可证','社会艺术水平考级报名点'],teachers:['王老师 · 色彩/水彩','李老师 · 素描/综合材料']},
   images:[
    {name:'主视觉 · 色彩教室',kind:'banner',tone:'peach',caption:'小班画室，每班 6–8 人'},
    {name:'课程现场 · 水彩探索',kind:'photo',tone:'peach',caption:'从调色开始认识色彩'},
    {name:'作品展示 · 孩子的故事',kind:'photo',tone:'lavender',caption:'每个孩子都能讲自己的故事'}
   ]},
  {id:'c2',type:'course',title:'青少年编程 · 创造力实验室',merchant:'未来星科创',category:'科学探索',price:499,unit:'6课时',icon:'🚀',tone:'lavender',tag:'新课上线',description:'通过图形化编程和动手项目，探索逻辑与创造的乐趣。适合 8–12 岁。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:12,
   audience:['家长','大学生'],
   address:'哈尔滨市南岗区学府路 199 号 6 层',phone:'0451-88005678',
   merchantDetail:{name:'未来星科创',logo:'🚀',intro:'面向 8–14 岁的科技素养机构，课程覆盖图形化编程、机器人与科学实验。',foundYear:2019,verified:true,address:'哈尔滨市南岗区学府路 199 号 6 层',contact:'周老师',phone:'0451-88005678',licenses:['科技类校外培训机构备案'],teachers:['周老师 · 图形化编程','孙老师 · 机器人搭建']},
   images:[
    {name:'主视觉 · 实验室',kind:'banner',tone:'lavender',caption:'六人一组，边做边学'},
    {name:'课程现场 · 图形化编程',kind:'photo',tone:'lavender',caption:'拖拽积木，理解顺序与循环'},
    {name:'课程现场 · 机器人搭建',kind:'photo',tone:'mint',caption:'把代码变成会动的小车'}
   ]},
  {id:'c3',type:'course',title:'篮球成长营 · 一起向上',merchant:'跃动体育',category:'运动成长',price:399,unit:'8课时',icon:'🏀',tone:'mint',tag:'周末好课',description:'基础运球、团队配合与体能训练，收获运动的快乐。适合 7–12 岁。',location:'道里区 · 群力体育公园',city:'哈尔滨',remaining:20,
   audience:['家长'],
   address:'哈尔滨市道里区群力体育公园体育馆 2 号馆',phone:'0451-88004321',
   merchantDetail:{name:'跃动体育',logo:'🏀',intro:'青少年篮球与体能培训机构，教练具备青少年体适能指导经验。',foundYear:2018,verified:true,address:'哈尔滨市道里区群力体育公园体育馆 2 号馆',contact:'刘教练',phone:'0451-88004321',licenses:['体育类校外培训备案'],teachers:['刘教练 · 基础运球','赵教练 · 体能与团队配合']},
   images:[
    {name:'主视觉 · 球馆',kind:'banner',tone:'mint',caption:'室内木地板球场，雨天照常上课'},
    {name:'课程现场 · 运球训练',kind:'photo',tone:'mint',caption:'分组练习，人人有球'},
    {name:'课程现场 · 团队对抗',kind:'photo',tone:'peach',caption:'小场对抗，学会配合'}
   ]},
  {id:'c4',type:'course',title:'小学数学 · 思维训练班',merchant:'启明星学科辅导',category:'学科提升',price:880,unit:'12课时',icon:'🧮',tone:'mint',tag:'家长热选',description:'围绕计算能力、图形认知与应用题思路展开，按年级分班小班授课，适合三至六年级。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:16,
   audience:['家长'],
   address:'哈尔滨市南岗区学府路 128 号 2 层',phone:'0451-88007300',
   merchantDetail:{name:'启明星学科辅导',logo:'🌟',intro:'面向小学到初中的学科辅导机构，数学、语文、英语分年级小班授课，随堂测与家长反馈每讲同步。',foundYear:2017,verified:true,address:'哈尔滨市南岗区学府路 128 号 2 层',contact:'马老师',phone:'0451-88007300',licenses:['民办学校办学许可证'],teachers:['马老师 · 小学数学','刘老师 · 初中语文','陈老师 · 小学英语']},
   images:[
    {name:'主视觉 · 数学教室',kind:'banner',tone:'mint',caption:'按年级分班，每班 8 人'},
    {name:'课程现场 · 应用题拆解',kind:'photo',tone:'mint',caption:'画图找关系，思路看得见'}
   ]},
  {id:'c5',type:'course',title:'初中语文 · 阅读写作提升',merchant:'启明星学科辅导',category:'学科提升',price:960,unit:'12课时',icon:'📖',tone:'peach',tag:'家长热选',description:'现代文阅读按题型归类讲练，写作从审题立意到结构成文逐篇批改，适合七至九年级。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:14,
   audience:['家长'],
   address:'哈尔滨市南岗区学府路 128 号 2 层',phone:'0451-88007300',
   merchantDetail:{name:'启明星学科辅导',logo:'🌟',intro:'面向小学到初中的学科辅导机构，数学、语文、英语分年级小班授课，随堂测与家长反馈每讲同步。',foundYear:2017,verified:true,address:'哈尔滨市南岗区学府路 128 号 2 层',contact:'马老师',phone:'0451-88007300',licenses:['民办学校办学许可证'],teachers:['马老师 · 小学数学','刘老师 · 初中语文','陈老师 · 小学英语']},
   images:[
    {name:'主视觉 · 语文教室',kind:'banner',tone:'peach',caption:'每讲一篇精读 + 一篇写作'},
    {name:'课程现场 · 逐篇批改',kind:'photo',tone:'peach',caption:'作文面批，当堂讲评'}
   ]},
  {id:'c6',type:'course',title:'小学英语 · 自然拼读与口语',merchant:'启明星学科辅导',category:'学科提升',price:760,unit:'10课时',icon:'🔤',tone:'lavender',tag:'零基础可报',description:'从字母发音到拼读规则，配合课堂情景对话，帮孩子敢开口、会拼读，适合二至五年级。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:20,
   audience:['家长'],
   address:'哈尔滨市南岗区学府路 128 号 2 层',phone:'0451-88007300',
   merchantDetail:{name:'启明星学科辅导',logo:'🌟',intro:'面向小学到初中的学科辅导机构，数学、语文、英语分年级小班授课，随堂测与家长反馈每讲同步。',foundYear:2017,verified:true,address:'哈尔滨市南岗区学府路 128 号 2 层',contact:'马老师',phone:'0451-88007300',licenses:['民办学校办学许可证'],teachers:['马老师 · 小学数学','刘老师 · 初中语文','陈老师 · 小学英语']},
   images:[
    {name:'主视觉 · 英语教室',kind:'banner',tone:'lavender',caption:'全情景教学，人人开口'},
    {name:'课程现场 · 拼读游戏',kind:'photo',tone:'lavender',caption:'边玩边练，当堂巩固'}
   ]},
  {id:'c7',type:'course',title:'初中数学 · 代数几何衔接班',merchant:'启明星学科辅导',category:'学科提升',price:1080,unit:'14课时',icon:'📐',tone:'peach',tag:'小升初衔接',description:'从有理数运算到几何证明，补齐小学到初中的思维跨度，适合新初一、初二学生。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:15,
   audience:['家长'],
   address:'哈尔滨市南岗区学府路 128 号 2 层',phone:'0451-88007300',
   merchantDetail:{name:'启明星学科辅导',logo:'🌟',intro:'面向小学到初中的学科辅导机构，数学、语文、英语分年级小班授课，随堂测与家长反馈每讲同步。',foundYear:2017,verified:true,address:'哈尔滨市南岗区学府路 128 号 2 层',contact:'马老师',phone:'0451-88007300',licenses:['民办学校办学许可证'],teachers:['马老师 · 小学数学','刘老师 · 初中语文','陈老师 · 小学英语']},
   images:[
    {name:'主视觉 · 中学部教室',kind:'banner',tone:'peach',caption:'衔接班每讲配随堂测'},
    {name:'课程现场 · 几何证明',kind:'photo',tone:'peach',caption:'从画图开始学证明'}
   ]},
  {id:'l1',type:'course',title:'考研数学 · 强化提高班',merchant:'学鹭学研中心',category:'考研辅导',price:1280,unit:'16课时',icon:'📐',tone:'lavender',tag:'备考推荐',description:'高数、线代、概率三轮串讲，按题型拆解解题路径，配套每周模考与错题复盘。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:25,
   audience:['大学生'],
   address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',phone:'0451-88006600',
   learning:{kind:'ky',subject:'数学'},
   packages:[
    {name:'强化班（16课时）',price:1280,lessons:16,description:'每周两次，共 8 周'},
    {name:'强化 + 冲刺（24课时）',price:1880,lessons:24,description:'含考前冲刺与两次全真模考'}
   ],
   merchantDetail:{name:'学鹭学研中心',logo:'📐',intro:'面向考研、考公、考编的备考教学中心，按科目方向开设系统班与冲刺班。',foundYear:2014,verified:true,address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',contact:'郑老师',phone:'0451-88006600',licenses:['民办学校办学许可证'],teachers:['郑老师 · 高等数学','吴老师 · 线性代数与概率统计']},
   images:[
    {name:'主视觉 · 自习教室',kind:'banner',tone:'lavender',caption:'固定座位，晚间开放自习'},
    {name:'课程现场 · 题型串讲',kind:'photo',tone:'lavender',caption:'按题型归类，讲练结合'}
   ]},
  {id:'l2',type:'course',title:'公务员考试 · 申论系统班',merchant:'学鹭学研中心',category:'考公辅导',price:980,unit:'12课时',icon:'🖋',tone:'peach',tag:'备考推荐',description:'从材料阅读到文章结构，逐段批改申论作答，覆盖概括、分析、对策与大作文。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:30,
   audience:['大学生'],
   address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',phone:'0451-88006600',
   learning:{kind:'gwy',subject:'申论'},
   packages:[
    {name:'系统班（12课时）',price:980,lessons:12,description:'含 6 次一对一批改'},
    {name:'系统班 + 面试（20课时）',price:1680,lessons:20,description:'笔试通过后衔接结构化面试'}
   ],
   merchantDetail:{name:'学鹭学研中心',logo:'📐',intro:'面向考研、考公、考编的备考教学中心，按科目方向开设系统班与冲刺班。',foundYear:2014,verified:true,address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',contact:'郑老师',phone:'0451-88006600',licenses:['民办学校办学许可证'],teachers:['何老师 · 申论','郑老师 · 行测']},
   images:[
    {name:'主视觉 · 小班教室',kind:'banner',tone:'peach',caption:'小班授课，逐份批改'},
    {name:'课程现场 · 材料精读',kind:'photo',tone:'peach',caption:'先读材料，再定结构'}
   ]},
  {id:'l3',type:'course',title:'事业单位 · 公共基础知识精讲',merchant:'学鹭学研中心',category:'考编辅导',price:860,unit:'14课时',icon:'📘',tone:'mint',tag:'备考推荐',description:'梳理公基高频考点，按模块讲练结合，配套章节测与考点速记卡。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:28,
   audience:['大学生'],
   address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',phone:'0451-88006600',
   learning:{kind:'sb',subject:'公共基础知识'},
   packages:[
    {name:'精讲班（14课时）',price:860,lessons:14,description:'含章节测与考点速记卡'},
    {name:'精讲 + 刷题（20课时）',price:1280,lessons:20,description:'加 6 次专项刷题与讲评'}
   ],
   merchantDetail:{name:'学鹭学研中心',logo:'📐',intro:'面向考研、考公、考编的备考教学中心，按科目方向开设系统班与冲刺班。',foundYear:2014,verified:true,address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',contact:'郑老师',phone:'0451-88006600',licenses:['民办学校办学许可证'],teachers:['许老师 · 公共基础知识','何老师 · 综合应用能力']},
   images:[
    {name:'主视觉 · 讲义资料',kind:'banner',tone:'mint',caption:'按模块整理的高频考点'},
    {name:'课程现场 · 模块精讲',kind:'photo',tone:'mint',caption:'一模块一测，及时查漏'}
   ]},
  {id:'l4',type:'course',title:'公务员考试 · 行测专项突破',merchant:'学鹭学研中心',category:'考公辅导',price:1080,unit:'16课时',icon:'🧮',tone:'mint',tag:'模块精讲',description:'数量关系、资料分析、判断推理分模块突破，配套限时训练与错题归类。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:26,
   audience:['大学生'],
   address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',phone:'0451-88006600',
   learning:{kind:'gwy',subject:'行政职业能力测验'},
   packages:[
    {name:'专项班（16课时）',price:1080,lessons:16,description:'四个模块轮流精讲'},
    {name:'专项 + 刷题（24课时）',price:1580,lessons:24,description:'含 8 次限时套题训练'}
   ],
   merchantDetail:{name:'学鹭学研中心',logo:'📐',intro:'面向考研、考公、考编的备考教学中心，按科目方向开设系统班与冲刺班。',foundYear:2014,verified:true,address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',contact:'郑老师',phone:'0451-88006600',licenses:['民办学校办学许可证'],teachers:['郑老师 · 行测','何老师 · 申论']},
   images:[{name:'主视觉 · 限时训练',kind:'banner',tone:'mint',caption:'按考试节奏做套题'}]},
  {id:'l5',type:'course',title:'考研英语 · 阅读与写作提升',merchant:'学鹭学研中心',category:'考研辅导',price:1120,unit:'14课时',icon:'📕',tone:'peach',tag:'备考推荐',description:'长难句拆解、阅读题型定位与作文框架搭建，每节课配套精读与批改。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:24,
   audience:['大学生'],
   address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',phone:'0451-88006600',
   learning:{kind:'ky',subject:'英语'},
   packages:[
    {name:'提升班（14课时）',price:1120,lessons:14,description:'含 5 次作文批改'},
    {name:'提升 + 冲刺（22课时）',price:1720,lessons:22,description:'含真题精讲与考前串讲'}
   ],
   merchantDetail:{name:'学鹭学研中心',logo:'📐',intro:'面向考研、考公、考编的备考教学中心，按科目方向开设系统班与冲刺班。',foundYear:2014,verified:true,address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',contact:'郑老师',phone:'0451-88006600',licenses:['民办学校办学许可证'],teachers:['苏老师 · 考研英语']},
   images:[{name:'主视觉 · 精读课堂',kind:'banner',tone:'peach',caption:'逐句精读，练定位'}]},
  {id:'l6',type:'course',title:'考研政治 · 全程精讲',merchant:'学鹭学研中心',category:'考研辅导',price:960,unit:'12课时',icon:'📗',tone:'lavender',tag:'基础夯实',description:'马原、毛中特、史纲、思修四门课按考点串讲，配套选择题专项与背诵提纲。',location:'南岗区 · 学府路',city:'哈尔滨',remaining:32,
   audience:['大学生'],
   address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',phone:'0451-88006600',
   learning:{kind:'ky',subject:'政治'},
   packages:[
    {name:'精讲班（12课时）',price:960,lessons:12,description:'四门课考点串讲'},
    {name:'精讲 + 押题（18课时）',price:1460,lessons:18,description:'含考前时政与押题串讲'}
   ],
   merchantDetail:{name:'学鹭学研中心',logo:'📐',intro:'面向考研、考公、考编的备考教学中心，按科目方向开设系统班与冲刺班。',foundYear:2014,verified:true,address:'哈尔滨市南岗区学府路 66 号 学研大厦 5 层',contact:'郑老师',phone:'0451-88006600',licenses:['民办学校办学许可证'],teachers:['罗老师 · 考研政治']},
   images:[{name:'主视觉 · 考点串讲',kind:'banner',tone:'lavender',caption:'四门课一张知识图'}]},
  {id:'z1',type:'course',title:'教师资格证 · 笔试全程班',merchant:'职达教育',category:'职考技能',price:1280,unit:'16课时',icon:'🎓',tone:'lavender',tag:'职考推荐',description:'综合素质与教育知识能力两科串讲，配套主观题批改与考前冲刺卷。',location:'南岗区 · 红旗大街',city:'哈尔滨',remaining:30,
   audience:['大学生'],
   address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',phone:'0451-88008811',
   learning:{kind:'zk',subject:'教师资格'},
   packages:[
    {name:'全程班（16课时）',price:1280,lessons:16,description:'两科串讲，含 4 套模拟卷'},
    {name:'全程 + 面试（24课时）',price:1980,lessons:24,description:'笔试通过后衔接结构化面试'}
   ],
   merchantDetail:{name:'职达教育',logo:'🎓',intro:'面向职业资格与技能证书的培训机构，覆盖教师、财会、建工、社工与健康五大方向。',foundYear:2015,verified:true,address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',contact:'马老师',phone:'0451-88008811',licenses:['民办学校办学许可证'],teachers:['马老师 · 综合素质','钱老师 · 教育知识能力']},
   images:[{name:'主视觉 · 职考课堂',kind:'banner',tone:'lavender',caption:'按证种分班，晚班与周末班可选'}]},
  {id:'z2',type:'course',title:'初级会计 · 实务精讲',merchant:'职达教育',category:'职考技能',price:980,unit:'14课时',icon:'🧾',tone:'peach',tag:'职考推荐',description:'按章节梳理会计实务考点，配套分录练习与两套全真模拟。',location:'南岗区 · 红旗大街',city:'哈尔滨',remaining:36,
   audience:['大学生'],
   address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',phone:'0451-88008811',
   learning:{kind:'zk',subject:'会计实务'},
   packages:[
    {name:'精讲班（14课时）',price:980,lessons:14,description:'含章节练习与答疑'},
    {name:'精讲 + 冲刺（20课时）',price:1480,lessons:20,description:'加两套全真模拟与讲评'}
   ],
   merchantDetail:{name:'职达教育',logo:'🎓',intro:'面向职业资格与技能证书的培训机构，覆盖教师、财会、建工、社工与健康五大方向。',foundYear:2015,verified:true,address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',contact:'马老师',phone:'0451-88008811',licenses:['民办学校办学许可证'],teachers:['孙老师 · 会计实务','周老师 · 经济法基础']},
   images:[{name:'主视觉 · 财会教室',kind:'banner',tone:'peach',caption:'分录练习当堂批改'}]},
  {id:'z3',type:'course',title:'二级建造师 · 建筑实务',merchant:'职达教育',category:'职考技能',price:1580,unit:'20课时',icon:'🏗',tone:'mint',tag:'职考推荐',description:'施工管理与实务案例逐题拆解，配套真题精讲与考前押题串讲。',location:'南岗区 · 红旗大街',city:'哈尔滨',remaining:24,
   audience:['大学生'],
   address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',phone:'0451-88008811',
   learning:{kind:'zk',subject:'建筑工程'},
   packages:[
    {name:'实务班（20课时）',price:1580,lessons:20,description:'含真题精讲与案例批改'},
    {name:'实务 + 法规（28课时）',price:2180,lessons:28,description:'加法规与管理两科串讲'}
   ],
   merchantDetail:{name:'职达教育',logo:'🎓',intro:'面向职业资格与技能证书的培训机构，覆盖教师、财会、建工、社工与健康五大方向。',foundYear:2015,verified:true,address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',contact:'马老师',phone:'0451-88008811',licenses:['民办学校办学许可证'],teachers:['李老师 · 建筑实务','吴老师 · 法规']},
   images:[{name:'主视觉 · 案例课',kind:'banner',tone:'mint',caption:'案例题按工序拆解'}]},
  {id:'z4',type:'course',title:'社会工作者 · 初级综合能力',merchant:'职达教育',category:'职考技能',price:1180,unit:'15课时',icon:'🤝',tone:'lavender',tag:'在职可考',description:'社会工作综合能力与实务两科考点串讲，面向社区、公益与民政岗位在职备考人群。',location:'南岗区 · 红旗大街',city:'哈尔滨',remaining:28,
   audience:['大学生'],
   address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',phone:'0451-88008811',
   learning:{kind:'zk',subject:'社会工作'},
   packages:[
    {name:'基础班（15课时）',price:1180,lessons:15,description:'两科考点串讲，含章节练习'},
    {name:'基础 + 冲刺（22课时）',price:1720,lessons:22,description:'加真题精讲与主观题批改'}
   ],
   merchantDetail:{name:'职达教育',logo:'🎓',intro:'面向职业资格与技能证书的培训机构，覆盖教师、财会、建工、社工与健康五大方向。',foundYear:2015,verified:true,address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',contact:'马老师',phone:'0451-88008811',licenses:['民办学校办学许可证'],teachers:['何老师 · 综合能力','徐老师 · 社会工作实务']},
   images:[{name:'主视觉 · 社工课堂',kind:'banner',tone:'lavender',caption:'在职晚班，每周两次'}]},
  {id:'z5',type:'course',title:'健康管理师 · 三级考点精讲',merchant:'职达教育',category:'职考技能',price:1380,unit:'18课时',icon:'🩺',tone:'mint',tag:'在职可考',description:'健康监测、风险评估与干预方案三大模块精讲，配套案例题训练与考前串讲。',location:'南岗区 · 红旗大街',city:'哈尔滨',remaining:26,
   audience:['大学生'],
   address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',phone:'0451-88008811',
   learning:{kind:'zk',subject:'健康管理'},
   packages:[
    {name:'精讲班（18课时）',price:1380,lessons:18,description:'三大模块精讲，含案例训练'},
    {name:'精讲 + 押题（24课时）',price:1880,lessons:24,description:'加两套模拟卷与讲评'}
   ],
   merchantDetail:{name:'职达教育',logo:'🎓',intro:'面向职业资格与技能证书的培训机构，覆盖教师、财会、建工、社工与健康五大方向。',foundYear:2015,verified:true,address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',contact:'马老师',phone:'0451-88008811',licenses:['民办学校办学许可证'],teachers:['邹老师 · 健康监测','汤老师 · 风险评估']},
   images:[{name:'主视觉 · 健康实训室',kind:'banner',tone:'mint',caption:'案例数据当堂分析'}]},
  {id:'z6',type:'course',title:'人力资源管理师 · 三级',merchant:'职达教育',category:'职考技能',price:1080,unit:'12课时',icon:'🧑‍💼',tone:'peach',tag:'在职可考',description:'人力资源规划、招聘配置、绩效薪酬与劳动关系四模块串讲，适合转岗与在职提升。',location:'南岗区 · 红旗大街',city:'哈尔滨',remaining:32,
   audience:['大学生'],
   address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',phone:'0451-88008811',
   learning:{kind:'zk',subject:'人力资源'},
   packages:[
    {name:'精讲班（12课时）',price:1080,lessons:12,description:'四模块串讲，含计算题专练'},
    {name:'精讲 + 押题（18课时）',price:1580,lessons:18,description:'加真题精讲与考前卷'}
   ],
   merchantDetail:{name:'职达教育',logo:'🎓',intro:'面向职业资格与技能证书的培训机构，覆盖教师、财会、建工、社工与健康五大方向。',foundYear:2015,verified:true,address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',contact:'马老师',phone:'0451-88008811',licenses:['民办学校办学许可证'],teachers:['尤老师 · 绩效薪酬','施老师 · 劳动关系']},
   images:[{name:'主视觉 · 管理课堂',kind:'banner',tone:'peach',caption:'按模块拆解计算题'}]},
  {id:'z7',type:'course',title:'计算机等级考试 · 二级Office',merchant:'职达教育',category:'职考技能',price:880,unit:'10课时',icon:'💻',tone:'lavender',tag:'在线上机',description:'Word、Excel、PowerPoint 上机题专项训练，含两套全真上机模拟与逐题讲评。',location:'在线上机 · 南岗区线下答疑',city:'哈尔滨',remaining:40,
   audience:['大学生'],
   address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',phone:'0451-88008811',
   learning:{kind:'zk',subject:'计算机等级'},
   packages:[
    {name:'上机专项（10课时）',price:880,lessons:10,description:'三件套上机题逐题讲评'},
    {name:'专项 + 模拟（14课时）',price:1260,lessons:14,description:'加两套全真上机模拟'}
   ],
   merchantDetail:{name:'职达教育',logo:'🎓',intro:'面向职业资格与技能证书的培训机构，覆盖教师、财会、建工、社工与健康五大方向。',foundYear:2015,verified:true,address:'哈尔滨市南岗区红旗大街 200 号 职达大厦 6 层',contact:'马老师',phone:'0451-88008811',licenses:['民办学校办学许可证'],teachers:['梁老师 · 上机题','钟老师 · 模拟讲评']},
   images:[{name:'主视觉 · 机房',kind:'banner',tone:'lavender',caption:'一人一机，随堂提交'}]},
  {id:'t1',type:'tutor',title:'林同学 · 阅读与习惯伴学',merchant:'林同学',category:'阅读陪伴',price:120,unit:'小时',icon:'📚',tone:'lavender',tag:'伴学服务',description:'提供阅读陪伴、时间规划与习惯记录支持，不包含学科讲授、补课、考试培训或提分承诺。',location:'道里区 · 监护人确认安排',city:'哈尔滨',remaining:1,
    tutorDetail:{name:'林同学',school:'示范师范大学',major:'汉语言文学（师范）',education:'本科',subjects:['阅读陪伴','习惯培养','时间规划'],methods:['线下陪伴','线上陪伴'],experience:'两年阅读活动与习惯记录经历，累计陪伴 40 余个家庭',intro:'汉语言文学（师范）在读，习惯把一本书拆成每天读得完的小段，陪孩子做读书笔记、写阅读卡。带过 40 多个家庭的阅读计划，家长反馈最多的是“孩子愿意自己翻开书了”。',rating:{score:4.9,count:128},certificate:'未完成资质核验',grades:'须由监护人确认适用年龄'},
   calendar:{mode:'slot',slotDurationMinutes:60,slots:['周六 09:00–10:00','周六 10:00–11:00','周日 14:00–15:00'],note:'仅开放固定时段，暂不支持指定日期。'}},
  {id:'t2',type:'tutor',title:'陈同学 · 成长规划伴学',merchant:'陈同学',category:'习惯培养',price:150,unit:'小时',icon:'🌱',tone:'mint',tag:'伴学服务',description:'围绕阅读记录、日程安排和自主习惯提供陪伴支持，不开展学科教学、解题辅导或考试培训。',location:'南岗区 · 监护人确认安排',city:'哈尔滨',remaining:1,
    tutorDetail:{name:'陈同学',school:'示范理工大学',major:'应用心理学',education:'硕士',subjects:['自主习惯','阅读记录','日程安排'],methods:['线下陪伴','线上陪伴'],experience:'成长记录与活动陪伴经历，擅长与青春期孩子沟通',intro:'应用心理学硕士在读，做成长陪伴两年。会先和孩子一起把一周的日程画出来，再逐项找到能坚持的小切口，不催不逼，靠记录看到变化。',rating:{score:4.8,count:96},certificate:'未完成资质核验',grades:'须由监护人确认适用年龄'},
   calendar:{mode:'slot',slotDurationMinutes:60,slots:['周六 09:00–10:00','周六 10:00–11:00','周日 14:00–15:00'],note:'仅开放固定时段，暂不支持指定日期。'}},
  {id:'y1',type:'course',title:'美术艺考 · 素描色彩集训',merchant:'拾光艺术中心',category:'艺考课',price:4680,unit:'32课时',icon:'🖌',tone:'lavender',tag:'艺考推荐',description:'按省统考科目安排素描、色彩、速写三科集训，含每周模考与逐张讲评。',location:'道里区 · 群力大道',city:'哈尔滨',remaining:12,
   audience:['家长'],
   address:'哈尔滨市道里区群力大道 88 号 3 层',phone:'0451-88007700',
   packages:[
    {name:'统考集训（32课时）',price:4680,lessons:32,description:'素描、色彩、速写三科轮训'},
    {name:'集训 + 校考（48课时）',price:6980,lessons:48,description:'加校考方向专项与作品集指导'}
   ],
   merchantDetail:{name:'拾光艺术中心',logo:'🎨',intro:'专注 4–12 岁少儿美育的社区机构，小班教学，课程以观察力与表达力为主线。',foundYear:2016,verified:true,address:'哈尔滨市道里区群力大道 88 号 3 层',contact:'王老师',phone:'0451-88007700',licenses:['民办学校办学许可证'],teachers:['方老师 · 素描','邵老师 · 色彩']},
   images:[{name:'主视觉 · 画室',kind:'banner',tone:'lavender',caption:'一人一画架，逐张讲评'}]},
  {id:'t3',type:'tutor',title:'孙同学 · 课业伴学（大学生）',merchant:'孙同学',category:'课业伴学',price:110,unit:'小时',icon:'🧑‍🎓',tone:'peach',tag:'大学生家教',description:'在校大学生一对一带，围绕作业节奏、错题整理与学习方法提供陪伴支持，不承诺提分。',location:'南岗区 · 监护人确认安排',city:'哈尔滨',remaining:1,
    tutorDetail:{name:'孙同学',school:'示范大学',major:'数学与应用数学',education:'本科',subjects:['课业伴学','错题整理','学习方法'],methods:['线下陪伴','线上陪伴'],experience:'两年课业陪伴经历，带过初高中数学与物理',intro:'数学与应用数学专业大三在读，两年课业陪伴经历。习惯先看孩子的错题本找规律，再陪着把当天的作业节奏走顺，不代写、不超前讲。',rating:{score:4.9,count:212},certificate:'未完成资质核验',grades:'须由监护人确认适用年龄'},
   calendar:{mode:'slot',slotDurationMinutes:60,slots:['周六 09:00–10:00','周六 10:00–11:00','周日 14:00–15:00'],note:'仅开放固定时段，暂不支持指定日期。'}},
  {id:'t4',type:'tutor',title:'王同学 · 作业陪读',merchant:'王同学',category:'作业陪读',price:95,unit:'小时',icon:'✏️',tone:'mint',tag:'作业陪读',description:'陪写作业、检查完成情况与订正，帮助孩子把当天的作业节奏走顺，不做超前讲授。',location:'道里区 · 监护人确认安排',city:'哈尔滨',remaining:1,
    tutorDetail:{name:'王同学',school:'示范师范大学',major:'小学教育',education:'本科',subjects:['作业陪读','订正检查','时间管理'],methods:['线下陪伴'],experience:'作业陪读与晚辅经历，熟悉小学各年级作业量',intro:'小学教育专业在读，做过两学期晚辅。陪写作业时只做三件事：定好顺序、盯住节奏、检查订正，让孩子在固定时间内把作业收干净。',rating:{score:4.7,count:165},certificate:'未完成资质核验',grades:'须由监护人确认适用年龄'},
   calendar:{mode:'slot',slotDurationMinutes:60,slots:['周一 18:00–19:00','周三 18:00–19:00','周五 18:00–19:00'],note:'工作日固定晚时段，暂不支持指定日期。'}},
  {id:'t5',type:'tutor',title:'赵同学 · 上门伴学',merchant:'赵同学',category:'上门辅导',price:180,unit:'小时',icon:'🏠',tone:'lavender',tag:'上门伴学',description:'老师上门陪伴学习：环境布置、计划执行与作业答疑，家长可在场旁听，不开展补课式讲授。',location:'道里区 · 上门服务',city:'哈尔滨',remaining:1,
    tutorDetail:{name:'赵同学',school:'示范理工大学',major:'计算机科学与技术',education:'硕士',subjects:['上门陪伴','计划执行','作业答疑'],methods:['上门陪伴','线上陪伴'],experience:'家庭教育陪伴经历，可协助理科作业答疑',intro:'计算机硕士在读，做上门陪伴一年多。到家里先和孩子一起把书桌与计划表理清楚，再按计划陪跑，理科作业卡住时给思路不给答案。',rating:{score:4.8,count:87},certificate:'未完成资质核验',grades:'须由监护人确认适用年龄'},
   calendar:{mode:'slot',slotDurationMinutes:90,slots:['周六 15:00–16:30','周日 09:00–10:30'],note:'上门时段含路程，实际到课以确认为准。'}},
  /* ---------- 帮忙接：个人顺路代接孩子 ---------- */
  {id:'p1',type:'bus',title:'王阿姨 · 帮忙接（同小区顺路）',merchant:'王阿姨',category:'帮忙接',price:260,unit:'月',icon:'🧍‍♀️',tone:'peach',tag:'个人接送',description:'住在同一个小区，放学顺路把孩子接回来。到校门口举牌接人，接到后直接回家，不绕路、不中途停留。',location:'道里区 · 群力小区',city:'哈尔滨',remaining:3,
   pickupDetail:{person:'王晴',gender:'女',years:3,area:'群力小区',school:'群力实验小学',childGrade:'三年级',schoolGate:'东门 3 号接送点',timeText:'放学 16:20 到校门口，17:00 前送到家',seat:3,used:1,vehicle:'步行 / 电动车',idChecked:true,credit:'实名核验 · 无犯罪记录承诺',note:'同小区邻居优先，只接本小区 3 个孩子，家长可随时微信问进度。',routes:[{name:'群力实验小学',arrival:'16:20',departure:'16:35'},{name:'群力小区',arrival:'16:55',departure:'17:00'}]}},
  {id:'p2',type:'bus',title:'李叔叔 · 私家车顺路接送',merchant:'李叔叔',category:'私家车',price:380,unit:'月',icon:'🚗',tone:'mint',tag:'私家车家长',description:'自家孩子在花园小学读二年级，开车顺路带同校孩子一段。车上配儿童安全座椅，负责校门口接到并送到楼下，交接给家长或家中老人。',location:'南岗区 · 花园小区',city:'哈尔滨',remaining:2,
   pickupDetail:{person:'李建国',gender:'男',kind:'car',years:5,area:'花园小区',school:'花园小学',childGrade:'二年级',schoolGate:'北门 1 号接送点',timeText:'放学 16:30 到校门口，17:10 前送到楼下',seat:2,used:1,vehicle:'5 座轿车 · 配安全座椅',idChecked:true,credit:'实名核验 · 无犯罪记录承诺 · 驾龄 8 年',note:'每天固定接 2 个孩子，遇堵车或临时变动会提前 20 分钟在群里说。',routes:[{name:'花园小学',arrival:'16:30',departure:'16:45'},{name:'花园小区',arrival:'17:05',departure:'17:10'}]}},
  {id:'p3',type:'bus',title:'张姐 · 帮忙接（按次也接）',merchant:'张姐',category:'帮忙接',price:35,unit:'次',icon:'🧍',tone:'lavender',tag:'可临时',description:'临时代接：家长临时加班、出差或孩子值日，提前一天说一声就能接。按次结算，也能包月。',location:'哈西 · 继红小学周边',city:'哈尔滨',remaining:4,
   pickupDetail:{person:'张敏',gender:'女',years:2,area:'哈西 · 悦城',school:'继红小学',childGrade:'四年级',schoolGate:'南门接送区',timeText:'按约定时间到校门口，接到后 40 分钟内送到家',seat:4,used:0,vehicle:'电动车 / 步行',idChecked:true,credit:'实名核验 · 无犯罪记录承诺',note:'支持临时按次，提前一天预约；接到孩子先拍照发家长，再出发。',routes:[{name:'继红小学',arrival:'16:10',departure:'16:25'},{name:'哈西 · 悦城',arrival:'16:55',departure:'17:00'}]}},
  {id:'p4',type:'bus',title:'周爸爸 · 私家车顺路接送',merchant:'周爸爸',category:'私家车',price:420,unit:'月',icon:'🚙',tone:'peach',tag:'私家车家长',description:'自家孩子和顺路孩子同校不同班，每天开车接送时多带一程。行驶路线固定、不绕路，全程只在学校和小区两点往返。',location:'香坊区 · 松雷小区',city:'哈尔滨',remaining:1,
   pickupDetail:{person:'周立',gender:'男',kind:'car',years:4,area:'松雷小区',school:'松雷小学',childGrade:'五年级',schoolGate:'西门家长等候区',timeText:'早 07:40 顺路上学 · 晚 16:40 接回小区',seat:3,used:2,vehicle:'7 座 MPV · 全员安全带',idChecked:true,credit:'实名核验 · 无犯罪记录承诺 · 驾龄 11 年 · 仅两点往返',note:'只接同校孩子，接送上车先在家长群报位置；恶劣天气停接并提前通知。',routes:[{name:'松雷小学',arrival:'16:40',departure:'16:55'},{name:'松雷小区',arrival:'17:15',departure:'17:20'}]}},
  {id:'b1',type:'bus',title:'道里安心线 · 早晚接送',merchant:'安心出行',category:'校车接送',price:580,unit:'月',icon:'🚌',tone:'peach',tag:'余位可订',description:'群力小区 → 道里家园 → 示范学校。早班 07:10，晚班 16:30。固定线路，按时接送。',location:'道里区 · 固定线路',city:'哈尔滨',remaining:8,
   busDetail:{driver:'张师傅',phone:'0451-88009900',plate:'黑A·D8801',period:['月付','学期付'],vehicle:'33 座校车',
    routes:[
     {name:'群力小区',arrival:'07:10',departure:'07:12'},
     {name:'道里家园',arrival:'07:20',departure:'07:22'},
     {name:'示范学校',arrival:'07:35',departure:'16:30'}
    ]}},
  {id:'b2',type:'bus',title:'南岗阳光线 · 早晚接送',merchant:'阳光出行',category:'校车接送',price:620,unit:'月',icon:'🚐',tone:'mint',tag:'余位可订',description:'学府小区 → 哈西社区 → 示范学校。早班 07:00，晚班 16:40。固定线路，按时接送。',location:'南岗区 · 固定线路',city:'哈尔滨',remaining:6,
   busDetail:{driver:'李师傅',phone:'0451-88007700',plate:'黑A·D8802',period:['月付','学期付'],vehicle:'19 座校车',
    routes:[
     {name:'学府小区',arrival:'07:00',departure:'07:02'},
     {name:'哈西社区',arrival:'07:15',departure:'07:17'},
     {name:'示范学校',arrival:'07:32',departure:'16:40'}
    ]}}
];

const SEED_CONTENT = {
  city: '哈尔滨',
  faq: [
    {id:'f1',category:'订单',question:'下单后多久可以确认？',answer:'下单后立即生成待支付订单，点击支付即可获得核销码；商家接单后安排服务。'},
    {id:'f2',category:'课程',question:'课程名额怎么计算？',answer:'每门课程展示剩余名额，支付成功时会再次校验名额，售完即提示冲突。'},
    {id:'f3',category:'伴学',question:'伴学可以指定具体日期吗？',answer:'可以。在报名页选择日期后，仅展示与该日期星期一致的可约时段，同一时段只能成交一单。'},
    {id:'f4',category:'校车',question:'校车怎么选上车站点？',answer:'下单时依次选择上车点和下车点，下车点必须位于上车点之后的站点，价格暂按整条线路统一计价。'},
    {id:'f5',category:'账号',question:'是否可以修改孩子/监护人信息？',answer:'可以。个人中心支持修改学员、监护人、联系方式与地址。'},
    {id:'f6',category:'售后',question:'如何退款或投诉？',answer:'可在个人中心提交意见反馈，或在订单页取消待支付订单。'}
  ],
  about: {title:'学鹭伴学',slogan:'让每一份成长都有回响',intro:'学鹭伴学是一个面向家长的本地教育服务聚合平台，覆盖精品课程、优选伴学与安心校车三类服务。',description:'平台以“看得清、买得明、可核销”为目标：课程按名额报名，伴学按时段预约，校车按周期订购。',highlights:['课程、伴学、校车一站式浏览','订单状态可追溯，核销留痕','入驻申请与机构资料公开展示'],version:'V1.0',updatedAt:'2026-10'},
  contact: {company:'学鹭伴学',phone:'0451-88000000',email:'service@xuelu.example',wechat:'xuelu-service',address:'哈尔滨市道里区群力大道 88 号',hours:'周一至周五 09:00–18:00'},
  categories: [
    {id:'art',name:'艺术启蒙',type:'course'},{id:'science',name:'科学探索',type:'course'},
    {id:'sport',name:'运动成长',type:'course'},{id:'language',name:'语言表达',type:'tutor'},
    {id:'bus',name:'校车接送',type:'bus'}
  ]
};

const TUTOR_SLOTS = [...new Set(SEED_SERVICES.filter(s => s.type === 'tutor').flatMap(s => [...s.calendar.slots]))];

/* ---------------- 机构评分（口碑） ----------------
 * 综合分 0–5（一位小数），count 为评价数，dims 为四项分维度，
 * reviews 为展示用的评价样本（不含真实用户信息）。
 */
const MERCHANT_RATINGS = {
  '拾光艺术中心': {
    score: 4.8, count: 126,
    dims: { '师资': 4.9, '环境': 4.8, '课程': 4.7, '服务': 4.8 },
    reviews: [
      { user: '橙子妈妈', score: 5, date: '2026-09-18', text: '孩子从不敢下笔，到现在主动画满一整本。王老师每节课都会单独讲评，家长在旁边也能听懂。' },
      { user: '阿哲爸爸', score: 5, date: '2026-08-30', text: '画室采光很好，每班就六七个孩子，老师顾得过来。孩子回家会自己调色了。' },
      { user: '小满', score: 4, date: '2026-07-12', text: '课程很扎实，就是周末班名额有点紧，想调课得提前一周约。' }
    ]
  },
  '未来星科创': {
    score: 4.6, count: 88,
    dims: { '师资': 4.6, '环境': 4.5, '课程': 4.7, '服务': 4.5 },
    reviews: [
      { user: '豆豆妈妈', score: 5, date: '2026-09-06', text: '六个人一组，每个孩子都能上手。孩子上完课回来给我们讲循环，讲得头头是道。' },
      { user: '老周', score: 4, date: '2026-06-21', text: '器材挺新，老师是工科出身。要是能多开一节家长旁听就更好了。' }
    ]
  },
  '跃动体育': {
    score: 4.7, count: 154,
    dims: { '师资': 4.8, '环境': 4.7, '课程': 4.6, '服务': 4.7 },
    reviews: [
      { user: '球球爸爸', score: 5, date: '2026-09-24', text: '室内木地板，下雨也不用停课。教练会盯每个人的运球动作，不是只顾着比赛。' },
      { user: '一一妈妈', score: 5, date: '2026-08-11', text: '孩子原来不爱运动，现在每周自己数着日子等上课。' },
      { user: '大刘', score: 4, date: '2026-05-30', text: '训练强度合适，就是球馆停车位少了点。' }
    ]
  },
  '学鹭学研中心': {
    score: 4.5, count: 203,
    dims: { '师资': 4.6, '环境': 4.4, '课程': 4.6, '服务': 4.4 },
    reviews: [
      { user: '考研二战的小许', score: 5, date: '2026-09-15', text: '按题型归类讲得很清楚，错题复盘那套方法我一直在用。' },
      { user: '林同学', score: 4, date: '2026-08-02', text: '自习室固定座位很省心，晚上开到十点。周末人多，去晚了没位置。' }
    ]
  },
  '职达教育': {
    score: 4.6, count: 97,
    dims: { '师资': 4.5, '环境': 4.4, '课程': 4.8, '服务': 4.6 },
    reviews: [
      { user: '考证的阿May', score: 5, date: '2026-09-20', text: '教师资格证的科目二讲得很细，老师会带着刷真题，不是照本念。' },
      { user: '老陈', score: 4, date: '2026-07-28', text: '在职党友好，晚上和周末都有班。工作日白天基本没课。' }
    ]
  }
};

module.exports = { SEED_SERVICES, SEED_CONTENT, TUTOR_SLOTS, MERCHANT_RATINGS };
