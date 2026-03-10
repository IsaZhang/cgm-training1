const { request } = require('../../utils/api');
const app = getApp();

Page({
  data: { loggedIn: false, showLogin: false, name: '', phone: '', userInfo: null },

  onLoad() {
    if (app.globalData.token) {
      this.setData({ loggedIn: true, userInfo: app.globalData.userInfo });
    }
  },

  onShow() {
    if (app.globalData.token) {
      this.setData({ loggedIn: true, userInfo: app.globalData.userInfo });
    }
  },

  showLoginForm() {
    this.setData({ showLogin: true });
  },

  cancelLogin() {
    this.setData({ showLogin: false });
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },

  async login() {
    const { name, phone } = this.data;
    if (!name || !phone) return wx.showToast({ title: '请填写完整', icon: 'none' });
    try {
      const res = await request('/auth/login', { method: 'POST', data: { name, phone } });
      if (res.error) return wx.showToast({ title: res.error, icon: 'none' });
      app.globalData.token = res.token;
      app.globalData.userInfo = { id: res.id, name: res.name };
      wx.setStorageSync('token', res.token);
      wx.setStorageSync('userInfo', app.globalData.userInfo);
      this.setData({ loggedIn: true, userInfo: app.globalData.userInfo, showLogin: false });
    } catch (e) {
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  goFlashcard() { wx.navigateTo({ url: '/pages/flashcard/flashcard' }); },
  goExam() { wx.navigateTo({ url: '/pages/chat/chat' }); },
  goVoiceExam() { wx.navigateTo({ url: '/pages/voice-exam/voice-exam' }); },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },

  logout() {
    app.globalData.token = '';
    app.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.setData({ loggedIn: false, userInfo: null });
  }
});
