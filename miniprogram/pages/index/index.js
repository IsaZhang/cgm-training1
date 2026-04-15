const { request } = require('../../utils/api');
const app = getApp();

const DEFAULT_UI = {
  navigationTitle: '照护师训练',
  homeTitle: '照护师训练',
  homeSubtitle: '照护师练习与考核平台',
  introLine: '多场景销售转化训练平台',
  menuFlashcardTitle: '闪卡学习',
  menuFlashcardDesc: '基础知识学习',
  menuExamTitle: '留言考核',
  menuExamDesc: '文字对话考核，AI评分',
  menuVoiceTitle: '语音考核',
  menuVoiceDesc: '真实语音对话，更接近实战',
  menuHistoryTitle: '考核记录',
  menuHistoryDesc: '查看历史成绩和扣分详情'
};

function applyNavUi(ui) {
  const u = { ...DEFAULT_UI, ...(ui || {}) };
  wx.setNavigationBarTitle({ title: u.navigationTitle || '照护师训练' });
  return u;
}

Page({
  data: {
    loggedIn: false,
    showLogin: false,
    name: '',
    phone: '',
    userInfo: null,
    agreed: false,
    hasSubUnit: false,
    ui: DEFAULT_UI
  },

  onLoad() {
    if (app.globalData.token) {
      this.setData({ loggedIn: true, userInfo: app.globalData.userInfo });
      this.syncSubUnitFromStorage();
    }
  },

  onShow() {
    if (app.globalData.token) {
      this.setData({ loggedIn: true, userInfo: app.globalData.userInfo });
      this.syncSubUnitFromStorage();
    }
  },

  syncSubUnitFromStorage() {
    const sid = wx.getStorageSync('selectedSubUnitId');
    const uiStored = wx.getStorageSync('selectedSubUnitUi');
    if (sid) {
      app.globalData.selectedSubUnitId = sid;
    }
    const ui = applyNavUi(uiStored || {});
    this.setData({
      hasSubUnit: !!sid,
      ui
    });
  },

  showLoginForm() {
    this.setData({ showLogin: true });
  },

  cancelLogin() {
    this.setData({ showLogin: false });
  },

  toggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
  },

  showAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  showPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },

  async login() {
    const { name, phone, agreed } = this.data;
    if (!name || !phone) return wx.showToast({ title: '请填写完整', icon: 'none' });
    if (!agreed) return wx.showToast({ title: '请先阅读并同意用户协议和隐私声明', icon: 'none' });
    try {
      const res = await request('/auth/login', { method: 'POST', data: { name, phone } });
      if (res.error) return wx.showToast({ title: res.error, icon: 'none' });
      app.globalData.token = res.token;
      app.globalData.userInfo = { id: res.id, name: res.name };
      wx.setStorageSync('token', res.token);
      wx.setStorageSync('userInfo', app.globalData.userInfo);
      this.setData({ loggedIn: true, userInfo: app.globalData.userInfo, showLogin: false });
      await this.afterLoginPickSubUnit();
    } catch (e) {
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  async afterLoginPickSubUnit() {
    try {
      const data = await request('/knowledge/me');
      const allowed = data.allowedSubUnitIds || [];
      if (allowed.length === 1) {
        const only = allowed[0];
        app.globalData.selectedSubUnitId = only;
        wx.setStorageSync('selectedSubUnitId', only);
        let ui = {};
        (data.units || []).forEach(u => {
          (u.subunits || []).forEach(s => {
            if (s.id === only) ui = s.ui || {};
          });
        });
        wx.setStorageSync('selectedSubUnitUi', ui);
        const merged = applyNavUi(ui);
        this.setData({ hasSubUnit: true, ui: merged });
      } else {
        wx.navigateTo({ url: '/pages/catalog/catalog' });
      }
    } catch (e) {
      console.warn(e);
    }
  },

  goPickSubUnit() {
    wx.navigateTo({ url: '/pages/catalog/catalog' });
  },

  ensureSubUnit(then) {
    if (!app.globalData.selectedSubUnitId) {
      wx.showModal({
        title: '提示',
        content: '请先选择知识场景',
        confirmText: '去选择',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/catalog/catalog' }); }
      });
      return;
    }
    then();
  },

  goFlashcard() {
    if (!this.data.loggedIn) {
      this.setData({ showLogin: true });
      return;
    }
    this.ensureSubUnit(() => wx.navigateTo({ url: '/pages/flashcard/flashcard' }));
  },

  goExam() {
    if (!this.data.loggedIn) {
      this.setData({ showLogin: true });
      return;
    }
    this.ensureSubUnit(() => wx.navigateTo({ url: '/pages/chat/chat' }));
  },

  goVoiceExam() {
    if (!this.data.loggedIn) {
      this.setData({ showLogin: true });
      return;
    }
    this.ensureSubUnit(() => wx.navigateTo({ url: '/pages/voice-exam/voice-exam' }));
  },

  goHistory() {
    if (!this.data.loggedIn) {
      this.setData({ showLogin: true });
      return;
    }
    this.ensureSubUnit(() => wx.navigateTo({ url: '/pages/history/history' }));
  },

  logout() {
    app.globalData.token = '';
    app.globalData.userInfo = null;
    app.globalData.selectedSubUnitId = '';
    app.globalData.knowledgeTree = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('selectedSubUnitId');
    wx.removeStorageSync('selectedSubUnitUi');
    wx.setNavigationBarTitle({ title: '照护师训练' });
    this.setData({
      loggedIn: false,
      userInfo: null,
      hasSubUnit: false,
      ui: DEFAULT_UI
    });
  }
});
