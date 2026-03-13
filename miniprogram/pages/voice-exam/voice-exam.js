const { request } = require('../../utils/api');
const plugin = requirePlugin('WechatSI');

Page({
  data: {
    patient: null,
    started: false,
    status: 'idle',
    messages: [],
    sessionId: null
  },

  recordManager: null,
  innerAudioContext: null,
  isRecording: false,
  isEnding: false,

  onLoad() {
    this.recordManager = plugin.getRecordRecognitionManager();
    this.innerAudioContext = wx.createInnerAudioContext();
    this.setupRecorder();
    this.loadRandomPatient();
  },

  onHide() {
    this.isEnding = true;
    this.stopListening();
  },

  onUnload() {
    this.isEnding = true;
    this.stopListening();
    if (this.innerAudioContext) this.innerAudioContext.destroy();
  },

  async loadRandomPatient() {
    const patients = await request('/chat/patients');
    const patient = patients[Math.floor(Math.random() * patients.length)];
    this.setData({ patient });
  },

  setupRecorder() {
    const that = this;
    this.recordManager.onStart = function () {
      that.isRecording = true;
      that.setData({ status: 'listening' });
    };

    this.recordManager.onStop = function (res) {
      that.isRecording = false;
      if (that.isEnding) return;
      const userText = (res.result || '').trim();
      if (userText) {
        that.setData({ status: 'processing' });
        that.processAudio(userText);
      } else {
        wx.showToast({ title: '未识别到语音，请重试', icon: 'none' });
        that.setData({ status: 'idle' });
        that.startListening();
      }
    };

    this.recordManager.onError = function (res) {
      that.isRecording = false;
      if (that.isEnding) return;
      wx.showToast({ title: (res && res.msg) || '录音失败', icon: 'none' });
      that.setData({ status: 'idle' });
      that.startListening();
    };
  },

  async processAudio(userText) {
    try {
      const messages = [...this.data.messages, { role: 'nurse', content: userText }];
      this.setData({ messages });

      this.setData({ status: 'speaking' });
      const aiRes = await request('/voice/chat', {
        method: 'POST',
        data: {
          sessionId: this.data.sessionId,
          patientId: this.data.patient.id,
          history: messages,
          message: userText
        }
      });

      messages.push({ role: 'patient', content: aiRes.reply });
      this.setData({ messages, sessionId: aiRes.sessionId });

      await this.playAIVoice(aiRes.reply);

      this.setData({ status: 'idle' });
      this.startListening();
    } catch (e) {
      console.error('处理失败:', e);
      wx.showToast({ title: '处理失败', icon: 'none' });
      this.setData({ status: 'idle' });
      this.startListening();
    }
  },

  playAIVoice(text) {
    if (!text) return this.sleep(1000);
    const content = text.length > 50 ? text.substring(0, 50) : text;
    return new Promise((resolve) => {
      plugin.textToSpeech({
        lang: 'zh_CN',
        content,
        success: (res) => {
          if (res.retcode === 0 && res.filename) {
            this.innerAudioContext.src = res.filename;
            this.innerAudioContext.onEnded(() => resolve());
            this.innerAudioContext.onError(() => resolve());
            this.innerAudioContext.play();
          } else {
            resolve();
          }
        },
        fail: () => resolve()
      });
    });
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  startListening() {
    if (!this.recordManager) return;
    if (!this.data.started) return;
    if (!this.data.patient) return;
    if (this.isRecording) return;
    try {
      this.setData({ status: 'listening' });
      this.isRecording = true;
      this.recordManager.start({
        duration: 15000,
        lang: 'zh_CN'
      });
    } catch (e) {
      console.error('启动录音失败:', e);
      this.isRecording = false;
      wx.showToast({ title: '启动录音失败', icon: 'none' });
      this.setData({ status: 'idle' });
    }
  },

  stopListening() {
    if (this.isRecording && this.recordManager) {
      try {
        this.recordManager.stop();
      } catch (e) {
        console.warn('停止录音:', e);
      }
      this.isRecording = false;
    }
    this.setData({ status: 'idle' });
  },

  onStatusTap() {
    if (this.data.status === 'listening') {
      this.stopListening();
    }
  },

  async startExam() {
    const sessionId = `voice_${Date.now()}`;
    const greeting = `你好，我是来看糖尿病的。`;

    this.setData({
      started: true,
      sessionId,
      messages: [{ role: 'patient', content: greeting }],
      status: 'idle'
    });

    this.startListening();
  },

  async endExam() {
    this.isEnding = true;
    this.stopListening();

    wx.showModal({
      title: '提交考核',
      content: '确认结束对话并提交评分？',
      success: async (res) => {
        if (!res.confirm) {
          this.isEnding = false;
          this.startListening();
          return;
        }

        wx.showLoading({ title: '评分中...' });
        try {
          const result = await request('/exam/submit-voice', {
            method: 'POST',
            data: {
              sessionId: this.data.sessionId,
              patientType: this.data.patient.name,
              conversation: this.data.messages
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
