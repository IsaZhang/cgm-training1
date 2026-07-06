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
        { key: 'conversion_mainline', name: '转化切入与主线' },
        { key: 'need_necessity', name: '管理必要性与痛点提炼' },
        { key: 'cgm_value_link', name: 'CGM工具价值连接' },
        { key: 'multi_device_cycle', name: '多台连续管理周期' },
        { key: 'closing_objection', name: '方案收口与决策障碍处理' }
      ];
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify({
        total: detail.score,
        passed: detail.passed,
        scores: detail.deductions,
        summary: detail.summary || '',
        dimensions,
        // 转化质检定性字段（旧记录可能没有，成绩页已做条件渲染）
        conversion_rating: detail.conversion_rating,
        listening_score: detail.listening_score,
        problem_tags: detail.problem_tags,
        root_problem: detail.root_problem,
        key_evidence: detail.key_evidence,
        suggested_actions: detail.suggested_actions,
        mainlines: detail.mainlines,
        red_line: detail.red_line
      }))}`
    });
  }
});
