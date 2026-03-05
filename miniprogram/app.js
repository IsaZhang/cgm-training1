App({
  globalData: {
    baseUrl: 'https://cgm-training-229253-5-1407875349.sh.run.tcloudbase.com/api',
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
