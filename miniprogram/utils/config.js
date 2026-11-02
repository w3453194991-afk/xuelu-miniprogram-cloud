/* 学鹭伴学 · 运行配置
 *
 * USE_CLOUD —— 后端模式开关：
 *   false（默认）：本地模拟模式。不依赖任何服务器，数据存在手机本地，
 *                  注册/下单/支付/入驻/志愿表等全部流程可完整走通。
 *   true         ：微信云开发模式。调用 cloudfunctions/ 下的云函数，
 *                  数据存云数据库。切换前请先完成两件事：
 *                  1. 在 miniprogram 同级目录的 cloudfunctions 里部署全部云函数
 *                     （开发者工具 → cloudfunctions → 右键每个函数 → 上传并部署）
 *                  2. 把下面的 CLOUD_ENV 改成你的云开发环境 ID
 *                  （微信公众平台 → 云开发 → 环境设置 → 环境 ID，形如 xuelu-3g1a2b4c）
 *
 * ADMIN_TOKEN —— 仅本地模拟模式使用的平台审批令牌（“我的 → 平台管理”里填写）。
 *   云开发模式下审批令牌配置在云函数 applications 的环境变量 ADMIN_TOKEN 中。
 */

const USE_CLOUD = false;
const CLOUD_ENV = '';
const ADMIN_TOKEN = 'xuelu-admin';

module.exports = {
  USE_CLOUD,
  CLOUD_ENV,
  ADMIN_TOKEN,
  APP_NAME: '学鹭伴学',
  STORAGE_PREFIX: 'xuelu.cloud.'
};
