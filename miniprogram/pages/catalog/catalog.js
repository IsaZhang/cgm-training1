const { request } = require('../../utils/api');
const app = getApp();

Page({
  data: { flatList: [] },

  async onShow() {
    try {
      const data = await request('/knowledge/me');
      app.globalData.knowledgeTree = data;
      const flat = [];
      (data.units || []).forEach(u => {
        (u.subunits || []).forEach(s => {
          flat.push({
            id: s.id,
            name: s.name,
            unitName: u.name,
            ui: s.ui || {}
          });
        });
      });
      this.setData({ flatList: flat });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onPick(e) {
    const id = e.currentTarget.dataset.id;
    const row = (this.data.flatList || []).find(x => x.id === id);
    const ui = (row && row.ui) ? row.ui : {};
    app.globalData.selectedSubUnitId = id;
    wx.setStorageSync('selectedSubUnitId', id);
    wx.setStorageSync('selectedSubUnitUi', ui);
    wx.navigateBack();
  }
});
