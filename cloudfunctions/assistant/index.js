/* 学鹭助手 · AI 对话云函数
 *
 * 只有在云开发环境配置了 DEEPSEEK_API_KEY 时才启用大模型对话；
 * 没配置时返回 NO_KEY，小程序端会自动改用内置问答，界面不出现任何报错。
 *
 * action:
 *   status  返回是否已配置（不返回 Key 本身）
 *   chat    转发问题到 DeepSeek，解析 [PAGE:xxx] 标记
 */

const https = require('https');
const cloud = require('wx-server-sdk');

cloud.init({ traceUser: false });

const API_HOST = 'api.deepseek.com';
const API_PATH = '/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

const SYSTEM = `你是「学鹭伴学」小程序里的客服助手，自称「鹭鹭」。说话风格：
- 像一位耐心的前台老师：先接住问题，再给一句能马上照做的答案。
- 简体中文、口语化，通常 60–120 字，最多分 3 点；不用 Markdown 标题、不用「首先其次最后」这类腔调。
- 称呼对方为「您」，提到平台时说「学鹭伴学」或「我们这儿」。
- 不吹嘘、不承诺。涉及钱和个人信息时，把规则讲清楚。
- 不知道就说不知道，并给一条去哪个页面自己看的建议。

小程序的页面：
- 首页(index)：精品课程、优选伴学、接送板块、机构目录、搜索
- 接送板块(transport)：固定线路校车、个人帮忙接、私家车顺路（须同时接送自家孩子的家长）
- 学习(learning)：学习资源（考公/考研/考编/其他课程）、升学规划、考公考研
- 订单(orders)：下单、支付、核销码、取消、退款、发票、评价
- 我的(mine)：账号、学员信息、收藏、消息、我要入驻、平台管理、意见反馈、帮助中心
- 机构工作台(institution)：发布课程、套餐、服务人群、核销、收入
- 我要入驻(join)：机构/伴学/私家车车主入驻申请
- 升学规划(gaokao)：院校库、专业、投档线、位次、一分一段、冲稳保、志愿表
- 考公考研(exam)：考公、考研、考编、岗位、进面线、竞争比、报名日历
- 平台管理(admin)：入驻审核、全部订单、核销

家长咨询小学/初中学科课程（数学、语文、英语等）时：先按孩子年龄或年级判断学段
（6–12 岁约小学，13–15 岁约初中），再推荐对应学段的课程，并说明可到首页「课程」
Tab 浏览或直接搜索课程名报名。

如果用户在问某个功能在哪、或者明确说想去某处，就在回答最后单独一行写「[PAGE:页面标识]」，
标识只能取 index/learning/orders/mine/institution/join/gaokao/exam/admin/feedback/help/institutions/transport。
这一行只放标记，正文里不要出现。其它情况不要写这个标记。`;

function apiKey() {
  return String(process.env.DEEPSEEK_API_KEY || '').trim();
}
function modelOf(event) {
  const m = String((event && event.model) || '').trim();
  if (/^[a-z0-9._-]{2,40}$/i.test(m)) return m;
  return String(process.env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim();
}

function post(payload, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: API_HOST,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: 'Bearer ' + key
      },
      timeout: 20000
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(raw); } catch (e) { data = null; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.main = async (event) => {
  const action = event && event.action;

  if (action === 'status') {
    const key = apiKey();
    return { code: 0, data: { enabled: !!key, configured: !!key, model: modelOf(event), source: key ? 'env' : 'none' } };
  }

  if (action !== 'chat') return { code: 404, message: '接口不存在' };

  const question = String((event && event.question) || '').trim().slice(0, 500);
  if (!question) return { code: 400, message: '请填写问题' };

  const key = apiKey();
  if (!key) return { code: 400, message: 'AI 对话未开启', noKey: true };

  const history = Array.isArray(event.history) ? event.history.slice(-6) : [];
  const messages = [{ role: 'system', content: SYSTEM }];
  for (const m of history) {
    const t = String((m && m.text) || '').slice(0, 400);
    if (!t) continue;
    messages.push({ role: m.role === 'me' ? 'user' : 'assistant', content: t });
  }
  messages.push({ role: 'user', content: question });

  try {
    const upstream = await post({ model: modelOf(event), messages, temperature: 0.6, max_tokens: 400 }, key);
    if (upstream.status !== 200 || !upstream.data) return { code: 502, message: 'AI 服务返回错误' };
    let text = String(
      (upstream.data.choices && upstream.data.choices[0] && upstream.data.choices[0].message &&
        upstream.data.choices[0].message.content) || ''
    ).trim();
    if (!text) return { code: 502, message: 'AI 没有返回内容' };
    let page = '';
    const hit = text.match(/\[PAGE:([a-z]+)\]/i);
    if (hit) {
      page = hit[1].toLowerCase();
      text = text.replace(/\[PAGE:[a-z]+\]/ig, '').trim();
    }
    return { code: 0, data: { answer: text, page, source: 'api', model: modelOf(event) } };
  } catch (error) {
    return { code: 502, message: 'AI 服务暂时不可用：' + ((error && error.message) || '网络异常') };
  }
};
