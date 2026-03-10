const { request } = require('../../utils/api');

Page({
  data: {
    started: false, patients: [],
    patientId: '', patientName: '', messages: [],
    inputText: '', loading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '留言考核' });
    this.loadPatients();
  },

  async loadPatients() {
    const patients = await request('/chat/patients');
    this.setData({ patients });
  },

  selectPatient(e) {
    const id = e.currentTarget.dataset.id;
    const p = this.data.patients.find(x => x.id === id);
    this.setData({
      started: true, patientId: id, patientName: p.name,
      messages: [{ role: 'patient', content: `你好，我是来看糖尿病的。（${p.diagnosis}）` }]
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
