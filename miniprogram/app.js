App({
  globalData: {
    // 默认走线上/云端地址；本地联调可在 Storage 里设置 baseUrl 覆盖
    // 例如在开发者工具 Console 执行：wx.setStorageSync('baseUrl', 'http://localhost:3000/api')
    baseUrl: 'https://ai-cgm.ihealthcn.com/api',
    token: '',
    userInfo: null,
    /** 当前选中的知识子单元（对应服务端 catalog subunit id） */
    selectedSubUnitId: '',
    knowledgeTree: null
  },
  onLaunch() {
    const baseUrl = wx.getStorageSync('baseUrl');
    if (baseUrl) this.globalData.baseUrl = baseUrl;

    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
    const sub = wx.getStorageSync('selectedSubUnitId');
    if (sub) this.globalData.selectedSubUnitId = sub;
  }
});
