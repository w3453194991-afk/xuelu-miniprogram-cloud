/* 学鹭伴学 · 机构云函数
 *
 * action:
 *   list    机构目录（机构账号只看自己绑定的那一家）
 *   detail  机构主页（环境图 / 课程 / 教师介绍 / 价格区间）
 *   get     机构详情
 *   update  修改机构资料（仅已审核通过的机构账号，只能改自己那家）
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const lib = require('./institution-lib.js');
const { SEED_SERVICES } = require('./seed-data.js');

cloud.init({ traceUser: false });
const db = cloud.database();

function catalog(dbRows) {
  const map = new Map(SEED_SERVICES.map(s => [s.id, lib.clone(s)]));
  for (const custom of Array.isArray(dbRows) ? dbRows : []) {
    if (!custom || typeof custom.id !== 'string') continue;
    if (map.has(custom.id)) map.set(custom.id, Object.assign({}, map.get(custom.id), lib.clone(custom)));
    else map.set(custom.id, Object.assign({}, lib.clone(custom), { builtin: false }));
  }
  return [...map.values()];
}

async function institutionsOf() {
  const services = catalog((await db.collection('services').get()).data || []);
  const overrides = (await db.collection('institutions').get()).data || [];
  const approved = await common.approvedInstitutions(db);
  return lib.buildInstitutions(services, overrides, approved);
}

/* 机构主页要同时拿到机构目录与完整课程（环境图 / 师资 / 资质都在课程里） */
async function institutionsWithCatalog() {
  const services = catalog((await db.collection('services').get()).data || []);
  const overrides = (await db.collection('institutions').get()).data || [];
  const approved = await common.approvedInstitutions(db);
  return { services, items: lib.buildInstitutions(services, overrides, approved) };
}

function institutionView(item) {
  const audience = lib.audienceOf(item.audience) || lib.DEFAULT_AUDIENCE.slice();
  return {
    id: item.id, name: item.name, intro: item.intro, address: item.address,
    contact: item.contact, phone: item.phone, courseCount: item.courseCount,
    audience, audienceText: audience.join(' / '),
    courses: (item.courses || []).map(c => ({
      id: c.id, title: c.title, price: c.price,
      packageCount: Array.isArray(c.packages) ? c.packages.length : 0
    })),
    source: item.source, updatedAt: item.updatedAt || null
  };
}

/* 机构账号的绑定：已通过 + 机构类申请 */
async function institutionBinding(user) {
  if (!user || user.role !== 'institution') return null;
  const application = await common.latestApplication(db, user);
  if (!application || application.status !== 'approved') return null;
  const boundId = await common.institutionIdOfUser(db, user);
  if (!boundId) return null;
  return { institutionId: boundId, name: application.institutionName || application.name };
}

async function handle(event) {
  const action = event.action;

  if (action === 'list') {
    const user = await common.optionalUser(db, event);
    let items = await institutionsOf();
    if (user && user.role === 'institution') {
      const bound = await common.institutionIdOfUser(db, user);
      items = items.filter(i => i.id === bound);
    } else {
      /* 机构目录属于家长端，只展示对家长开放的机构 */
      items = items.filter(i => lib.parentAudience(i.audience));
    }
    return common.ok(items.map(institutionView));
  }

  if (action === 'get') {
    const id = lib.str(event.id, 64);
    const user = await common.optionalUser(db, event);
    if (user && user.role === 'institution') {
      const bound = await common.institutionIdOfUser(db, user);
      if (!bound) common.bad('账号尚未绑定机构，请先完成入驻审核', 403);
      if (bound !== id) common.bad('无权访问其他机构资料', 403);
    }
    const item = (await institutionsOf()).find(i => i.id === id);
    if (!item) common.bad('机构不存在', 404);
    return common.ok(institutionView(item));
  }

  if (action === 'detail') {
    const id = lib.str(event.id, 64);
    const name = lib.str(event.name, 60);
    if (!id && !name) common.bad('请提供机构 id 或名称');
    const user = await common.optionalUser(db, event);
    if (user && user.role === 'institution') {
      const bound = await common.institutionIdOfUser(db, user);
      if (!bound) common.bad('账号尚未绑定机构，请先完成入驻审核', 403);
      if (id && bound !== id) common.bad('无权访问其他机构资料', 403);
    }
    const { services, items } = await institutionsWithCatalog();
    const item = items.find(i => (id && i.id === id) || (!id && name && i.name === name));
    if (!item) common.bad('机构不存在', 404);
    return common.ok(lib.institutionDetailView(item, services));
  }

  if (action === 'update') {
    const user = await common.resolveUser(db, event);
    const binding = await institutionBinding(user);
    if (!binding) common.bad('仅已审核通过的机构账号可以修改机构资料', 403);
    const id = lib.str(event.id, 64);
    if (binding.institutionId !== id) common.bad('只能修改自己所属的机构资料', 403);
    const current = (await institutionsOf()).find(i => i.id === id);
    if (!current) common.bad('机构不存在', 404);
    if (event.name !== undefined && lib.str(event.name, 60) !== current.name) common.bad(lib.INSTITUTION_NAME_FIXED);
    const raw = {};
    for (const [k, v] of Object.entries(event)) {
      if (k === 'token' || k === 'action' || k === 'id') continue;
      raw[k] = v;
    }
    const patch = lib.normalizeInstitutionPatch(raw, current.name);
    const found = await db.collection('institutions').where({ id }).limit(1).get();
    const row = found.data && found.data[0];
    const updatedAt = new Date().toISOString();
    if (row) {
      await db.collection('institutions').doc(row._id).update({
        data: Object.assign({ name: current.name }, patch, { updatedAt })
      });
    } else {
      await db.collection('institutions').add({
        data: { _id: id, id, name: current.name, ...patch, updatedAt }
      });
    }
    const item = (await institutionsOf()).find(i => i.id === id);
    return common.ok(institutionView(item));
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
