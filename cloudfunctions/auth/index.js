/* 学鹭伴学 · 账号与会话云函数
 *
 * action:
 *   wxLogin          微信静默登录（openid 已绑定账号时直接发令牌）
 *   register         手机号 + 密码注册（家长 / 大学生 / 机构）
 *   login            手机号 + 密码登录
 *   me               用令牌换当前会话
 *   logout           注销令牌
 *
 * 口令：scrypt(N=16384,r=8,p=1) + 16 字节随机盐，存 "<salt>:<hash>"。
 * 会话：云数据库 sessions 集合，只存 sha256 摘要 + 过期时间，12 小时空闲失效。
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');

cloud.init({ traceUser: false });
const db = cloud.database();

async function wxContext() {
  try { return cloud.getWXContext(); } catch (e) { return {}; }
}

async function handle(event) {
  const action = event.action;
  const ctx = await wxContext();
  const openid = ctx.OPENID || '';

  if (action === 'wxLogin') {
    if (!openid) return common.fail('无法获取微信身份，请在真机或开发者工具中运行', 400);
    const found = await db.collection('users').where({ openid }).limit(1).get();
    const user = found.data && found.data[0];
    if (!user) return common.ok({ authenticated: false, needLogin: true });
    const token = await common.issueSession(db, user._id);
    return common.ok({
      authenticated: true,
      user: publicUser(user),
      token,
      application: await applicationBrief(db, user),
      institutionId: await common.institutionIdOfUser(db, user)
    });
  }

  if (action === 'register') {
    const phone = common.requirePhone(event.phone, '手机号');
    const password = common.requirePassword(event.password);
    const role = common.requireRole(event.role);
    const exists = await db.collection('users').where({ phone }).limit(1).get();
    if (exists.data && exists.data.length) return common.fail('该手机号已注册，请直接登录', 409);
    const id = common.newId('u');
    await db.collection('users').add({
      _id: id,
      data: {
        phone,
        role,
        openid,
        passwordHash: await common.hashPassword(password),
        createdAt: new Date().toISOString()
      }
    });
    const token = await common.issueSession(db, id);
    return common.ok({ user: { id, phone, role }, token });
  }

  if (action === 'login') {
    const phone = common.requirePhone(event.phone, '手机号');
    const password = typeof event.password === 'string' ? event.password : '';
    const found = await db.collection('users').where({ phone }).limit(1).get();
    const user = found.data && found.data[0];
    const okVerify = user
      ? await common.verifyPassword(password, user.passwordHash)
      : (await common.burnPasswordCheck(password), false);
    if (!okVerify) return common.fail('手机号或密码不正确', 401);
    /* 登录成功把 openid 绑到账号，之后可微信静默登录 */
    if (openid && user.openid !== openid) {
      await db.collection('users').doc(user._id).update({ data: { openid } }).catch(() => {});
    }
    const token = await common.issueSession(db, user._id);
    return common.ok({
      user: publicUser(user),
      token,
      application: await applicationBrief(db, user),
      institutionId: await common.institutionIdOfUser(db, user)
    });
  }

  if (action === 'me') {
    const user = await common.resolveUser(db, event);
    return common.ok({
      authenticated: true,
      user: publicUser(user),
      application: await applicationBrief(db, user),
      institutionId: await common.institutionIdOfUser(db, user)
    });
  }

  if (action === 'logout') {
    await common.revokeSession(db, event.token);
    return common.ok({ ok: true });
  }

  return common.fail('接口不存在', 404);
}

function publicUser(user) {
  return { id: user._id, phone: user.phone, role: user.role };
}

async function applicationBrief(db, user) {
  const a = await common.latestApplication(db, user);
  if (!a) return null;
  return { id: a._id, status: a.status, name: a.name, type: a.type };
}

exports.main = async (event) => common.entry(handle, event);
