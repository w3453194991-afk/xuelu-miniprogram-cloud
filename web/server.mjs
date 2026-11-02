import http from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const demoAuth=process.env.DEMO_AUTH_FILE?JSON.parse(await readFile(process.env.DEMO_AUTH_FILE,'utf8')):null;
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
await mkdir(dataDir,{recursive:true});
const dbPath = path.join(dataDir,'store.json');

/* ------------------------------------------------------------------ */
/* 内置演示服务种子（不可变）。真实目录 = 种子 + db.services 覆盖/新增  */
/* ------------------------------------------------------------------ */
const seedServices = [
  {id:'c1',type:'course',title:'创意美术 · 少儿色彩探索',merchant:'拾光艺术中心',category:'艺术启蒙',price:299,unit:'8课时',icon:'🎨',tone:'peach',tag:'人气推荐',description:'从观察到表达，让孩子用色彩讲自己的故事。小班教学，适合 6–10 岁。',location:'滨江区 · 星光大道',city:'杭州',remaining:18,
   address:'杭州市滨江区江南大道 88 号 3 层',phone:'0571-88001234',
   merchantDetail:{name:'拾光艺术中心',logo:'🎨',intro:'专注 4–12 岁少儿美育的社区机构，小班教学，课程以观察力与表达力为主线。',foundYear:2016,verified:true,address:'杭州市滨江区江南大道 88 号 3 层',contact:'王老师',phone:'0571-88001234',licenses:['民办学校办学许可证 · 演示','社会艺术水平考级报名点 · 演示'],teachers:['王老师 · 色彩/水彩','李老师 · 素描/综合材料']},
   images:[
    {name:'主视觉 · 色彩教室',kind:'banner',tone:'peach',caption:'小班画室，每班 6–8 人'},
    {name:'课程现场 · 水彩探索',kind:'photo',tone:'peach',caption:'从调色开始认识色彩'},
    {name:'作品展示 · 孩子的故事',kind:'photo',tone:'lavender',caption:'每个孩子都能讲自己的故事'}
   ]},
  {id:'c2',type:'course',title:'青少年编程 · 创造力实验室',merchant:'未来星科创',category:'科学探索',price:499,unit:'6课时',icon:'🚀',tone:'lavender',tag:'新课上线',description:'通过图形化编程和动手项目，探索逻辑与创造的乐趣。适合 8–12 岁。',location:'西湖区 · 文三路',city:'杭州',remaining:12,
   address:'杭州市西湖区文三路 199 号 6 层',phone:'0571-88005678',
   merchantDetail:{name:'未来星科创',logo:'🚀',intro:'面向 8–14 岁的科技素养机构，课程覆盖图形化编程、机器人与科学实验。',foundYear:2019,verified:true,address:'杭州市西湖区文三路 199 号 6 层',contact:'周老师',phone:'0571-88005678',licenses:['科技类校外培训机构备案 · 演示'],teachers:['周老师 · 图形化编程','孙老师 · 机器人搭建']},
   images:[
    {name:'主视觉 · 实验室',kind:'banner',tone:'lavender',caption:'六人一组，边做边学'},
    {name:'课程现场 · 图形化编程',kind:'photo',tone:'lavender',caption:'拖拽积木，理解顺序与循环'},
    {name:'课程现场 · 机器人搭建',kind:'photo',tone:'mint',caption:'把代码变成会动的小车'}
   ]},
  {id:'c3',type:'course',title:'篮球成长营 · 一起向上',merchant:'跃动体育',category:'运动成长',price:399,unit:'8课时',icon:'🏀',tone:'mint',tag:'周末好课',description:'基础运球、团队配合与体能训练，收获运动的快乐。适合 7–12 岁。',location:'滨江区 · 奥体中心',city:'杭州',remaining:20,
   address:'杭州市滨江区奥体中心体育馆 2 号馆',phone:'0571-88004321',
   merchantDetail:{name:'跃动体育',logo:'🏀',intro:'青少年篮球与体能培训机构，教练具备青少年体适能指导经验。',foundYear:2018,verified:true,address:'杭州市滨江区奥体中心体育馆 2 号馆',contact:'刘教练',phone:'0571-88004321',licenses:['体育类校外培训备案 · 演示'],teachers:['刘教练 · 基础运球','赵教练 · 体能与团队配合']},
   images:[
    {name:'主视觉 · 球馆',kind:'banner',tone:'mint',caption:'室内木地板球场，雨天照常上课'},
    {name:'课程现场 · 运球训练',kind:'photo',tone:'mint',caption:'分组练习，人人有球'},
    {name:'课程现场 · 团队对抗',kind:'photo',tone:'peach',caption:'小场对抗，学会配合'}
   ]},
  {id:'t1',type:'tutor',title:'林老师 · 英语趣味陪练',merchant:'林老师',category:'语言表达',price:120,unit:'小时',icon:'👩🏻‍🏫',tone:'lavender',tag:'已审核 · 演示',description:'英语专业毕业，擅长通过绘本与情景对话培养表达自信。演示资料，非真实教师。',location:'滨江区 · 可上门',city:'杭州',remaining:1,
   tutorDetail:{name:'林老师',school:'演示师范大学',education:'本科 · 英语（师范）',subjects:['英语','自然拼读','绘本阅读'],methods:['绘本情境对话','分级阅读陪练','口语纠音','家庭练习清单'],experience:'3 年家教陪练经验（演示资料）',certificate:'英语专业八级 · 演示',grades:'小学 1–6 年级'},
   calendar:{mode:'slot',slotDurationMinutes:60,slots:['周六 09:00–10:00','周六 10:00–11:00','周日 14:00–15:00'],note:'演示排期：仅上述固定时段可约，不支持指定日期。'}},
  {id:'t2',type:'tutor',title:'陈老师 · 科学动手课堂',merchant:'陈老师',category:'科学探索',price:150,unit:'小时',icon:'🧑🏻‍🔬',tone:'mint',tag:'已审核 · 演示',description:'用生活里的小实验激发好奇心。演示资料，非真实教师。',location:'西湖区 · 可上门',city:'杭州',remaining:1,
   tutorDetail:{name:'陈老师',school:'演示理工大学',education:'硕士 · 材料科学与工程',subjects:['科学','物理启蒙','数学思维'],methods:['家庭小实验','现象提问法','动手记录单','错题复盘'],experience:'2 年科学实验陪伴（演示资料）',certificate:'教师资格证（科学）· 演示',grades:'小学 3 年级–初中 1 年级'},
   calendar:{mode:'slot',slotDurationMinutes:60,slots:['周六 09:00–10:00','周六 10:00–11:00','周日 14:00–15:00'],note:'演示排期：仅上述固定时段可约，不支持指定日期。'}},
  {id:'b1',type:'bus',title:'滨江安心线 · 早晚接送',merchant:'安心出行',category:'校车接送',price:580,unit:'月',icon:'🚌',tone:'peach',tag:'余位可订',description:'星光小区 → 江南家园 → 示范学校。早班 07:10，晚班 16:30。仅演示线路，不提供实际运输服务。',location:'滨江区 · 固定线路',city:'杭州',remaining:8,
   busDetail:{driver:'张师傅（演示）',phone:'0571-88009900',plate:'浙A·DEMO1',period:['月付','学期付'],vehicle:'33 座校车（演示）',
    routes:[
     {name:'星光小区',arrival:'07:10',departure:'07:12'},
     {name:'江南家园',arrival:'07:20',departure:'07:22'},
     {name:'示范学校',arrival:'07:35',departure:'16:30'}
    ]}},
  {id:'b2',type:'bus',title:'西湖阳光线 · 早晚接送',merchant:'阳光出行',category:'校车接送',price:620,unit:'月',icon:'🚐',tone:'mint',tag:'余位可订',description:'文苑小区 → 翠苑社区 → 示范学校。早班 07:00，晚班 16:40。仅演示线路。',location:'西湖区 · 固定线路',city:'杭州',remaining:6,
   busDetail:{driver:'李师傅（演示）',phone:'0571-88007700',plate:'浙A·DEMO2',period:['月付','学期付'],vehicle:'19 座校车（演示）',
    routes:[
     {name:'文苑小区',arrival:'07:00',departure:'07:02'},
     {name:'翠苑社区',arrival:'07:15',departure:'07:17'},
     {name:'示范学校',arrival:'07:32',departure:'16:40'}
    ]}}
];
const TUTOR_SLOTS = [...new Set(seedServices.filter(s=>s.type==='tutor').flatMap(s=>[...s.calendar.slots]))];

/* ------------------------------------------------------------------ */
/* FAQ / 关于我们 / 联系我们 静态内容                                   */
/* ------------------------------------------------------------------ */
const content = {
  city:'杭州',
  faq:[
    {id:'f1',category:'订单',question:'下单后多久可以确认？',answer:'演示环境下单后立即生成待支付订单，点击“模拟支付”即可获得核销码；真实业务以商家确认为准。'},
    {id:'f2',category:'课程',question:'课程名额怎么计算？',answer:'每门课程展示剩余名额，支付成功时会再次校验名额，售完即提示冲突。'},
    {id:'f3',category:'家教',question:'家教可以指定具体日期吗？',answer:'暂不支持指定日期。家教仅开放服务日历中的固定时段（如周六 09:00–10:00），同一时段只能成交一单。'},
    {id:'f4',category:'校车',question:'校车怎么选上车站点？',answer:'下单时依次选择上车点和下车点，下车点必须位于上车点之后的站点，价格暂按整条线路统一计价。'},
    {id:'f5',category:'账号',question:'是否可以修改孩子/监护人信息？',answer:'可以。个人中心支持修改学员、监护人、联系方式与地址，修改后可自助将意见反馈补充到客服。'},
    {id:'f6',category:'售后',question:'如何退款或投诉？',answer:'演示环境不提供真实支付与退款。可在个人中心提交意见反馈，或在订单页取消待支付订单。'}
  ],
  about:{title:'学鹭伴学',slogan:'让每一份成长都有回响',intro:'学鹭伴学是一个面向家长的本地教育服务聚合演示平台，覆盖精品课程、优选家教与安心校车三类服务。',description:'平台以“看得清、买得明、可核销”为目标：课程按名额报名，家教按时段预约，校车按周期订购。',highlights:['课程、家教、校车一站式浏览','订单状态可追溯，核销留痕','入驻申请与机构资料公开展示'],boundaries:['演示数据，非真实商家与教师','不支持真实支付、退款与上门服务','未开放公网，请勿填写真实个人信息'],version:'V0.2 演示版',updatedAt:'2026-10'},
  contact:{company:'学鹭伴学演示团队',phone:'0571-88000000',email:'demo@shiguang.example',wechat:'shiguang-demo',address:'杭州市滨江区江南大道 88 号（演示地址）',hours:'周一至周五 09:00–18:00',note:'演示环境：所有联系方式均为占位信息，不提供真实客服。'},
  categories:[
    {id:'art',name:'艺术启蒙',type:'course'},{id:'science',name:'科学探索',type:'course'},
    {id:'sport',name:'运动成长',type:'course'},{id:'language',name:'语言表达',type:'tutor'},
    {id:'bus',name:'校车接送',type:'bus'}
  ]
};

/* ------------------------------------------------------------------ */
/* 旧数据兼容：补齐缺失的集合，不改写原有字段                            */
/* ------------------------------------------------------------------ */
function defaultProfile(){
  return {
    name:'演示家长',phone:'13800000000',address:'杭州市滨江区（演示地址）',
    students:[{name:'演示学员',age:8,gender:'未填写',guardian:'演示家长',relation:'家长',phone:'13800000000'}],
    note:'演示环境，请勿填写真实个人信息。',updatedAt:null
  };
}
function normalizeDb(raw){
  const base = (raw && typeof raw === 'object') ? raw : {};
  if(!Array.isArray(base.orders)) base.orders = [];
  if(!Array.isArray(base.applications)) base.applications = [];
  if(!Array.isArray(base.feedback)) base.feedback = [];
  if(!Array.isArray(base.services)) base.services = [];
  if(!base.profile || typeof base.profile !== 'object' || Array.isArray(base.profile)) base.profile = defaultProfile();
  if(!Array.isArray(base.profile.students)) base.profile.students = defaultProfile().students;
  return base;
}
let db;
try { db = normalizeDb(JSON.parse(await readFile(dbPath,'utf8'))); }
catch(error) { if(error.code !== 'ENOENT') throw error; db = normalizeDb({orders:[],applications:[]}); await writeFile(dbPath,JSON.stringify(db)); }
let queue = Promise.resolve();
function mutate(fn) {
  const next = queue.then(async()=>{const previous=structuredClone(db);try {const result=fn();await writeFile(dbPath,JSON.stringify(db,null,2));return result;}catch(e){db=previous;throw e;}});
  queue = next.catch(()=>{}); return next;
}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function clean(value,max=100){return typeof value==='string'?value.trim().slice(0,max):'';}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>400000)fail('请求过大',413);}try{return JSON.parse(text||'{}');}catch{fail('JSON 格式错误');}}
const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};

/* ------------------------------------------------------------------ */
/* 服务目录：种子 + db.services 覆盖，读取时总能拿到新字段               */
/* ------------------------------------------------------------------ */
const clone = v => structuredClone(v);
function validImages(v){return Array.isArray(v) && v.length<=8 && v.every(i=>i&&typeof i==='object'&&clean(i.name,60)&&['banner','photo','icon'].includes(i.kind||'photo')&&(!i.caption||clean(i.caption,120).length<=120));}
function catalog(){
  const map = new Map(seedServices.map(s=>[s.id,clone(s)]));
  for(const custom of db.services){
    if(!custom || typeof custom.id !== 'string') continue;
    if(map.has(custom.id)) map.set(custom.id,{...map.get(custom.id),...clone(custom)});
    else map.set(custom.id,{...clone(custom),builtin:false});
  }
  return [...map.values()];
}
function findService(id){return catalog().find(s=>s.id===id);}
function soldCount(serviceId){return db.orders.filter(o=>o.serviceId===serviceId&&['paid','completed'].includes(o.status)).length;}
function decorate(s){
  const used = soldCount(s.id);
  const out = {...s, remaining:Number(s.remaining||0)-used};
  if(s.type==='tutor' && !out.calendar) out.calendar = {mode:'slot',slotDurationMinutes:60,slots:[...TUTOR_SLOTS],note:'演示排期：仅上述固定时段可约，不支持指定日期。'};
  if(s.type==='bus' && !out.busDetail && Array.isArray(out.routes)) out.busDetail = {driver:out.driver,plate:out.plate,period:out.period,routes:out.routes};
  if(!out.images) out.images = [];
  return out;
}

/* ------------------------------------------------------------------ */
/* 入参校验工具                                                         */
/* ------------------------------------------------------------------ */
const PHONE = /^1\d{10}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const GENDERS = ['男','女','未填写'];
const RELATIONS = ['父亲','母亲','家长','祖父母','其他监护人'];
const PERIODS = ['月付','学期付','季付'];
function optClean(b,key,max){ // undefined 表示未提供；提供则必须是有内容的合法字符串
  if(b[key]===undefined||b[key]===null||b[key]==='') return undefined;
  const v = clean(b[key],max);
  if(!v) fail('字段格式不正确：'+key);
  return v;
}
function requireProvided(b,key,max,message){
  const v = optClean(b,key,max);
  if(v===undefined) fail(message||('缺少字段：'+key));
  return v;
}
function validDate(value){if(!DATE.test(value)) return false;const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
function timeToMinutes(t){return Number(t.slice(0,2))*60+Number(t.slice(3,5));}

/* 实际日期排期工具：一律按中国日期（Asia/Shanghai）比较，不受服务器时区影响 */
const WEEKDAYS = {周一:1,周二:2,周三:3,周四:4,周五:5,周六:6,周日:0};
const WEEKDAY_LABEL = ['周日','周一','周二','周三','周四','周五','周六'];
const CN_DATE = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
function cnToday(){return CN_DATE.format(new Date());}
function weekdayOf(date){return new Date(date+'T00:00:00Z').getUTCDay();}
function weekdayLabel(date){return WEEKDAY_LABEL[weekdayOf(date)];}
/* 时段文本的星期前缀（如「周六 09:00–10:00」）；无法识别的格式返回 null */
const WEEKDAY_PREFIX = /^(周[一二三四五六日])\s*/;
function slotWeekday(slot){const m=WEEKDAY_PREFIX.exec(typeof slot==='string'?slot:'');return m?m[1]:null;}
const SESSION_MAX = 20;

/* 家教服务日历：固定时段演示排期（不承诺真实日期） */
const SLOT_MAX = 30, SLOT_TEXT_MAX = 60, SLOT_DURATION = 60;
function validSlotText(v){return typeof v==='string' && v.length>0 && v.length<=SLOT_TEXT_MAX && v.trim()===v;}
function validateCalendar(input){
  if(!input||typeof input!=='object'||Array.isArray(input)) fail('排期格式不正确');
  for(const key of Object.keys(input)) if(!['slots','mode','slotDurationMinutes'].includes(key)) fail('不支持的排期字段：'+key);
  if(!Array.isArray(input.slots)) fail('排期时段须为字符串数组');
  if(input.slots.length<1) fail('至少需要 1 个可约时段');
  if(input.slots.length>SLOT_MAX) fail('可约时段最多 '+SLOT_MAX+' 条');
  const slots = [];
  const seen = new Set();
  for(const raw of input.slots){
    if(typeof raw!=='string') fail('排期时段须为字符串');
    if(!validSlotText(raw)) fail('时段不能为空、不含首尾空格，且每条最多 '+SLOT_TEXT_MAX+' 字');
    if(seen.has(raw)) fail('可约时段不能重复：'+raw);
    seen.add(raw); slots.push(raw);
  }
  if(input.mode!==undefined && input.mode!=='slot') fail('排期模式仅支持固定时段（slot）');
  if(input.slotDurationMinutes!==undefined && Number(input.slotDurationMinutes)!==SLOT_DURATION) fail('当前仅支持 '+SLOT_DURATION+' 分钟时长的时段');
  return {mode:'slot',slotDurationMinutes:SLOT_DURATION,slots};
}
// 服务当前对外的可约时段（缺省回落到种子演示时段）
function serviceSlots(s){return Array.isArray(s?.calendar?.slots)?s.calendar.slots:(s?.type==='tutor'?[...TUTOR_SLOTS]:[]);}
/* 订单占用的「日期+时段」：多时段订单看 sessions，旧单时段订单看 date/slot */
function orderSessions(o){
  if(Array.isArray(o.sessions)&&o.sessions.length) return o.sessions.filter(x=>x&&typeof x.date==='string'&&typeof x.slot==='string');
  if(o.type==='tutor'&&o.slot) return [{date:typeof o.date==='string'?o.date:'',slot:o.slot,legacy:!o.date}];
  return [];
}
const isActiveOrder = o=>['paid','completed'].includes(o.status);
/* 校验并归一化多时段预约（家教实际日期预约） */
function validateSessions(s,input){
  if(!Array.isArray(input)) fail('预约时段须为数组');
  if(input.length<1) fail('请至少选择 1 个预约时段');
  if(input.length>SESSION_MAX) fail('一次最多预约 '+SESSION_MAX+' 个时段');
  const available = serviceSlots(s);
  const today = cnToday();
  const seen = new Set();
  const sessions = input.map((raw,index)=>{
    const at = '第 '+(index+1)+' 个预约时段';
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) fail(at+'格式不正确');
    for(const key of Object.keys(raw)) if(!['date','slot'].includes(key)) fail(at+'不支持字段：'+key);
    const date = typeof raw.date==='string'?raw.date.trim():'';
    const slot = typeof raw.slot==='string'?raw.slot:'';
    if(!validDate(date)) fail(at+'的日期格式应为 YYYY-MM-DD 且真实存在');
    if(date<today) fail(at+'的日期已过，请选择今天或之后的日期');
    if(!slot) fail(at+'缺少时段');
    if(!available.includes(slot)) fail('请选择有效的预约时段');
    const weekday = slotWeekday(slot);
    if(!weekday) fail('该时段未配置星期，暂不支持按日期预约：'+slot);
    if(WEEKDAYS[weekday]!==weekdayOf(date)) fail(at+'的日期 '+date+' 是'+weekdayLabel(date)+'，与时段「'+slot+'」不一致');
    const key = date+'|'+slot;
    if(seen.has(key)) fail('预约时段重复：'+date+' '+slot);
    seen.add(key);
    return {date,slot};
  });
  sessions.sort((a,b)=>a.date===b.date?serviceSlots(s).indexOf(a.slot)-serviceSlots(s).indexOf(b.slot):a.date<b.date?-1:1);
  return sessions;
}
// 校验排期取值是否落在订单快照内（快照存在时以快照为准，排期改写不影响旧单）
function withinSnapshot(o,list){
  const snapshot = Array.isArray(o.slotsSnapshot)?o.slotsSnapshot:null;
  if(!snapshot) return;
  for(const item of list) if(!snapshot.includes(item.slot)) fail('该预约时段已不可用，请重新选择时段下单',409);
}
// 金额四舍五入到整数（元）
function roundAmount(n){return Math.round(n);}
const BUS_PERIOD = '月付', BUS_PERIOD_ONLY = '当前仅支持月付计价，暂不支持学期付/季付';
function effPeriod(busDetail,fallback){return Array.isArray(busDetail?.period)?busDetail.period:(Array.isArray(fallback)?fallback:[]);}

// 校车站点校验：站点必须存在于线路中，且下车点必须严格排在后面
function validateBusStop(s,course){
  const route = (s.busDetail?.routes)||s.routes||[];
  const start = optClean(course,'startPoint',60);
  const end = optClean(course,'endPoint',60);
  if(start===undefined && end===undefined) return {startPoint:'',endPoint:''};
  if(!start || !end) fail('请同时选择上车站点和下车站点');
  const names = route.map(r=>r.name);
  const i = names.indexOf(start), j = names.indexOf(end);
  if(i<0) fail('上车站点不在该线路内');
  if(j<0) fail('下车站点不在该线路内');
  if(j<=i) fail('下车站点必须位于上车站点之后');
  return {startPoint:start,endPoint:end};
}

function validateExtra(s,b){
  const out = {};
  // 监护人信息（可选）
  const guardian = optClean(b,'guardian',30);
  if(guardian!==undefined) out.guardian = guardian;
  const relation = optClean(b,'relation',20);
  if(relation!==undefined){ if(!RELATIONS.includes(relation)) fail('请选择有效的监护人关系'); out.relation = relation; }
  const phone = optClean(b,'guardianPhone',20);
  if(phone!==undefined){ if(!PHONE.test(phone)) fail('监护人手机号格式不正确'); out.guardianPhone = phone; }
  const age = b.age===undefined||b.age===null||b.age==='' ? undefined : b.age;
  if(age!==undefined){ const n=Number(age); if(!Number.isInteger(n)||n<1||n>99) fail('学员年龄须为 1–99 的整数'); out.age = n; }
  const gender = optClean(b,'gender',10);
  if(gender!==undefined){ if(!GENDERS.includes(gender)) fail('请选择有效的性别'); out.gender = gender; }
  const address = optClean(b,'address',200);
  if(address!==undefined) out.address = address;

  if(s.type==='bus'){
    const stop = validateBusStop(s,b);
    out.startPoint = stop.startPoint; out.endPoint = stop.endPoint;
    const period = optClean(b,'period',10);
    if(period!==undefined){
      if(!PERIODS.includes(period)) fail('请选择有效的订购周期');
      if(period!==BUS_PERIOD) fail(BUS_PERIOD_ONLY);
      const allowed = s.busDetail?.period||s.period||PERIODS;
      if(!allowed.includes(period)) fail('该线路不支持所选订购周期');
      out.period = period;
    }
  }
  if(s.type==='course'){
    const date = optClean(b,'date',10);
    if(date!==undefined){ if(!validDate(date)) fail('请选择有效的上课日期'); out.date = date; }
  }
  if(s.type==='tutor'){
    // 家教：旧请求仅传 slot（演示固定时段）；传 date 表示指定日期的单时段；
    // 传 sessions 即为实际日期多时段预约，由 validateSessions 统一校验
    const date = optClean(b,'date',10);
    if(date!==undefined){ if(!validDate(date)) fail('请选择有效的预约日期'); out.date = date; out.dateStatus='requested'; }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 服务管理：严格白名单                                                 */
/* ------------------------------------------------------------------ */
const TONES = ['peach','lavender','mint'];
const TYPES = ['course','tutor','bus'];
const SERVICE_EDITABLE = ['title','merchant','category','price','unit','icon','tone','tag','description','location','city','remaining'];
function normalizeServicePatch(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) fail('服务内容格式不正确');
  const allowed = new Set([...SERVICE_EDITABLE,'type','tutorDetail','busDetail','images','merchantDetail','calendar']);
  for(const key of Object.keys(raw)) if(!allowed.has(key)) fail('不支持的字段：'+key);
  const out = {};
  // type 只在创建时生效；更新时忽略，避免破坏既有订单的类型语义
  if(raw.type!==undefined && !TYPES.includes(raw.type)) fail('请选择有效的服务类型');
  for(const key of SERVICE_EDITABLE){
    if(raw[key]===undefined) continue;
    if(key==='price'){
      const n = Number(raw[key]);
      if(!Number.isFinite(n)||n<=0||n>100000) fail('价格须为 0.01–100000 元');
      out.price = Math.round(n*100)/100;
      continue;
    }
    if(key==='remaining'){
      const n = Number(raw[key]);
      if(!Number.isInteger(n)||n<0||n>10000) fail('名额须为 0–10000 的整数');
      out.remaining = n;
      continue;
    }
    if(key==='tone'){ if(!TONES.includes(raw.tone)) fail('请选择有效的配色'); out.tone=raw.tone; continue; }
    if(key==='icon'){ const v=clean(raw.icon,4); if(!v) fail('请填写图标'); out.icon=v; continue; }
    const max = key==='description'?1000:key==='title'?40:key==='city'?20:100;
    const v = clean(raw[key],max);
    if(!v) fail('请填写'+key);
    out[key] = v;
  }
  if(raw.images!==undefined){
    if(!validImages(raw.images)) fail('图片来源必须是 name + kind + tone/caption 的对象数组，最多 8 条');
    out.images = raw.images.map(i=>({name:clean(i.name,60),kind:i.kind||'photo',tone:TONES.includes(i.tone)?i.tone:'peach',caption:clean(i.caption,120)}));
  }
  if(raw.tutorDetail!==undefined){
    const t = raw.tutorDetail;
    if(!t||typeof t!=='object'||Array.isArray(t)) fail('家教资料格式不正确');
    const td = {};
    for(const key of ['name','school','education','experience','certificate','grades']){
      if(t[key]===undefined) continue;
      const v = clean(t[key],100);
      if(!v) fail('家教资料字段不能为空：'+key);
      td[key] = v;
    }
    for(const key of ['subjects','methods']){
      if(t[key]===undefined) continue;
      if(!Array.isArray(t[key])||t[key].length>10) fail('家教'+key+'须为数组，最多 10 项');
      const list = t[key].map(x=>clean(x,30));
      if(list.some(x=>!x)) fail('家教'+key+'不能包含空值');
      td[key] = list;
    }
    out.tutorDetail = td;
  }
  if(raw.busDetail!==undefined){
    const bd = raw.busDetail;
    if(!bd||typeof bd!=='object'||Array.isArray(bd)) fail('校车资料格式不正确');
    const out2 = {};
    for(const key of ['driver','plate','vehicle','phone']){
      if(bd[key]===undefined) continue;
      const v = clean(bd[key],60);
      if(!v) fail('校车资料字段不能为空：'+key);
      out2[key] = v;
    }
    if(bd.period!==undefined){
      if(!Array.isArray(bd.period)||!bd.period.length||bd.period.length>5) fail('订购周期须为 1–5 项数组');
      const list = bd.period.map(x=>clean(x,10));
      if(list.some(x=>!PERIODS.includes(x))) fail('订购周期只能为：'+PERIODS.join('、'));
      if(list.some(x=>x!==BUS_PERIOD)) fail('当前仅支持月付计价，订购周期不能包含学期付或季付');
      out2.period = [...new Set(list)];
    }
    if(bd.routes!==undefined){
      if(!Array.isArray(bd.routes)||bd.routes.length<2||bd.routes.length>20) fail('线路须为 2–20 个站点');
      const stationOf = new Map();
      const routes = bd.routes.map(r=>{
        if(!r||typeof r!=='object') fail('站点格式不正确');
        const name = clean(r.name,40), arrival=clean(r.arrival,5), departure=clean(r.departure,5);
        if(!name) fail('站点名称不能为空');
        if(stationOf.has(name)) fail('站点名称重复：'+name);
        if(!TIME.test(arrival)||!TIME.test(departure)) fail('站点到达/出发时间须为 HH:mm');
        if(timeToMinutes(departure)<timeToMinutes(arrival)) fail('站点出发时间不能早于到达时间：'+name);
        // 本站到达不得早于上一站出发
        if([...stationOf.values()].some(prev=>timeToMinutes(arrival)<timeToMinutes(prev.departure))) fail('站点到达时间不能早于上一站出发时间：'+name);
        stationOf.set(name,{arrival,departure});
        return {name,arrival,departure};
      });
      out2.routes = routes;
    }
    out.busDetail = out2;
  }
  if(raw.merchantDetail!==undefined){
    const md = raw.merchantDetail;
    if(!md||typeof md!=='object'||Array.isArray(md)) fail('机构资料格式不正确');
    const info = {};
    for(const key of ['name','logo','intro','address','contact','phone']){
      if(md[key]===undefined) continue;
      const v = clean(md[key],key==='intro'?500:100);
      if(!v) fail('机构资料字段不能为空：'+key);
      info[key] = v;
    }
    if(md.foundYear!==undefined){const y=Number(md.foundYear);if(!Number.isInteger(y)||y<1900||y>2100)fail('成立年份不合法');info.foundYear=y;}
    if(md.verified!==undefined){if(typeof md.verified!=='boolean')fail('认证状态须为布尔值');info.verified=md.verified;}
    for(const key of ['licenses','teachers']){
      if(md[key]===undefined) continue;
      if(!Array.isArray(md[key])||md[key].length>20) fail('机构'+key+'须为数组，最多 20 项');
      const list = md[key].map(x=>clean(x,100));
      if(list.some(x=>!x)) fail('机构'+key+'不能包含空值');
      info[key]=list;
    }
    out.merchantDetail = info;
  }
  if(raw.calendar!==undefined) out.calendar = validateCalendar(raw.calendar);
  return out;
}

/* 合并嵌套资料：旧数据里未被本次请求覆盖的字段原样保留 */
function createView(entry){return {...clone(entry),builtin:false};}
function mergeDetail(prev,key,patch={}){
  if(key==='images') return patch.images!==undefined ? patch.images : prev;
  const seen = prev && typeof prev==='object' && !Array.isArray(prev) ? prev : {};
  if(!patch || typeof patch!=='object' || !Object.keys(patch).length) return seen;
  const out = {...seen};
  for(const [k,v] of Object.entries(patch)){
    if(v!==null && typeof v==='object' && !Array.isArray(v) && typeof seen[k]==='object' && seen[k]!==null && !Array.isArray(seen[k])) out[k] = {...seen[k],...v};
    else out[k] = v;
  }
  return out;
}
function mergedCalendar(prev,input){
  const seen = (prev && typeof prev==='object' && !Array.isArray(prev)) ? prev : {};
  const out = {...seen};
  if(Array.isArray(seen.slots)) out.slots = [...seen.slots];
  out.mode = input.mode || seen.mode || 'slot';
  if(Number(input.slotDurationMinutes)===SLOT_DURATION) out.slotDurationMinutes = SLOT_DURATION;
  else if(seen.slotDurationMinutes!==undefined) out.slotDurationMinutes = seen.slotDurationMinutes;
  if(input.slots!==undefined) out.slots = [...input.slots];
  if(out.note===undefined) out.note = '演示排期：仅上述固定时段可约，不承诺真实日期。';
  return out;
}

const server=http.createServer(async(req,res)=>{
 if(demoAuth){const expected='Basic '+Buffer.from(demoAuth.user+':'+demoAuth.password).toString('base64');if(req.headers.authorization!==expected){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Education demo", charset="UTF-8"','Cache-Control':'no-store'});res.end('Authentication required');return;}}
 try {
  const url=new URL(req.url,'http://localhost');const p=url.pathname;
  if(p==='/api/health')return send(res,200,{ok:true,mode:'demo',city:content.city});

  /* ---------------- 服务目录 ---------------- */
  if(p==='/api/services'&&req.method==='GET')return send(res,200,catalog().map(decorate));
  if(p==='/api/services'&&req.method==='POST'){
   const raw=await body(req);
   if(!TYPES.includes(raw.type))fail('请选择有效的服务类型');
   const patch=normalizeServicePatch(raw);
   for(const key of ['title','merchant','category','price','unit']){
     if(patch[key]===undefined&&raw[key]===undefined)fail('缺少字段：'+key);
   }
   const created=await mutate(()=>{
     // 清掉更新时才可能出现的 id，防止请求体覆盖
     delete patch.id;
     const s={id:'svc-'+randomUUID().slice(0,8),...patch,type:raw.type,icon:patch.icon||'📘',tone:patch.tone||'peach',
       unit:patch.unit||(raw.type==='tutor'?'小时':raw.type==='bus'?'月':'课时'),tag:patch.tag||'自定义',
       description:patch.description||'',location:patch.location||'演示地址',city:patch.city||content.city,
       remaining:patch.remaining??(raw.type==='tutor'?1:10),builtin:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
     for(const key of ['title','merchant','category']){if(!s[key]||s[key]==='')fail('请填写'+key);}
     if(s.type==='tutor')s.calendar=patch.calendar?{...patch.calendar,note:'演示排期：仅上述固定时段可约，不承诺真实日期。'}:{mode:'slot',slotDurationMinutes:60,slots:[...TUTOR_SLOTS],note:'演示排期：仅上述固定时段可约，不支持指定日期。'};
     else if(patch.calendar) s.calendar=patch.calendar;
     db.services.push(s);return createView(s);
   });
   return send(res,201,decorate(created));
  }
  const serviceMatch=p.match(/^\/api\/services\/([^/]+)$/);
  if(serviceMatch&&req.method==='PUT'){
   const id=decodeURIComponent(serviceMatch[1]);
   const current=findService(id);if(!current)fail('服务不存在',404);
   const raw0=await body(req);
   const patch=normalizeServicePatch(raw0);
   if(patch.calendar||patch.busDetail!==undefined){
     // 以「种子 + 现有覆盖」为基准确认更新后的类型与周期状态
     const existing0=db.services.find(s=>s.id===id);
     const base0=existing0?{...clone(current),...clone(existing0),type:current.type}:clone(current);
     if(patch.calendar&&base0.type!=='tutor')fail('仅家教服务支持可约时段排期');
     if(patch.calendar&&patch.calendar.slots===undefined&&!Array.isArray(base0.calendar?.slots))fail('请至少填写 1 个可约时段');
     if(patch.busDetail&&base0.type==='bus'){
       const periods=effPeriod({...base0.busDetail,...patch.busDetail},base0.period);
       for(const period of periods) if(period!==BUS_PERIOD) fail('当前仅支持月付计价，无法保留订购周期：'+period);
     }
   }
   const updated=await mutate(()=>{
     const existing=db.services.find(s=>s.id===id);
     const base=existing?{...existing}:{type:current.type};
     // 种子服务首次被覆盖时只落库真正变化的字段，避免把种子值（含演示排期）固化成"用户数据"
     if(!existing&&raw0.calendar===undefined) base.calendar=undefined;
     const next={...base,...patch,id,updatedAt:new Date().toISOString()};
     // 嵌套资料按字段合并，避免一次局部更新抹掉旧数据里的其他字段
     if(patch.images!==undefined) next.images=mergeDetail(base.images,'images',patch);
     else if(base.images===undefined&&current.images!==undefined) next.images=clone(current.images);
     for(const key of ['tutorDetail','busDetail','merchantDetail']){
       if(patch[key]!==undefined) next[key]=mergeDetail(base[key]??current[key],key,patch[key]);
     }
     if(patch.calendar!==undefined) next.calendar=mergedCalendar(base.calendar??current.calendar,patch.calendar);
     delete next.builtin;
     if(existing)Object.assign(existing,next);else db.services.push(next);
     return existing?next:createView(next);
   });
   return send(res,200,decorate({...current,...updated}));
  }

  /* ---------------- 商家 / 内容中心 ---------------- */
  if(p==='/api/merchants'&&req.method==='GET'){
   const list=catalog();
   const byType=url.searchParams.get('type');
   const merchants=new Map();
   for(const s of list){
    if(byType&&s.type!==byType)continue;
    const name=s.merchant;
    if(!merchants.has(name))merchants.set(name,{
     id:'m-'+encodeURIComponent(name).slice(0,40),name,city:s.city||content.city,
     categories:[],types:[],intro:s.merchantDetail?.intro||'',logo:s.merchantDetail?.logo||s.icon,
     verified:s.merchantDetail?.verified??false,address:s.merchantDetail?.address||s.address||'',
     contact:s.merchantDetail?.contact||'',phone:s.merchantDetail?.phone||s.phone||'',
     foundYear:s.merchantDetail?.foundYear??null,licenses:s.merchantDetail?.licenses||[],
     teachers:s.merchantDetail?.teachers||[],serviceCount:0,services:[],minPrice:null
    });
    const m=merchants.get(name);
    if(!m.categories.includes(s.category))m.categories.push(s.category);
    if(!m.types.includes(s.type))m.types.push(s.type);
    m.serviceCount+=1;
    if(m.minPrice===null||s.price<m.minPrice)m.minPrice=s.price;
    m.services.push({id:s.id,type:s.type,title:s.title,category:s.category,price:s.price,unit:s.unit,icon:s.icon,tone:s.tone});
   }
   const data=[...merchants.values()];
   const q=clean(url.searchParams.get('q')||'',30).toLowerCase();
   return send(res,200,q?data.filter(m=>(m.name+m.intro+m.categories.join('')).toLowerCase().includes(q)):data);
  }
  if(p==='/api/content'&&req.method==='GET')return send(res,200,content);
  const contentPart=p.match(/^\/api\/content\/(faq|about|contact)$/);
  if(contentPart&&req.method==='GET')return send(res,200,content[contentPart[1]]);

  /* ---------------- 个人中心 ---------------- */
  if(p==='/api/profile'&&req.method==='GET')return send(res,200,{...db.profile,orders:db.orders.length,feedback:db.feedback.length,phone:db.profile.phone||''});
  if(p==='/api/profile'&&req.method==='PUT'){
   const b=await body(req);
   const allowed=new Set(['name','phone','address','students','note']);
   for(const key of Object.keys(b))if(!allowed.has(key))fail('不支持的字段：'+key);
   const updated=await mutate(()=>{
     const next={...db.profile};
     if(b.name!==undefined){const v=clean(b.name,30);if(!v)fail('请填写称呼');next.name=v;}
     if(b.phone!==undefined){const v=clean(b.phone,20);if(v&&!PHONE.test(v))fail('请填写有效的 11 位手机号');next.phone=v;}
     if(b.address!==undefined){const v=clean(b.address,200);if(!v)fail('请填写地址');next.address=v;}
     if(b.note!==undefined)next.note=clean(b.note,200);
     if(b.students!==undefined){
      if(!Array.isArray(b.students)||b.students.length>5)fail('学员信息须为数组，最多 5 名');
      const students=b.students.map(st=>{
       if(!st||typeof st!=='object'||Array.isArray(st))fail('学员信息格式不正确');
       const name=clean(st.name,30);if(!name)fail('请填写学员姓名');
       const item={name,age:null,gender:'未填写',guardian:'',relation:'',phone:''};
       if(st.age!==undefined&&st.age!==null&&st.age!==''){const n=Number(st.age);if(!Number.isInteger(n)||n<1||n>99)fail('学员年龄须为 1–99 的整数');item.age=n;}
       if(st.gender!==undefined){if(!GENDERS.includes(st.gender))fail('请选择有效的性别');item.gender=st.gender;}
       if(st.guardian!==undefined)item.guardian=clean(st.guardian,30);
       if(st.relation!==undefined){if(st.relation&&!RELATIONS.includes(st.relation))fail('请选择有效的监护人关系');item.relation=st.relation;}
       if(st.phone!==undefined){const v=clean(st.phone,20);if(v&&!PHONE.test(v))fail('学员监护人手机号格式不正确');item.phone=v;}
       return item;
      });
      next.students=students;
     }
     next.updatedAt=new Date().toISOString();
     db.profile=next;return next;
   });
   return send(res,200,updated);
  }

  /* ---------------- 意见反馈 ---------------- */
  if(p==='/api/feedback'&&req.method==='GET'){
   const status=url.searchParams.get('status');
   const rows=status?db.feedback.filter(f=>f.status===status):db.feedback;
   return send(res,200,rows);
  }
  if(p==='/api/feedback'&&req.method==='POST'){
   const b=await body(req);
   const allowed=new Set(['category','content','contact','orderNumber','rating']);
   for(const key of Object.keys(b))if(!allowed.has(key))fail('不支持的字段：'+key);
   const categories=['课程','家教','校车','订单','账号','其他'];
   const category=b.category===undefined?'其他':clean(b.category,10);
   if(!categories.includes(category))fail('请选择有效的反馈类型');
   const text=clean(b.content,500);
   if(text.length<5)fail('反馈内容请填写 5–500 字');
   if(text.length>500)fail('反馈内容请填写 5–500 字');
   const contact=clean(b.contact,60);
   if(contact&&!PHONE.test(contact)&&!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(contact))fail('联系方式须为手机号或邮箱');
   const orderNumber=clean(b.orderNumber,30);
   if(orderNumber&&!db.orders.some(o=>o.number===orderNumber))fail('订单号不存在',404);
   let rating=null;
   if(b.rating!==undefined&&b.rating!==null&&b.rating!==''){const n=Number(b.rating);if(!Number.isInteger(n)||n<1||n>5)fail('评分须为 1–5');rating=n;}
   const item=await mutate(()=>{
    const f={id:randomUUID(),category,content:text,contact,orderNumber,rating,
      contactName:db.profile.name||'',status:'pending',reply:'',createdAt:new Date().toISOString()};
    db.feedback.unshift(f);return f;
   });
   return send(res,201,item);
  }

  /* ---------------- 订单 ---------------- */
  if(p==='/api/orders'&&req.method==='GET')return send(res,200,db.orders);
  if(p==='/api/orders'&&req.method==='POST'){
   const b=await body(req);const s=findService(b.serviceId);if(!s)fail('服务不存在',404);
   const student=clean(b.student,30),phone=clean(b.phone,20),slot=clean(b.slot,60);
   if(!student||!PHONE.test(phone))fail('请填写学生姓名和有效的 11 位手机号');
   const slots=serviceSlots(s);
   const multi = b.sessions!==undefined;
   if(multi&&s.type!=='tutor')fail('仅家教服务支持按日期多时段预约');
   // 多时段预约：同时传 slot 会与 sessions 口径冲突，直接拒绝
   if(multi&&b.slot!==undefined)fail('多时段预约请通过 sessions 提交时段，不要同时传 slot');
   const sessions = multi?validateSessions(s,b.sessions):null;
   // 旧口径：固定时段（可选带日期）
   if(!multi&&s.type==='tutor'){
     if(!slots.includes(slot))fail('请选择有效的预约时段');
     if(b.date!==undefined&&b.date!==null&&b.date!==''){
       const weekday=slotWeekday(slot);
       if(!weekday)fail('该时段未配置星期，暂不支持按日期预约：'+slot);
       const day=clean(b.date,10);
       if(validDate(day)&&day>cnToday()&&WEEKDAYS[weekday]!==weekdayOf(day))fail('预约日期与所选时段的星期不一致');
     }
   }
   const extra=validateExtra(s,b);
   const order=await mutate(()=>{const o={id:randomUUID(),number:'ED'+Date.now(),serviceId:s.id,title:s.title,type:s.type,student,phone,
     slot:s.type==='tutor'&&!multi?slot:'',amount:s.price,status:'pending',createdAt:new Date().toISOString(),...extra};
    // 记录创建时的排期与订购周期快照：后续改排期不影响已创建订单的校验口径
    if(s.type==='tutor')o.slotsSnapshot=[...slots];
    if(s.type==='bus')o.busPeriodSnapshot=Array.isArray(s.busDetail?.period)?[...s.busDetail.period]:(Array.isArray(s.period)?[...s.period]:[]);
    if(multi){
      // 实际日期多时段：固定 1 小时 / 段，金额按段数计算；slot 留空，日期口径以 sessions 为准
      const unitPrice=s.price;
      o.dateStatus='scheduled';
      o.sessions=sessions.map(x=>({date:x.date,slot:x.slot}));
      o.hours=sessions.length*SLOT_DURATION/60;
      o.unitPrice=unitPrice;
      o.amount=roundAmount(unitPrice*o.sessions.length);
      delete o.date;
    }
    db.orders.unshift(o);return o;});
   return send(res,201,order);
  }
  const availability=p.match(/^\/api\/services\/([^/]+)\/availability$/);
  if(availability&&req.method==='GET'){
   const id=decodeURIComponent(availability[1]);const s=findService(id);if(!s)fail('服务不存在',404);
   if(s.type!=='tutor')fail('仅家教服务支持按日期查询可约时段');
   const date=clean(url.searchParams.get('date')||'',10);
   if(!date)fail('请提供查询日期 date=YYYY-MM-DD');
   if(!validDate(date))fail('日期格式应为 YYYY-MM-DD 且真实存在');
   const weekday=weekdayLabel(date);
   // 只返回星期配置与当天一致的时段；已支付/已完成订单占用的时段不可约
   const taken=new Set();
   for(const o of db.orders){
     if(o.serviceId!==s.id||!isActiveOrder(o))continue;
     for(const item of orderSessions(o))if(item.date===date)taken.add(item.slot);
   }
   const list=serviceSlots(s).filter(slot=>slotWeekday(slot)===weekday);
   return send(res,200,{date,slots:list.map(slot=>({slot,available:!taken.has(slot)}))});
  }
  const match=p.match(/^\/api\/orders\/([^/]+)\/(pay|complete|cancel)$/);
  if(match&&req.method==='POST'){
   const order=await mutate(()=>{const o=db.orders.find(x=>x.id===match[1]);if(!o)fail('订单不存在',404);const action=match[2];
    const s=findService(o.serviceId);
    // 旧数据兼容：服务已下线时不允许再变更状态，避免崩溃
    if(!s&&action==='pay')fail('服务已下架，无法支付',409);
    if(!s&&action==='cancel'&&o.status==='pending'){o.status='cancelled';return o;}
    if(action==='pay'){if(o.status!=='pending')fail('仅待支付订单可以支付',409);
     const sessions=orderSessions(o);
     // 仅当订单带有创建时的时段快照才按快照重新校验；历史订单不受排期变更影响
     if(o.type==='tutor'&&sessions.length)withinSnapshot(o,sessions);
     const active=db.orders.filter(x=>x.serviceId===o.serviceId&&x.id!==o.id&&isActiveOrder(x));
     if(s.type==='tutor'){
       // 按 serviceId/date/slot 查重：整单所有时段都要可约，否则整单拒绝（全部成功或全部拒绝）
       const taken=new Set();
       for(const x of active)for(const item of orderSessions(x)){
         // 无日期的旧时段订单只与本单中同为无日期的时段冲突，不阻断所有真实日期
         taken.add((item.date||'*')+'|'+item.slot);
       }
       for(const item of sessions){
         if(taken.has((item.date||'*')+'|'+item.slot)||(!item.date&&taken.has('*|'+item.slot)))
           fail('当前名额或预约时段已售出',409);
       }
     }
     if(s.type!=='tutor'&&active.length>=s.remaining)fail('当前名额或预约时段已售出',409);
     o.status='paid';o.code=randomUUID().slice(0,8).toUpperCase();}
    if(action==='complete'){if(o.status!=='paid')fail('仅已支付订单可以核销',409);o.status='completed';}
    if(action==='cancel'){if(o.status!=='pending')fail('仅待支付订单可以取消',409);o.status='cancelled';}return o;});return send(res,200,order);
  }

  /* ---------------- 入驻申请 ---------------- */
  if(p==='/api/applications'&&req.method==='GET')return send(res,200,db.applications);
  if(p==='/api/applications'&&req.method==='POST'){
   const b=await body(req);const name=clean(b.name,60),phone=clean(b.phone,20);if(!name||!/^1\d{10}$/.test(phone)||!['机构','家教','校车'].includes(b.type))fail('请完整填写入驻信息');
   const fields=b.type==='家教'?['education','school','grade','subjects','resume']:['contact'];
   const details={};
   if(b.type==='家教'){
    const fee=String(b.hourlyRate??'');if(!/^\d{1,5}(\.\d{1,2})?$/.test(fee)||Number(fee)<=0||Number(fee)>10000)fail('课时费须为 0.01–10000 元，最多两位小数');
    details.hourlyRate=Number(fee);
    if(typeof b.photo!=='string'||b.photo.length>300000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(b.photo))fail('请上传有效的正脸照片');
    const image=Buffer.from(b.photo.split(',')[1],'base64');if(image[0]!==255||image[1]!==216||image[2]!==255)fail('照片格式不正确');details.photo=b.photo;
   }
   for(const field of fields){const value=typeof b[field]==='string'?b[field].trim():'';if(!value||value.length>(field==='resume'?1000:100))fail(field==='resume'?'请填写 1–1000 字简历':'请完整填写该入驻类型所需资料');details[field]=value;}
   return send(res,201,await mutate(()=>{const a={id:randomUUID(),name,phone,type:b.type,...details,status:'pending',createdAt:new Date().toISOString()};db.applications.unshift(a);return a;}));
  }
  const application=p.match(/^\/api\/applications\/([^/]+)\/approve$/);
  if(application&&req.method==='POST')return send(res,200,await mutate(()=>{const a=db.applications.find(x=>x.id===application[1]);if(!a)fail('申请不存在',404);if(a.status!=='pending')fail('该申请已审核',409);a.status='approved';return a;}));

  if(p.startsWith('/api/'))return send(res,404,{error:'接口不存在'});
  if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'方法不支持'});
  const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/join.css':'join.css','/site.js':'site.js','/site.css':'site.css','/manage.js':'manage.js','/manage.css':'manage.css','/mobile.js':'mobile.js','/mobile.css':'mobile.css','/booking.js':'booking.js','/booking.css':'booking.css','/search-history.js':'search-history.js'};
  const file=files[p];if(!file)return send(res,404,{error:'页面不存在'});
  const payload=await readFile(path.join(root,'public',file));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(payload);
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'服务器暂时不可用'});}
});
server.listen(Number(process.env.PORT||3100),'127.0.0.1',()=>console.log('Education demo: http://127.0.0.1:'+(process.env.PORT||3100)));
