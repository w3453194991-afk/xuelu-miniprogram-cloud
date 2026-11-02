/* 纯展示层格式化：不碰 wx，也不发请求 */

const ROLE_NAME = { parent: '家长', tutor: '大学生', institution: '机构' };
const TYPE_NAME = { course: '课程', tutor: '伴学', bus: '校车' };
const STATUS_NAME = { pending: '待支付', paid: '已支付', completed: '已完成', cancelled: '已取消' };
const STATUS_TONE = { pending: 'warn', paid: 'ok', completed: 'muted', cancelled: 'muted' };
const APPLICATION_STATUS = { pending: '审核中', approved: '已通过', rejected: '未通过' };
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function dash(value, fallback) {
  const text = value == null ? '' : String(value).trim();
  return text || (fallback === undefined ? '—' : fallback);
}

/* 金额：整数不带小数，带角分保留两位 */
function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/* 手机号脱敏：139****0002 */
function maskPhone(phone) {
  const text = String(phone == null ? '' : phone);
  if (!/^\d{11}$/.test(text)) return text || '—';
  return text.slice(0, 3) + '****' + text.slice(7);
}

function roleName(role) { return ROLE_NAME[role] || '游客'; }
function typeName(type) { return TYPE_NAME[type] || '服务'; }
function statusText(status) { return STATUS_NAME[status] || status || '—'; }
function statusTone(status) { return STATUS_TONE[status] || 'muted'; }
function applicationStatusText(status) { return APPLICATION_STATUS[status] || status || '—'; }

/* YYYY-MM-DD → 周六（按 UTC 取，避免设备时区偏移一天） */
function weekdayOf(date) {
  const text = String(date == null ? '' : date).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const time = Date.parse(text + 'T00:00:00Z');
  if (Number.isNaN(time)) return '';
  return WEEKDAYS[new Date(time).getUTCDay()] || '';
}

/* 时段文本里的星期前缀：「周六 09:00–10:00」→ 周六 */
function slotWeekday(slot) {
  const hit = /^(周[一二三四五六日])\s*/.exec(String(slot == null ? '' : slot));
  return hit ? hit[1] : '';
}

/* 「2026-10-24」→「10-24 周六」 */
function shortDate(date) {
  const text = String(date == null ? '' : date).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text.slice(5) + ' ' + weekdayOf(text);
}

/* 时间戳 / ISO 字符串 → 本地日期时间 */
function dateTime(value) {
  if (value == null || value === '') return '—';
  let date;
  if (typeof value === 'number') date = new Date(value);
  else if (typeof value === 'object' && value.$date) date = new Date(value.$date);
  else date = new Date(String(value).replace(' ', 'T') + (String(value).length <= 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(date.getTime())) return '—';
  const pad = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

/* 今天（中国时区 YYYY-MM-DD） */
function todayCN() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const cn = new Date(utc + 8 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return cn.getFullYear() + '-' + pad(cn.getMonth() + 1) + '-' + pad(cn.getDate());
}

/* 百分比文本：0.42 → 42% */
function percent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n * 100) + '%';
}

module.exports = {
  WEEKDAYS,
  ROLE_NAME, TYPE_NAME, STATUS_NAME, APPLICATION_STATUS,
  dash, money, maskPhone, roleName, typeName,
  statusText, statusTone, applicationStatusText,
  weekdayOf, slotWeekday, shortDate, dateTime, todayCN, percent
};
