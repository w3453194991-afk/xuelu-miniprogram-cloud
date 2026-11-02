const api = require('./utils/api.js');

App({
  globalData: {
    /* 当前登录账号：{id, phone, role}，与本地存储同步 */
    user: api.user(),
    /* 服务目录缓存，详情页免二次请求 */
    services: [],
    servicesAt: 0,
    /* 学习资源缓存 */
    learningItems: [],
    /* 跨页默认分类：首页「职考技能」进入学习页时用一次 */
    learningKind: ''
  },

  onLaunch() {
    this.refreshSession();
  },

  /* 用本地令牌换一次会话，失效就清掉本地登录态 */
  refreshSession() {
    if (!api.token()) {
      this.globalData.user = null;
      api.clearUser();
      return Promise.resolve(null);
    }
    return api.auth.me().then(res => {
      if (!res.ok || !res.data || !res.data.authenticated) {
        this.logoutLocal();
        return null;
      }
      const row = api.setUser(res.data.user);
      this.globalData.user = row;
      return row;
    });
  },

  setSession(userRow) {
    const row = api.setUser(userRow);
    this.globalData.user = row;
    return row;
  },

  logoutLocal() {
    api.clearToken();
    api.clearUser();
    this.globalData.user = null;
  },

  cacheServices(list) {
    this.globalData.services = Array.isArray(list) ? list : [];
    this.globalData.servicesAt = Date.now();
  },

  findService(id) {
    return (this.globalData.services || []).find(row => row && row.id === id) || null;
  }
});
