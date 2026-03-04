App({
  globalData: {
    baseUrl: 'https://prod-5gq02p6y6f0019c7-8adb286e3a-1407875349.ap-shanghai.app.tcloudbase.com/api',
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
