const api = require('../../utils/api.js');
const ui = require('../../utils/ui.js');
const logic = require('../../utils/logic.js');
const fmt = require('../../utils/format.js');

Page({
  data: {
    type: 'course',
    title: '',
    price: 0,
    priceText: '0',
    amountText: '0',
    unit: '',
    remaining: 0,
    /* 课程 */
    packages: [],
    packageId: '',
    date: '',
    /* 伴学 */
    slots: [],
    sessions: [],
    pickedDate: '',
    /* 校车 */
    starts: [],
    ends: [],
    startPoint: '',
    endPoint: '',
    period: '月付',
    periods: ['月付'],
    /* 公共 */
    student: '',
    phone: '',
    guardian: '',
    relation: '',
    guardianPhone: '',
    age: '',
    gender: '未填写',
    address: '',
    submitting: false,
    today: fmt.todayCN(),
    genders: ['男', '女', '未填写'],
    relations: ['父亲', '母亲', '家长', '祖父母', '其他监护人']
  },

  onLoad(options) {
    this.serviceId = options.id ? decodeURIComponent(options.id) : '';
    if (!ui.requireLogin()) return;
    const svc = getApp().findService(this.serviceId);
    if (!svc) {
      ui.loading();
      api.services.list().then(res => {
        ui.hideLoading();
        if (res.ok) getApp().cacheServices(res.data);
        this.setup();
      });
      return;
    }
    this.setup();
  },

  setup() {
    const svc = getApp().findService(this.serviceId);
    if (!svc) { ui.toast('服务不存在'); setTimeout(() => wx.navigateBack(), 600); return; }
    const view = logic.detailView(svc);
    const base = {
      type: view.type,
      title: view.title,
      price: view.price,
      priceText: view.priceText,
      unit: view.unit,
      remaining: view.remaining,
      packages: view.packages,
      amountText: view.priceText,
      date: ''
    };
    wx.setNavigationBarTitle({ title: '报名 · ' + view.title });
    if (view.type === 'course') {
      this.setData(Object.assign(base, { packageId: view.packages.length ? view.packages[0].id : '' }));
      return;
    }
    if (view.type === 'tutor') {
      this.tutorSlots = view.slots.map(s => s.text);
      this.setData(Object.assign(base, { slots: [], sessions: [] }));
      this.loadAvailability(fmt.todayCN());
      return;
    }
    /* 校车 */
    this.setData(Object.assign(base, {
      starts: view.bus.stops,
      ends: [],
      startPoint: '',
      endPoint: '',
      periods: view.bus.period.length ? view.bus.period : ['月付'],
      period: (view.bus.period.length ? view.bus.period : ['月付'])[0]
    }));
  },

  /* ---------- 伴学：按日期拉可约时段 ---------- */
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ pickedDate: date, slots: [] });
    this.loadAvailability(date);
  },

  loadAvailability(date) {
    if (!date) return;
    api.services.availability(this.serviceId, date).then(res => {
      if (!res.ok) { ui.fail(res, '可约时段加载失败'); return; }
      this.setData({ slots: this.markSlots(logic.availabilityView(res.data), this.data.sessions) });
    });
  },

  /* 模板不能调用方法，把「已选」状态算进每条时段 */
  markSlots(slots, sessions) {
    const date = this.data.pickedDate || fmt.todayCN();
    const picked = new Set((sessions || []).filter(s => s.date === date).map(s => s.slot));
    return (slots || []).map(slot => Object.assign({}, slot, { picked: picked.has(slot.slot) }));
  },

  toggleSlot(e) {
    const slot = e.currentTarget.dataset.slot;
    if (e.currentTarget.dataset.disabled) return;
    const date = this.data.pickedDate || fmt.todayCN();
    const picked = this.data.sessions.some(s => s.date === date && s.slot === slot);
    const next = picked
      ? logic.removeSession(this.data.sessions, date, slot)
      : logic.addSession(this.data.sessions, date, slot);
    const total = next.length ? Math.round(this.data.price * next.length) : this.data.price;
    this.setData({
      sessions: next,
      amountText: String(total),
      slots: this.markSlots(this.data.slots, next)
    });
  },

  isSlotPicked(e) {
    return false;
  },

  /* ---------- 校车：下车点依赖上车点 ---------- */
  onStartChange(e) {
    const index = Number(e.detail.value);
    const svc = getApp().findService(this.serviceId);
    const bus = logic.busView(svc);
    const start = bus.routes[index] ? bus.routes[index].name : '';
    this.setData({
      startPoint: start,
      ends: logic.busEndOptions(bus, start),
      endPoint: ''
    });
  },

  onEndChange(e) {
    const index = Number(e.detail.value);
    this.setData({ endPoint: this.data.ends[index] || '' });
  },

  onPackageChange(e) {
    const index = Number(e.detail.value);
    const pkg = this.data.packages[index];
    this.setData({
      packageId: pkg ? pkg.id : '',
      price: pkg ? pkg.price : this.data.price,
      priceText: pkg ? pkg.priceText : this.data.priceText,
      amountText: pkg ? pkg.priceText : this.data.priceText
    });
  },

  /* ---------- 表单 ---------- */
  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ gender: this.data.genders[Number(e.detail.value)] || '未填写' });
  },

  onRelationChange(e) {
    this.setData({ relation: this.data.relations[Number(e.detail.value)] || '' });
  },

  submit() {
    if (this.data.submitting) return;
    if (!ui.requireLogin()) return;
    const d = this.data;
    if (!d.student) { ui.toast('请填写学生姓名'); return; }
    if (!/^1\d{10}$/.test(d.phone)) { ui.toast('请填写有效的 11 位手机号'); return; }
    const payload = {
      serviceId: this.serviceId,
      student: d.student,
      phone: d.phone,
      guardian: d.guardian || undefined,
      relation: d.relation || undefined,
      guardianPhone: d.guardianPhone || undefined,
      age: d.age || undefined,
      gender: d.gender || undefined,
      address: d.address || undefined
    };
    if (d.type === 'course') {
      if (d.packageId) payload.packageId = d.packageId;
      if (d.date) payload.date = d.date;
    }
    if (d.type === 'tutor') {
      if (!d.sessions.length) { ui.toast('请至少选择 1 个预约时段'); return; }
      payload.sessions = d.sessions;
    }
    if (d.type === 'bus') {
      if (!d.startPoint || !d.endPoint) { ui.toast('请选择上车站点和下车站点'); return; }
      payload.startPoint = d.startPoint;
      payload.endPoint = d.endPoint;
      payload.period = d.period;
    }
    this.setData({ submitting: true });
    api.orders.create(payload).then(res => {
      this.setData({ submitting: false });
      if (!res.ok) { ui.fail(res, '下单失败'); return; }
      wx.showToast({ title: '下单成功', icon: 'success' });
      setTimeout(() => wx.redirectTo({ url: '/pages/orders/orders' }), 700);
    });
  }
});
