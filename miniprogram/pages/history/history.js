const { request } = require('../../utils/api');

Page({
  data: { records: [], stats: null },

  async onShow() {
    const [records, stats] = await Promise.all([
      request('/exam/history'),
      request('/exam/stats')
    ]);
    this.setData({
      records: (records || []).map(record => ({
        ...record,
        examTypeLabel: this.getExamTypeLabel(record),
        examTypeIcon: this.getExamTypeIcon(record)
      })),
      stats
    });
  },

  getExamType(record) {
    if (record.exam_type === 'voice') return 'voice';
    if (record.exam_type === 'text') return 'text';
    if (record.session_id && String(record.session_id).startsWith('voice_')) return 'voice';
    return 'text';
  },

  getExamTypeLabel(record) {
    return this.getExamType(record) === 'voice' ? '语音考核' : '留言考核';
  },

  getExamTypeIcon(record) {
    return this.getExamType(record) === 'voice' ? '🎤' : '💬';
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
