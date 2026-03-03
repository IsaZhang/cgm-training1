App({
  globalData: {
    baseUrl: 'http://localhost:3000/api',
    token: '',
    userInfo: null
  },
  onLaunch() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  }
});
