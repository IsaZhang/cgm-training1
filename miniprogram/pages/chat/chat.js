const { request } = require('../../utils/api');
const app = getApp();

// 患者无自定义开场白时的兜底池（保持中性，不直接暴露顾虑，需照护师主动挖掘）
const FALLBACK_OPENINGS = [
  '化验单是给你吗？大夫让我到你这边来。', '我是坐这里吗？', '我先开药还是先听你讲？',
  '这个药怎么吃啊？', '我下次得什么时候来？', '你好，我是来看糖尿病的。'
];

function pickOpening(patient) {
  const pool = (patient && Array.isArray(patient.openings) && patient.openings.length)
    ? patient.openings : FALLBACK_OPENINGS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 列表副标题：考官等非患者场景用 subtitle，患者场景回退到「年龄 性别 · 诊断」
function buildSubtitle(p) {
  if (p.subtitle) return p.subtitle;
  const parts = [];
  if (p.age) parts.push(`${p.age}岁`);
  if (p.gender) parts.push(p.gender);
  const head = parts.join(' ');
  return p.diagnosis ? (head ? `${head} · ${p.diagnosis}` : p.diagnosis) : head;
}

Page({
  data: {
    started: false, patients: [],
    patientId: '', patientName: '', roleLabel: '患者', messages: [],
    inputText: '', loading: false
  },

  onLoad() {
    if (!app.globalData.selectedSubUnitId) {
      wx.showToast({ title: '请先选择知识场景', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    wx.setNavigationBarTitle({ title: '留言考核' });
    this.loadPatients();
  },

  async loadPatients() {
    const patients = await request('/chat/patients');
    this.setData({ patients: (patients || []).map(p => ({ ...p, _subtitle: buildSubtitle(p) })) });
  },

  selectPatient(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.patients.find(x => x.id === id);
    this.setData({
      started: true, patientId: id, patientName: p.name,
      roleLabel: p.role_label || '患者',
      messages: [{ role: 'patient', content: pickOpening(p) }]
    });
  },

  onInput(e) { this.setData({ inputText: e.detail.value }); },

  async send() {
    const text = this.data.inputText.trim();
    if (!text || this.data.loading) return;

    const messages = [...this.data.messages, { role: 'nurse', content: text }];
    this.setData({ messages, inputText: '', loading: true });

    try {
      const res = await request('/chat/message', {
        method: 'POST',
        data: { patient_id: this.data.patientId, history: messages, message: text }
      });
      messages.push({ role: 'patient', content: res.reply });
      this.setData({ messages, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '对话失败', icon: 'none' });
    }
  },

  async endChat() {
    wx.showModal({
      title: '提交考核', content: '确认结束对话并提交评分？',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '评分中...' });
        try {
          const result = await request('/exam/submit', {
            method: 'POST',
            data: {
              patient_type: this.data.patientName,
              conversation: this.data.messages,
              exam_type: 'text'
            }
          });
          wx.hideLoading();
          wx.redirectTo({
            url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(result))}`
          });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '评分失败', icon: 'none' });
        }
      }
    });
  }
});
