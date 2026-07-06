const MAINLINE_DEFS = [
  { key: 'necessity', name: '血糖管理必要性' },
  { key: 'cgm', name: 'CGM/动态血糖引入' },
  { key: 'multi_device', name: '多台连续管理周期' },
  { key: 'online_mgmt', name: '线上管理/APP/随访' },
  { key: 'followup', name: '复诊/检查/调药跟进' },
  { key: 'other', name: '其他转化主线' }
];

// 倾听匹配度文案
const LISTENING_LABEL = { 0: '低匹配', 1: '部分匹配', 2: '高匹配' };

Page({
  data: {
    total: 0, passed: false, scoreList: [], summary: '',
    // 转化质检定性字段
    conversionRating: '', ratingClass: '',
    listeningText: '', problemTags: [], rootProblem: '',
    keyEvidence: '', suggestedActions: '', mainlineList: [],
    redLine: null
  },

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

      // 评级 → 颜色样式（兼容转化质检「正常/待优化/严重待优化」与理念考核「优秀/合格/不合格」）
      const rating = data.conversion_rating || '';
      const passLike = ['正常', '优秀', '合格', '通过'];
      const failLike = ['严重待优化', '不合格', '不通过'];
      const ratingClass = passLike.includes(rating) ? 'pass'
        : (failLike.includes(rating) ? 'fail' : (rating ? 'warn' : ''));

      // 转化主线（对象 → 列表，过滤掉空项）
      const ml = data.mainlines || {};
      const mainlineList = MAINLINE_DEFS
        .map(d => {
          const item = ml[d.key] || {};
          return { name: d.name, level: item.level || '', basis: item.basis || '' };
        })
        .filter(x => x.level || x.basis);

      const listeningText = (data.listening_score != null && LISTENING_LABEL[data.listening_score] != null)
        ? `${data.listening_score}分（${LISTENING_LABEL[data.listening_score]}）`
        : '';

      this.setData({
        total: data.total,
        passed: data.passed,
        scoreList,
        summary: data.summary || '',
        conversionRating: rating,
        ratingClass,
        listeningText,
        problemTags: Array.isArray(data.problem_tags) ? data.problem_tags : [],
        rootProblem: data.root_problem || '',
        keyEvidence: data.key_evidence || '',
        suggestedActions: data.suggested_actions || '',
        mainlineList,
        redLine: (data.red_line && data.red_line.violated) ? data.red_line : null
      });
    } catch (e) {
      wx.showToast({ title: '数据解析失败', icon: 'none' });
    }
  },

  goBack() { wx.reLaunch({ url: '/pages/index/index' }); }
});
