/* 学鹭伴学 · 入驻申请云函数
 *
 * action:
 *   submit    提交入驻申请（机构 / 伴学 / 校车，类型由账号角色决定）
 *   mine      我的申请（只回本人的）
 *   list      平台查看全部申请（需要管理员令牌）
 *   approve   平台审批（需要管理员令牌：环境变量 ADMIN_TOKEN）
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const lib = require('./institution-lib.js');

cloud.init({ traceUser: false });
const db = cloud.database();

const PHONE = /^1\d{10}$/;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function handle(event) {
  const action = event.action;

  if (action === 'submit') {
    const user = await common.resolveUser(db, event);
    const b = {};
    for (const [k, v] of Object.entries(event)) {
      if (k === 'token' || k === 'action') continue;
      b[k] = v;
    }
    const name = text(b.name, 60), phone = text(b.phone, 20);
    if (!name || !PHONE.test(phone) || !['机构', '伴学', '校车', '接送'].includes(b.type)) common.bad('请完整填写入驻信息');
    const expected = common.applicationTypeOfRole(user.role);
    /* 私家车车主面向所有登录用户开放（必须同时接送自家孩子）；其余类型须与账号身份一致 */
    if (b.type !== '接送' && b.type !== expected) common.bad('申请类型与账号身份不一致', 403);
    if (phone !== user.phone) common.bad('申请手机号须与账号手机号一致', 403);
    const mine = await common.mineApplications(db, user);
    if (mine.some(a => a.status === 'pending')) common.bad('已有待审核的入驻申请，请等待平台审核', 409);

    /* 服务人群只对机构生效；不传按「家长」处理，兼容旧客户端 */
    const audience = b.type === '机构'
      ? (lib.normalizeAudience(b.audience) || lib.DEFAULT_AUDIENCE.slice())
      : null;

    const fields = b.type === '伴学'
      ? ['education', 'school', 'grade', 'subjects', 'resume']
      : b.type === '接送'
        ? ['area', 'school', 'childGrade', 'vehicle', 'timeText']
        : ['contact'];
    const details = {};
    if (b.type === '接送') {
      /* 私家车入驻：必须同时接送自家孩子，并同意安全承诺 */
      const seat = Number(b.seat === undefined || b.seat === null ? 0 : b.seat);
      if (!Number.isInteger(seat) || seat < 1 || seat > 6) common.bad('可接孩子数须为 1–6 的整数');
      details.seat = seat;
      const years = Number(b.years === undefined || b.years === null ? 0 : b.years);
      if (!Number.isInteger(years) || years < 0 || years > 60) common.bad('驾龄/接送年数不正确');
      details.years = years;
      if (b.safety !== true) common.bad('请先阅读并勾选安全承诺');
    }
    if (b.type === '校车') {
      for (const key of ['routeName', 'startPoint', 'endPoint']) {
        const v = typeof b[key] === 'string' ? b[key].trim() : '';
        if (!v || v.length > 100) common.bad('请填写有效的路线名称、起点和终点');
        details[key] = v;
      }
      if (!Array.isArray(b.stops) || b.stops.length > 18) common.bad('经停点最多 18 个');
      details.stops = b.stops.map(s => {
        const v = typeof s === 'string' ? s.trim() : '';
        if (!v || v.length > 100) common.bad('经停点须为 1–100 字');
        return v;
      });
      const all = [details.startPoint, ...details.stops, details.endPoint];
      if (new Set(all).size !== all.length) common.bad('起点、经停点和终点不能重复');
    }
    if (b.type === '伴学') {
      const fee = String(b.hourlyRate === undefined || b.hourlyRate === null ? '' : b.hourlyRate);
      if (!/^\d{1,5}(\.\d{1,2})?$/.test(fee) || Number(fee) <= 0 || Number(fee) > 10000) {
        common.bad('课时费须为 0.01–10000 元，最多两位小数');
      }
      details.hourlyRate = Number(fee);
      if (typeof b.photo !== 'string' || b.photo.length > 300000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(b.photo)) {
        common.bad('请上传有效的正脸照片');
      }
      details.photo = b.photo;
    }
    for (const field of fields) {
      const value = typeof b[field] === 'string' ? b[field].trim() : '';
      if (!value || value.length > (field === 'resume' ? 1000 : 100)) {
        common.bad(field === 'resume' ? '请填写 1–1000 字简历' : '请完整填写该入驻类型所需资料');
      }
      details[field] = value;
    }
    if (b.type === '伴学') {
      const gender = text(b.gender, 4);
      if (gender) {
        if (!['男', '女', '暂不填写'].includes(gender)) common.bad('请选择有效的性别');
        details.gender = gender;
      }
      for (const [key, max] of Object.entries({ major: 100, identity: 100, tags: 100, specialty: 100, experience: 500, address: 200, methods: 40 })) {
        if (b[key] === undefined || b[key] === '') continue;
        if (typeof b[key] !== 'string' || b[key].trim().length > max) common.bad('伴学补充资料格式或长度不正确');
        details[key] = b[key].trim();
      }
      if (b.birthYear !== undefined && b.birthYear !== '') {
        const year = Number(b.birthYear);
        if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) common.bad('出生年份不正确');
        details.birthYear = String(year);
      }
    }
    const id = common.newId('a');
    const application = {
      _id: id, id,
      userId: user._id, role: user.role,
      name, phone, type: b.type, ...details,
      status: 'pending', createdAt: new Date().toISOString()
    };
    if (audience) application.audience = audience;
    await db.collection('applications').add({ data: application });
    return common.ok(application);
  }

  if (action === 'mine') {
    const user = await common.resolveUser(db, event);
    const list = await common.mineApplications(db, user);
    return common.ok(list);
  }

  if (action === 'list') {
    if (!common.isAdmin(event)) return common.fail('需要平台管理员令牌', 403);
    const rows = await db.collection('applications').orderBy('createdAt', 'desc').limit(100).get();
    return common.ok(rows.data || []);
  }

  if (action === 'approve') {
    if (!common.isAdmin(event)) return common.fail('需要平台管理员令牌', 403);
    const id = text(event.id, 64);
    const found = await db.collection('applications').where({ id }).limit(1).get();
    const a = found.data && found.data[0];
    if (!a) common.bad('申请不存在', 404);
    if (a.status !== 'pending') common.bad('该申请已审核', 409);
    const patch = { status: 'approved', approvedAt: new Date().toISOString() };
    if (a.type === '机构') {
      patch.institutionName = a.institutionName || a.name;
      patch.institutionId = common.institutionIdOfName(patch.institutionName);
    }
    await db.collection('applications').doc(a._id).update({ data: patch });
    return common.ok(Object.assign({}, a, patch));
  }

  return common.fail('接口不存在', 404);
}

exports.main = async (event) => common.entry(handle, event);
