/* 考公 / 考研 / 考编 模拟数据（种子层）
   全部为演示用的模拟数据：单位、岗位、学科、分数线、竞争比均由模型按种子确定，
   与现实招录公告无关，不可用于真实报考。

   三类考试共用同一套条目结构（见 item 注释），只有标签不同：
     考公 gwy：公务员考试（国考 / 省考），满分 200（行测 + 申论），线为「进面线」
     考研 ky ：硕士研究生招生，满分 500，线为「复试线」
     考编 sb ：事业单位公开招聘，满分 100，线为「笔试合格线」*/

const {PROVINCES, universityList} = require('./gaokao-data.js');

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const KINDS = ['gwy', 'ky', 'sb'];
const EDUCATIONS = ['大专', '本科', '硕士', '博士'];
const POLITICALS = ['不限', '中共党员'];
const EXPERIENCES = ['无限制', '2 年基层工作经历'];

const KIND_META = {
  gwy: {key: 'gwy', label: '考公', sub: '公务员考试（国考 / 省考）', fullScore: 200,
    lineLabel: '进面线', unitLabel: '招录单位', quotaLabel: '招录人数', applicantLabel: '报名人数',
    itemLabel: '岗位', scoreLabel: '笔试总分（行测 + 申论）'},
  ky: {key: 'ky', label: '考研', sub: '硕士研究生招生', fullScore: 500,
    lineLabel: '复试线', unitLabel: '招生院校', quotaLabel: '拟招人数', applicantLabel: '报考人数',
    itemLabel: '专业', scoreLabel: '初试总分'},
  sb: {key: 'sb', label: '考编', sub: '事业单位公开招聘', fullScore: 100,
    lineLabel: '笔试合格线', unitLabel: '招聘单位', quotaLabel: '招聘人数', applicantLabel: '报名人数',
    itemLabel: '岗位', scoreLabel: '笔试成绩'}
};

const CAPITALS = {
  北京: '北京', 天津: '天津', 河北: '石家庄', 山西: '太原', 内蒙古: '呼和浩特', 辽宁: '沈阳',
  吉林: '长春', 黑龙江: '哈尔滨', 上海: '上海', 江苏: '南京', 浙江: '杭州', 安徽: '合肥',
  福建: '福州', 江西: '南昌', 山东: '济南', 河南: '郑州', 湖北: '武汉', 湖南: '长沙',
  广东: '广州', 广西: '南宁', 海南: '海口', 重庆: '重庆', 四川: '成都', 贵州: '贵阳',
  云南: '昆明', 西藏: '拉萨', 陕西: '西安', 甘肃: '兰州', 青海: '西宁', 宁夏: '银川', 新疆: '乌鲁木齐'
};

/* 考公：部门模板。org 里的 {city}/{province} 会在生成时替换 */
const GWY_DEPTS = [
  {name: '税务', short: 'sw', exam: '国考', org: '国家税务总局{city}市税务局', titles: ['一级行政执法员', '一级行政执法员（二）', '科员'],
   major: '财政学类、经济学类、工商管理类', edu: '本科', political: '不限'},
  {name: '海关', short: 'hg', exam: '国考', org: '{city}海关', titles: ['监管一级行政执法员', '查验科员'],
   major: '海关管理、法学类、计算机类', edu: '本科', political: '不限'},
  {name: '统计', short: 'tj', exam: '国考', org: '国家统计局{city}调查队', titles: ['一级科员', '统计调查员'],
   major: '统计学类、数学类、经济学类', edu: '本科', political: '不限'},
  {name: '气象', short: 'qx', exam: '国考', org: '{province}省{city}市气象局', titles: ['业务科员', '预报员'],
   major: '大气科学类、应用气象学', edu: '本科', political: '不限'},
  {name: '金融监管', short: 'jr', exam: '国考', org: '国家金融监督管理总局{city}监管分局', titles: ['一级科员', '监管员'],
   major: '金融学类、经济学类、会计学', edu: '本科', political: '不限'},
  {name: '铁路公安', short: 'tl', exam: '国考', org: '{city}铁路公安处', titles: ['派出所民警', '线路民警'],
   major: '法学类、公安学类', edu: '本科', political: '中共党员'},
  {name: '财政', short: 'cz', exam: '省考', org: '{province}省{city}市财政局', titles: ['一级科员', '预算科员'],
   major: '财政学类、会计学、财务管理', edu: '本科', political: '不限'},
  {name: '审计', short: 'sj', exam: '省考', org: '{province}省{city}市审计局', titles: ['审计员', '一级科员'],
   major: '审计学、会计学、财务管理', edu: '本科', political: '不限'},
  {name: '法院', short: 'fy', exam: '省考', org: '{city}市中级人民法院', titles: ['法官助理', '书记员'],
   major: '法学类', edu: '本科', political: '不限'},
  {name: '检察院', short: 'jc', exam: '省考', org: '{city}市人民检察院', titles: ['检察官助理', '书记员'],
   major: '法学类', edu: '本科', political: '中共党员'},
  {name: '市场监管', short: 'sc', exam: '省考', org: '{province}省{city}市市场监督管理局', titles: ['一级行政执法员', '综合管理岗'],
   major: '工商管理类、法学类、食品科学与工程类', edu: '本科', political: '不限'},
  {name: '公安', short: 'ga', exam: '省考', org: '{city}市公安局', titles: ['派出所民警', '网安民警'],
   major: '公安学类、法学类、计算机类', edu: '本科', political: '不限'},
  {name: '综合管理', short: 'zh', exam: '省考', org: '{province}省{city}市人民政府办公室', titles: ['综合管理岗', '一级科员'],
   major: '不限', edu: '本科', political: '不限'},
  {name: '乡镇机关', short: 'xz', exam: '省考', org: '{province}省{city}市{county}镇人民政府', titles: ['一级科员', '综合管理岗'],
   major: '不限', edu: '大专', political: '不限'}
];

/* 考编：事业单位模板 */
const SB_UNITS = [
  {name: '教育', org: '{city}市第一中学', title: '高中教师（语文）', cert: '高中教师资格证', edu: '本科', major: '中国语言文学类'},
  {name: '教育', org: '{city}市实验中学', title: '高中教师（数学）', cert: '高中教师资格证', edu: '本科', major: '数学类'},
  {name: '教育', org: '{city}市实验小学', title: '小学教师（英语）', cert: '小学教师资格证', edu: '本科', major: '外国语言文学类'},
  {name: '教育', org: '{city}市第三中学', title: '初中教师（物理）', cert: '初中教师资格证', edu: '本科', major: '物理学类'},
  {name: '医疗', org: '{city}市人民医院', title: '临床医师', cert: '执业医师资格证', edu: '硕士', major: '临床医学'},
  {name: '医疗', org: '{city}市人民医院', title: '护理岗', cert: '护士执业资格', edu: '大专', major: '护理学'},
  {name: '医疗', org: '{city}市中医院', title: '中医师', cert: '执业医师资格证', edu: '本科', major: '中医学'},
  {name: '综合', org: '{city}市政务服务中心', title: '综合管理岗', cert: '', edu: '本科', major: '不限'},
  {name: '科研', org: '{province}省{city}市农业科学研究院', title: '科研助理', cert: '', edu: '硕士', major: '农学类'},
  {name: '文化', org: '{city}市图书馆', title: '图书资料岗', cert: '', edu: '本科', major: '图书情报与档案管理类'},
  {name: '农林', org: '{city}市农业技术推广中心', title: '农技推广员', cert: '', edu: '本科', major: '植物生产类'},
  {name: '综合', org: '{city}市社会治理中心', title: '网格管理岗', cert: '', edu: '大专', major: '不限'}
];

/* 考研：一级学科（category 为门类，heat 决定分数线相对国家线的高低） */
const KY_DISCIPLINES = [
  {name: '计算机科学与技术', category: '工学', heat: 0.98, type: '理工'},
  {name: '软件工程', category: '工学', heat: 0.94, type: '理工'},
  {name: '信息与通信工程', category: '工学', heat: 0.92, type: '理工'},
  {name: '电子科学与技术', category: '工学', heat: 0.90, type: '理工'},
  {name: '控制科学与工程', category: '工学', heat: 0.88, type: '理工'},
  {name: '电气工程', category: '工学', heat: 0.90, type: '理工'},
  {name: '机械工程', category: '工学', heat: 0.82, type: '理工'},
  {name: '材料科学与工程', category: '工学', heat: 0.74, type: '理工'},
  {name: '土木工程', category: '工学', heat: 0.70, type: '理工'},
  {name: '化学工程与技术', category: '工学', heat: 0.70, type: '理工'},
  {name: '数学', category: '理学', heat: 0.84, type: '理工'},
  {name: '物理学', category: '理学', heat: 0.80, type: '理工'},
  {name: '化学', category: '理学', heat: 0.72, type: '理工'},
  {name: '生物学', category: '理学', heat: 0.72, type: '综合'},
  {name: '应用经济学', category: '经济学', heat: 0.94, type: '财经'},
  {name: '工商管理', category: '管理学', heat: 0.86, type: '财经'},
  {name: '公共管理', category: '管理学', heat: 0.78, type: '综合'},
  {name: '法学', category: '法学', heat: 0.90, type: '政法'},
  {name: '马克思主义理论', category: '法学', heat: 0.74, type: '政法'},
  {name: '新闻传播学', category: '文学', heat: 0.88, type: '综合'},
  {name: '中国语言文学', category: '文学', heat: 0.84, type: '师范'},
  {name: '外国语言文学', category: '文学', heat: 0.82, type: '语言'},
  {name: '教育学', category: '教育学', heat: 0.84, type: '师范'},
  {name: '心理学', category: '教育学', heat: 0.86, type: '师范'},
  {name: '临床医学', category: '医学', heat: 0.96, type: '医药'},
  {name: '药学', category: '医学', heat: 0.78, type: '医药'},
  {name: '农学', category: '农学', heat: 0.66, type: '农林'},
  {name: '艺术学理论', category: '艺术学', heat: 0.68, type: '艺术'}
];

/* 国家线（A 区，总分 500）按门类的基准分，年份漂移在模型里叠加 */
const KY_NATIONAL_BASE = {
  '工学': 275, '理学': 290, '经济学': 345, '管理学': 340, '法学': 320,
  '文学': 355, '教育学': 340, '医学': 300, '农学': 255, '艺术学': 350, '哲学': 295, '历史学': 320
};

/* ---------------- 备考服务推荐：机构 / 课程 / 图书 ----------------
   全部为虚构的演示内容，机构名、课程、图书都不代表真实存在。 */

const EXAM_ORGS = [
  {id: 'org-gwy-1', kind: 'gwy', name: '浙里公考教育', city: '杭州', focus: '国考 / 省考', tags: ['申论批改', '面试陪练'], intro: '专注浙江与国考方向的笔试面试一体化训练，班型以直播小班和面授集训为主。'},
  {id: 'org-gwy-2', kind: 'gwy', name: '上岸公考研究院', city: '北京', focus: '国考 · 部委岗位', tags: ['岗位匹配', '真题解析'], intro: '以国考岗位研究和真题拆解见长，课程偏重行测资料分析与申论结构。'},
  {id: 'org-gwy-3', kind: 'gwy', name: '启明申论工作室', city: '成都', focus: '申论 / 结构化面试', tags: ['人工批改', '1 对 1'], intro: '小规模申论批改工作室，按篇批改并给出逐句修改建议。'},
  {id: 'org-ky-1', kind: 'ky', name: '研途考研辅导', city: '南京', focus: '公共课全程', tags: ['英语', '数学'], intro: '公共课全科辅导，英语长难句与数学强化是主推方向。'},
  {id: 'org-ky-2', kind: 'ky', name: '启航专业课中心', city: '武汉', focus: '408 / 自命题', tags: ['专业课', '学长带学'], intro: '覆盖计算机 408 与多数自命题专业课，提供目标院校的真题与带学。'},
  {id: 'org-ky-3', kind: 'ky', name: '博雅复试工作室', city: '上海', focus: '复试 / 调剂', tags: ['面试', '口语'], intro: '专注复试面试、英语口语与调剂信息整理。'},
  {id: 'org-sb-1', kind: 'sb', name: '师路教师编辅导', city: '郑州', focus: '教师招聘', tags: ['教综', '学科知识'], intro: '面向中小学教师招聘，教综与学科专业知识双线教学。'},
  {id: 'org-sb-2', kind: 'sb', name: '医考通事业编中心', city: '西安', focus: '医疗岗', tags: ['医学基础', '面试'], intro: '医疗类事业单位考试辅导，覆盖医学基础知识与结构化面试。'},
  {id: 'org-sb-3', kind: 'sb', name: '编途面试训练营', city: '长沙', focus: '综合岗面试', tags: ['结构化', '无领导'], intro: '综合岗面试集训，结构化与无领导小组讨论轮训。'}
];

const EXAM_COURSES = [
  {id: 'c-gwy-1', kind: 'gwy', org: '浙里公考教育', name: '行测高频考点精讲', mode: '直播', hours: 48, level: '入门', price: 1280},
  {id: 'c-gwy-2', kind: 'gwy', org: '启明申论工作室', name: '申论大作文批改班', mode: '网课', hours: 24, level: '进阶', price: 880},
  {id: 'c-gwy-3', kind: 'gwy', org: '浙里公考教育', name: '省考结构化面试特训', mode: '面授', hours: 36, level: '冲刺', price: 3680},
  {id: 'c-gwy-4', kind: 'gwy', org: '上岸公考研究院', name: '资料分析速算技巧', mode: '录播', hours: 12, level: '入门', price: 299},
  {id: 'c-gwy-5', kind: 'gwy', org: '上岸公考研究院', name: '公安专业科目专项', mode: '直播', hours: 30, level: '进阶', price: 1680},
  {id: 'c-gwy-6', kind: 'gwy', org: '浙里公考教育', name: '常识判断周练计划', mode: '录播', hours: 16, level: '入门', price: 199},
  {id: 'c-ky-1', kind: 'ky', org: '研途考研辅导', name: '英语一长难句精讲', mode: '直播', hours: 60, level: '入门', price: 1980},
  {id: 'c-ky-2', kind: 'ky', org: '研途考研辅导', name: '数学一强化冲刺', mode: '面授', hours: 72, level: '冲刺', price: 3280},
  {id: 'c-ky-3', kind: 'ky', org: '启航专业课中心', name: '计算机 408 全程班', mode: '网课', hours: 120, level: '全程', price: 4580},
  {id: 'c-ky-4', kind: 'ky', org: '研途考研辅导', name: '政治时政精讲', mode: '直播', hours: 30, level: '进阶', price: 680},
  {id: 'c-ky-5', kind: 'ky', org: '启航专业课中心', name: '专业课一对一辅导', mode: '1 对 1', hours: 20, level: '定制', price: 4800},
  {id: 'c-ky-6', kind: 'ky', org: '博雅复试工作室', name: '复试面试与英语口语', mode: '面授', hours: 16, level: '冲刺', price: 1580},
  {id: 'c-sb-1', kind: 'sb', org: '师路教师编辅导', name: '教育理论综合精讲', mode: '直播', hours: 45, level: '入门', price: 1580},
  {id: 'c-sb-2', kind: 'sb', org: '师路教师编辅导', name: '学科专业知识强化', mode: '网课', hours: 36, level: '进阶', price: 1180},
  {id: 'c-sb-3', kind: 'sb', org: '编途面试训练营', name: '职业能力测验专项', mode: '直播', hours: 40, level: '进阶', price: 1380},
  {id: 'c-sb-4', kind: 'sb', org: '医考通事业编中心', name: '医学基础知识串讲', mode: '网课', hours: 30, level: '入门', price: 980},
  {id: 'c-sb-5', kind: 'sb', org: '编途面试训练营', name: '结构化面试实战', mode: '面授', hours: 24, level: '冲刺', price: 2680},
  {id: 'c-sb-6', kind: 'sb', org: '师路教师编辅导', name: '公共基础知识周练', mode: '录播', hours: 20, level: '入门', price: 299}
];

const EXAM_BOOKS = [
  {id: 'b-gwy-1', kind: 'gwy', title: '行测 5000 题（分模块版）', author: '上岸公考研究院', press: '学鹭教育出版社', price: 79, tags: ['题库', '分模块']},
  {id: 'b-gwy-2', kind: 'gwy', title: '申论范文 100 篇', author: '启明申论工作室', press: '学鹭教育出版社', price: 59, tags: ['申论', '素材']},
  {id: 'b-gwy-3', kind: 'gwy', title: '国考历年真题详解（10 年）', author: '上岸公考研究院', press: '学鹭教育出版社', price: 98, tags: ['真题', '国考']},
  {id: 'b-gwy-4', kind: 'gwy', title: '省考面试一本通', author: '浙里公考教育', press: '学鹭教育出版社', price: 68, tags: ['面试', '结构化']},
  {id: 'b-gwy-5', kind: 'gwy', title: '常识判断速记手册', author: '浙里公考教育', press: '学鹭教育出版社', price: 39, tags: ['常识', '口袋书']},
  {id: 'b-gwy-6', kind: 'gwy', title: '资料分析公式速查卡', author: '上岸公考研究院', press: '学鹭教育出版社', price: 25, tags: ['速算', '工具']},
  {id: 'b-gwy-7', kind: 'gwy', title: '公安专业科目教材', author: '浙里公考教育', press: '学鹭教育出版社', price: 88, tags: ['公安', '专业科目']},
  {id: 'b-gwy-8', kind: 'gwy', title: '申论热点素材库（年度版）', author: '启明申论工作室', press: '学鹭教育出版社', price: 65, tags: ['素材', '热点']},
  {id: 'b-ky-1', kind: 'ky', title: '考研英语真题超精读', author: '研途考研辅导', press: '学鹭教育出版社', price: 89, tags: ['英语', '真题']},
  {id: 'b-ky-2', kind: 'ky', title: '数学一复习全书', author: '研途考研辅导', press: '学鹭教育出版社', price: 108, tags: ['数学', '全书']},
  {id: 'b-ky-3', kind: 'ky', title: '政治核心考案', author: '研途考研辅导', press: '学鹭教育出版社', price: 69, tags: ['政治', '基础']},
  {id: 'b-ky-4', kind: 'ky', title: '计算机 408 真题解析', author: '启航专业课中心', press: '学鹭教育出版社', price: 95, tags: ['408', '真题']},
  {id: 'b-ky-5', kind: 'ky', title: '专业课背诵手册', author: '启航专业课中心', press: '学鹭教育出版社', price: 55, tags: ['背诵', '精简']},
  {id: 'b-ky-6', kind: 'ky', title: '考研择校指南（学科版）', author: '研途考研辅导', press: '学鹭教育出版社', price: 49, tags: ['择校', '数据']},
  {id: 'b-ky-7', kind: 'ky', title: '复试英语口语模板', author: '博雅复试工作室', press: '学鹭教育出版社', price: 45, tags: ['复试', '口语']},
  {id: 'b-ky-8', kind: 'ky', title: '考研时间管理手账', author: '研途考研辅导', press: '学鹭教育出版社', price: 35, tags: ['规划', '工具']},
  {id: 'b-sb-1', kind: 'sb', title: '教育理论基础教材', author: '师路教师编辅导', press: '学鹭教育出版社', price: 76, tags: ['教综', '教材']},
  {id: 'b-sb-2', kind: 'sb', title: '教师招聘真题汇编', author: '师路教师编辅导', press: '学鹭教育出版社', price: 88, tags: ['真题', '教师']},
  {id: 'b-sb-3', kind: 'sb', title: '职业能力测验题库', author: '编途面试训练营', press: '学鹭教育出版社', price: 72, tags: ['职测', '题库']},
  {id: 'b-sb-4', kind: 'sb', title: '公共基础知识高频考点', author: '师路教师编辅导', press: '学鹭教育出版社', price: 58, tags: ['公基', '考点']},
  {id: 'b-sb-5', kind: 'sb', title: '医学基础知识讲义', author: '医考通事业编中心', press: '学鹭教育出版社', price: 92, tags: ['医学', '讲义']},
  {id: 'b-sb-6', kind: 'sb', title: '结构化面试题库', author: '编途面试训练营', press: '学鹭教育出版社', price: 62, tags: ['面试', '题库']},
  {id: 'b-sb-7', kind: 'sb', title: '事业单位报考指南', author: '编途面试训练营', press: '学鹭教育出版社', price: 42, tags: ['报考', '指南']},
  {id: 'b-sb-8', kind: 'sb', title: '面试礼仪与表达', author: '编途面试训练营', press: '学鹭教育出版社', price: 38, tags: ['礼仪', '表达']}
];

const pick = (list, start, count) => Array.from({length: count}, (_, k) => list[(start + k) % list.length]);
const pad = n => String(n).padStart(2, '0');

/* ---------------- 条目结构 ----------------
   {id, kind, org, title, region, city, category, examType,
    quota, requirements:{education, major, political, experience, certificate, freshOnly}}
   分数线 / 报名人数 / 竞争比 由 model.mjs 按 id 确定性生成 */

function buildGwy() {
  const out = [];
  PROVINCES.forEach((pr, index) => {
    const city = CAPITALS[pr.name] || pr.name;
    const county = ['城关', '河东', '临江', '白沙'][index % 4];
    const guo = GWY_DEPTS.filter(d => d.exam === '国考');
    const sheng = GWY_DEPTS.filter(d => d.exam === '省考');
    const fill = text => text.replace('{city}', city).replace('{province}', pr.name).replace('{county}', county);
    pick(guo, index, 2).forEach((dept, k) => {
      out.push({
        id: `gwy-${pad(index)}-g${k}`, kind: 'gwy',
        org: fill(dept.org), title: dept.titles[k % dept.titles.length],
        region: pr.name, city, category: dept.name, examType: '国考',
        quota: 1 + ((index + k * 3) % 6),
        requirements: {education: dept.edu, major: dept.major, political: dept.political,
          experience: (index % 5 === 0 && k === 1) ? '2 年基层工作经历' : '无限制',
          certificate: '', freshOnly: index % 7 === 0}
      });
    });
    pick(sheng, index * 2 + 1, 2).forEach((dept, k) => {
      out.push({
        id: `gwy-${pad(index)}-s${k}`, kind: 'gwy',
        org: fill(dept.org), title: dept.titles[k % dept.titles.length],
        region: pr.name, city, category: dept.name, examType: '省考',
        quota: 1 + ((index + k * 2) % 5),
        requirements: {education: dept.edu, major: dept.major, political: dept.political,
          experience: (index % 6 === 2 && k === 0) ? '2 年基层工作经历' : '无限制',
          certificate: '', freshOnly: index % 9 === 3}
      });
    });
  });
  return out;
}

function buildSb() {
  const out = [];
  PROVINCES.forEach((pr, index) => {
    const city = CAPITALS[pr.name] || pr.name;
    pick(SB_UNITS, index * 3, 3).forEach((unit, k) => {
      out.push({
        id: `sb-${pad(index)}-${k}`, kind: 'sb',
        org: unit.org.replace('{city}', city).replace('{province}', pr.name),
        title: unit.title, region: pr.name, city, category: unit.name, examType: unit.name,
        quota: 1 + ((index + k) % 4),
        requirements: {education: unit.edu, major: unit.major, political: '不限',
          experience: '无限制', certificate: unit.cert, freshOnly: false}
      });
    });
  });
  return out;
}

function buildKy() {
  const out = [];
  const disciplines = KY_DISCIPLINES;
  universityList().forEach((uni, index) => {
    // 专科没有硕士点，直接跳过
    if (uni.tier === '专科') return;
    const affinity = disciplines.filter(d => d.type === uni.type || uni.type === '综合');
    const pool = affinity.length ? affinity : disciplines;
    const count = uni.tier === '985' ? 3 : uni.tier === '211' ? 2 : 1;
    pick(pool, index, count).forEach((d, k) => {
      const degree = (index + k) % 3 === 0 ? '专硕' : '学硕';
      out.push({
        id: `ky-${uni.id}-${k}`, kind: 'ky',
        org: uni.name, title: `${d.name}（${degree}）`,
        region: uni.province, city: uni.city, category: d.category, examType: degree,
        quota: 8 + ((index * 3 + k * 7) % 40),
        requirements: {education: '本科', major: d.name, political: '不限',
          experience: '无限制', certificate: '', freshOnly: false},
        _uni: {tier: uni.tier, alumniRank: uni.alumniRank, discipline: d.name, category: d.category, heat: d.heat}
      });
    });
  });
  return out;
}

const ITEMS = {gwy: buildGwy(), ky: buildKy(), sb: buildSb()};

function itemsOf(kind) { return ITEMS[kind] || []; }
const REGIONS = PROVINCES.map(p => p.name);
function meta() {
  const counts = {};
  for (const kind of KINDS) counts[kind] = ITEMS[kind].length;
  return {
    kinds: KINDS.map(k => KIND_META[k]),
    years: YEARS,
    regions: REGIONS,
    educations: EDUCATIONS,
    politicals: POLITICALS,
    experiences: EXPERIENCES,
    categories: {
      gwy: [...new Set(ITEMS.gwy.map(i => i.category))],
      ky: [...new Set(ITEMS.ky.map(i => i.category))],
      sb: [...new Set(ITEMS.sb.map(i => i.category))]
    },
    examTypes: {
      gwy: ['国考', '省考'],
      ky: ['学硕', '专硕'],
      sb: [...new Set(ITEMS.sb.map(i => i.examType))]
    },
    counts,
    disclaimer: ''
  };
}

module.exports = {
  YEARS,
  KINDS,
  EDUCATIONS,
  POLITICALS,
  EXPERIENCES,
  KIND_META,
  KY_NATIONAL_BASE,
  EXAM_ORGS,
  EXAM_COURSES,
  EXAM_BOOKS,
  ITEMS,
  REGIONS,
  itemsOf,
  meta
};
