/* 学鹭伴学 · 学习资源云函数
 *
 * action:
 *   resources   已审核机构发布、且标注考试方向（learning）的课程目录
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const lib = require('./institution-lib.js');
const { SEED_SERVICES } = require('./seed-data.js');

cloud.init({ traceUser: false });
const db = cloud.database();

const LEARNING_KINDS = [
  { id: 'gwy', name: '考公', subjects: ['行政职业能力测验', '申论', '面试'] },
  { id: 'ky', name: '考研', subjects: ['政治', '英语', '数学', '专业课'] },
  { id: 'sb', name: '考编', subjects: ['公共基础知识', '职业能力测验', '综合应用能力', '面试'] },
  { id: 'zk', name: '职考技能', subjects: ['教师资格', '会计实务', '建筑工程', '社会工作', '健康管理', '人力资源', '计算机等级'] }
];
/* 机构选了「大学生」但课程没选考试方向时归到这里 */
const OTHER_KIND = { id: 'other', name: '其他课程', subjects: ['通用课程'] };
const ALL_LEARNING_KINDS = LEARNING_KINDS.concat([OTHER_KIND]);

function catalog(dbRows) {
  const map = new Map(SEED_SERVICES.map(s => [s.id, lib.clone(s)]));
  for (const custom of Array.isArray(dbRows) ? dbRows : []) {
    if (!custom || typeof custom.id !== 'string') continue;
    if (map.has(custom.id)) map.set(custom.id, Object.assign({}, map.get(custom.id), lib.clone(custom)));
    else map.set(custom.id, Object.assign({}, lib.clone(custom), { builtin: false }));
  }
  return [...map.values()];
}

/* 服务人群决定归属：只开给家长的机构课程不进大学生页面；
   选了「大学生」但没设考试方向的课程归到「其他课程」。 */
function learningResources(services, institutions, approvedNames) {
  const verified = new Set((approvedNames || []).map(name => String(name).trim()).filter(Boolean));
  const official = new Set(SEED_SERVICES.map(item => item.id));
  const out = [];
  for (const service of services) {
    const name = typeof service.merchant === 'string' ? service.merchant.trim() : '';
    const trusted = verified.has(name) || official.has(service.id);
    if (service.type !== 'course' || !trusted) continue;
    const institution = institutions.find(item => item.name === name) || {};
    const audience = Array.isArray(institution.audience) ? institution.audience : null;
    if (audience && !audience.includes('大学生')) continue;
    const raw = service.learning;
    const kind = raw ? LEARNING_KINDS.find(k => k.id === raw.kind) : null;
    const learning = kind && kind.subjects.includes(raw.subject) ? raw : null;
    if (!learning && !audience) continue;
    const found = learning ? kind : OTHER_KIND;
    out.push({
      id: service.id, title: service.title, merchant: name,
      kind: found.id, kindName: found.name,
      subject: learning ? learning.subject : OTHER_KIND.subjects[0],
      category: service.category || '', description: service.description || '',
      price: service.price, unit: service.unit, location: service.location || '',
      icon: service.icon || '📚', tone: service.tone || 'mint',
      packages: Array.isArray(service.packages) ? service.packages.length : 0,
      institution: { name, address: institution.address || '', intro: institution.intro || '' }
    });
  }
  return out;
}

async function handle(event) {
  const services = catalog((await db.collection('services').get()).data || []);
  const overrides = (await db.collection('institutions').get()).data || [];
  const approved = await common.approvedInstitutions(db);
  const institutions = lib.buildInstitutions(services, overrides, approved);
  const approvedNames = approved.map(a => a.name);

  const all = learningResources(services, institutions, approvedNames);
  /* 「其他课程」只在确有这类课程时出现 */
  const kinds = all.some(i => i.kind === OTHER_KIND.id) ? ALL_LEARNING_KINDS : LEARNING_KINDS;
  const kind = lib.str(event.kind, 10);
  const subject = lib.str(event.subject, 30);
  let items = all;
  if (kind) items = items.filter(i => i.kind === kind);
  if (subject) items = items.filter(i => i.subject === subject);

  const chosen = kinds.find(k => k.id === kind) || kinds[0];
  return common.ok({
    kinds: kinds.map(row => ({ id: row.id, name: row.name, subjects: [...row.subjects] })),
    kind: chosen.id, kindName: chosen.name, subjects: [...chosen.subjects],
    subject: chosen.subjects.includes(subject) ? subject : chosen.subjects[0],
    items
  });
}

exports.main = async (event) => common.entry(handle, event);
