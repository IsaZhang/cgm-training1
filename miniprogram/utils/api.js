const app = getApp();

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'x-token': app.globalData.token
      },
      success: (res) => {
        if (res.statusCode === 401) {
          wx.redirectTo({ url: '/pages/index/index' });
          return reject(new Error('请先登录'));
        }
        resolve(res.data);
      },
      fail: reject
    });
  });
}

module.exports = { request };
