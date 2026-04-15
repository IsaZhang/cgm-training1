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
    const dimensions = (detail.dimensions && detail.dimensions.length)
      ? detail.dimensions
      : [
        { key: 'need_discovery', name: '核心需求挖掘' },
        { key: 'wearing_plan', name: '佩戴方案合理性' },
        { key: 'professionalism', name: '专业度展示' },
        { key: 'communication_efficiency', name: '沟通效率' }
      ];
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify({
        total: detail.score,
        passed: detail.passed,
        scores: detail.deductions,
        summary: detail.summary || '',
        dimensions
      }))}`
    });
  }
});
