App({
  globalData: {
    // 默认走线上/云端地址；本地联调可在 Storage 里设置 baseUrl 覆盖
    // 例如在开发者工具 Console 执行：wx.setStorageSync('baseUrl', 'http://localhost:3000/api')
    baseUrl: 'https://cgm-training-229253-5-1407875349.sh.run.tcloudbase.com/api',
    token: '',
    userInfo: null
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
  }
});
