const api = require('../../utils/api.js');
const data = require('../../utils/assistant-data.js');

Page({
  data: {
    messages: [],
    quick: data.QUICK,
    input: '',
    sending: false,
    scrollTo: '',
    greeting: '你好，我是鹭鹭。课程、订单、升学规划、机构入驻都可以问我。'
  },

  onLoad(query) {
    const preset = query && query.q ? decodeURIComponent(query.q) : '';
    this.seq = 0;
    this.history = [];
    this.push('bot', this.data.greeting);
    if (preset) this.ask(preset);
  },

  push(role, text, extra) {
    this.seq += 1;
    const id = 'm' + this.seq;
    const messages = this.data.messages.concat([Object.assign({ id, role, text }, extra || {})]);
    this.setData({ messages, scrollTo: id });
    return id;
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  onQuick(e) {
    const q = e.currentTarget.dataset.q;
    if (!q || this.data.sending) return;
    this.ask(q);
  },

  onSubmit() {
    const text = (this.data.input || '').trim();
    if (!text || this.data.sending) return;
    this.setData({ input: '' });
    this.ask(text);
  },

  ask(text) {
    this.push('me', text);
    this.history = this.history.concat([{ role: 'me', text }]).slice(-6);
    this.setData({ sending: true });
    const holder = this.push('bot', '鹭鹭正在想…', { typing: true });

    api.assistant.chat(text, this.history).then(res => {
      /* 云端助手不可用时直接走内置问答，界面不打扰用户 */
      const local = data.answer(text);
      let payload;
      if (res.ok && res.data && res.data.answer) {
        const route = res.data.route || data.routeOf(res.data.answer) || null;
        payload = {
          text: res.data.answer,
          route: route || null,
          related: Array.isArray(res.data.related) ? res.data.related : [],
          courses: Array.isArray(res.data.courses) ? res.data.courses : []
        };
      } else {
        payload = {
          text: local.a,
          route: local.go || null,
          related: (local.related || []).map(row => ({ q: row.q, a: row.a })),
          courses: local.courses || []
        };
      }
      this.replace(holder, payload);
      this.setData({ sending: false });
      this.history = this.history.concat([{ role: 'bot', text: payload.text }]).slice(-6);
    });
  },

  replace(id, payload) {
    const messages = this.data.messages.map(item => (
      item.id === id
        ? Object.assign({}, item, {
            text: payload.text,
            route: payload.route,
            related: payload.related,
            courses: payload.courses || [],
            typing: false
          })
        : item
    ));
    this.setData({ messages, scrollTo: id });
  },

  onRelated(e) {
    const q = e.currentTarget.dataset.q;
    if (!q || this.data.sending) return;
    this.ask(q);
  },

  onRoute(e) {
    const index = Number(e.currentTarget.dataset.index);
    const route = (this.data.messages[index] || {}).route;
    if (!route) return;
    /* 课程跳转带上 Tab 意图，首页 onShow 时直接切到「课程」 */
    if (route.page) getApp().globalData.indexTab = route.page;
    if (route.tab) wx.switchTab({ url: route.path });
    else wx.navigateTo({ url: route.path });
  },

  /* 点推荐课程卡：直接进该课程详情页 */
  onCourse(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(id) });
  }
});
