const app = getApp();

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + url,
      method: options.method || 'GET',
      timeout: options.timeout || 30000,
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'x-token': app.globalData.token,
        ...(app.globalData.selectedSubUnitId
          ? { 'x-sub-unit-id': app.globalData.selectedSubUnitId }
          : {})
      },
      success: (res) => {
        if (res.statusCode === 401) {
          wx.redirectTo({ url: '/pages/index/index' });
          return reject(new Error('请先登录'));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = res.data && (res.data.error || res.data.message);
          return reject(new Error(message || `请求失败(${res.statusCode})`));
        }
        if (res.data && res.data.error) {
          return reject(new Error(res.data.error));
        }
        resolve(res.data);
      },
      fail: reject
    });
  });
}

module.exports = { request };
