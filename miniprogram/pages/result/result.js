Page({
  data: { total: 0, passed: false, scoreList: [], summary: '' },

  onLoad(opts) {
    try {
      const data = JSON.parse(decodeURIComponent(opts.data));
      const scoreList = [];
      if (data.scores) {
        for (const key in data.scores) {
          const s = data.scores[key];
          const dim = (data.dimensions || []).find(d => d.key === key);
          scoreList.push({ key, name: dim ? dim.name : key, score: s.score, max: s.max, comment: s.comment });
        }
      }
      this.setData({ total: data.total, passed: data.passed, scoreList, summary: data.summary || '' });
    } catch (e) {
      wx.showToast({ title: '数据解析失败', icon: 'none' });
    }
  },

  goBack() { wx.reLaunch({ url: '/pages/index/index' }); }
});
