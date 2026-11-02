/* 页面公共助手：提示、登录守卫、加载服务目录 */

const api = require('./api.js');

function toast(title, icon) {
  wx.showToast({ title: title, icon: icon || 'none', duration: 1800 });
}

function loading(title) {
  wx.showLoading({ title: title || '加载中', mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

/* 统一处理失败响应：会话失效时引导重新登录 */
function fail(res, fallback) {
  const message = (res && res.error) || fallback || '操作失败，请稍后再试';
  if (res && res.needLogin) {
    wx.showModal({
      title: '提示',
      content: '登录已过期，请重新登录',
      showCancel: false,
      success: () => wx.reLaunch({ url: '/pages/login/login' })
    });
    return;
  }
  wx.showToast({ title: message, icon: 'none', duration: 2200 });
}

/* 需要登录的页面调用：未登录跳登录页 */
function requireLogin() {
  if (!api.token()) {
    wx.showToast({ title: '请先登录', icon: 'none' });
    setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 600);
    return false;
  }
  return true;
}

function roleName(role) {
  return { parent: '家长', tutor: '大学生', institution: '机构' }[role] || '游客';
}

/* 拉取服务目录并写入全局缓存 */
function loadServices() {
  return api.services.list().then(res => {
    if (res.ok) getApp().cacheServices(res.data);
    return res;
  });
}

module.exports = { toast, loading, hideLoading, fail, requireLogin, roleName, loadServices };
