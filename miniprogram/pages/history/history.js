const { request } = require('../../utils/api');

Page({
  data: { records: [], stats: null },

  async onShow() {
    const [records, stats] = await Promise.all([
      request('/exam/history'),
      request('/exam/stats')
    ]);
    this.setData({ records, stats });
  },

  async viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    const detail = await request(`/exam/detail/${id}`);
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify({
        total: detail.score,
        passed: detail.passed,
        scores: detail.deductions,
        summary: '',
        dimensions: [
          { key: 'pain_point', name: '痛点识别' },
          { key: 'value_match', name: 'CGM价值匹配' },
          { key: 'communication', name: '沟通话术' },
          { key: 'conversion', name: '转化引导' }
        ]
      }))}`
    });
  }
});
