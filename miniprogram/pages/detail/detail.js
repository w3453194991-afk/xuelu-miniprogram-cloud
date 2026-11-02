const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');
const fmt = require('../../utils/format.js');

Page({
  data: {
    view: null,
    videoUrls: {},
    loading: true
  },

  onLoad(options) {
    this.serviceId = options.id ? decodeURIComponent(options.id) : '';
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const cached = getApp().findService(this.serviceId);
    if (cached) {
      this.render(cached);
      return;
    }
    ui.loading();
    api.services.list().then(res => {
      ui.hideLoading();
      if (!res.ok) { ui.fail(res, '加载失败'); return; }
      getApp().cacheServices(res.data);
      const svc = getApp().findService(this.serviceId);
      if (!svc) { ui.toast('服务不存在或已下架'); setTimeout(() => wx.navigateBack(), 600); return; }
      this.render(svc);
    });
  },

  render(svc) {
    const view = logic.detailView(svc);
    this.setData({ view: this.decorate(view), loading: false });
    /* 云存储视频换取临时播放地址 */
    const cloudFiles = [];
    for (const p of view.packages) {
      if (p.videoUrl && p.videoUrl.indexOf('cloud://') === 0) cloudFiles.push(p.videoUrl);
    }
    if (cloudFiles.length) {
      api.services.tempUrl(cloudFiles).then(res => {
        if (!res.ok || !res.data) return;
        const map = {};
        for (const row of res.data) {
          if (row.tempFileURL) map[row.fileID] = row.tempFileURL;
        }
        this.setData({ videoUrls: map });
        this.setData({ view: this.decorate(view, map) });
      });
    }
  },

  /* 模板不能调用页面方法，先把套餐视频地址解析好 */
  decorate(view, map) {
    const urls = map || this.data.videoUrls || {};
    const resolve = url => {
      if (!url) return '';
      if (url.indexOf('cloud://') === 0) return urls[url] || '';
      return url;
    };
    return Object.assign({}, view, {
      packages: (view.packages || []).map(pkg => Object.assign({}, pkg, { src: resolve(pkg.videoUrl) }))
    });
  },

  goBooking() {
    wx.navigateTo({ url: '/pages/booking/booking?id=' + encodeURIComponent(this.serviceId) });
  },

  goMerchant() {
    const view = this.data.view;
    if (!view || !view.merchant || !view.merchant.name) return;
    if (view.type === 'course') {
      wx.navigateTo({ url: '/pages/merchant/merchant?name=' + encodeURIComponent(view.merchant.name) });
    }
  },

  onShareAppMessage() {
    const view = this.data.view;
    return {
      title: view ? view.title : '学鹭伴学',
      path: '/pages/index/index'
    };
  }
});
