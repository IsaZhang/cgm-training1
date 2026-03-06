const { request } = require('../../utils/api');

Page({
  data: {
    patient: null,
    started: false,
    status: 'idle', // idle, listening, processing, speaking
    messages: [],
    sessionId: null
  },

  recorderManager: null,
  innerAudioContext: null,
  isRecording: false,
  autoStopTimer: null,

  onLoad() {
    this.recorderManager = wx.getRecorderManager();
    this.innerAudioContext = wx.createInnerAudioContext();
    this.setupRecorder();
    this.loadRandomPatient();
  },

  onUnload() {
    this.stopListening();
    if (this.innerAudioContext) this.innerAudioContext.destroy();
  },

  async loadRandomPatient() {
    const patients = await request('/chat/patients');
    const patient = patients[Math.floor(Math.random() * patients.length)];
    this.setData({ patient });
  },

  setupRecorder() {
    this.recorderManager.onStart(() => {
      this.isRecording = true;
      this.audioBuffer = [];
      this.setData({ status: 'listening' });

      // 简化方案：3秒后自动停止录音
      this.autoStopTimer = setTimeout(() => {
        if (this.isRecording) {
          this.recorderManager.stop();
        }
      }, 5000);
    });

    this.recorderManager.onStop((res) => {
      this.isRecording = false;
      if (this.autoStopTimer) {
        clearTimeout(this.autoStopTimer);
        this.autoStopTimer = null;
      }
      if (res.tempFilePath) {
        this.processAudio(res.tempFilePath);
      }
    });

    this.recorderManager.onError((err) => {
      console.error('录音错误:', err);
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ status: 'idle' });
      this.startListening();
    });
  },

  async processAudio(filePath) {
    this.setData({ status: 'processing' });

    try {
      // 模拟语音识别（照护师说的话）
      const userText = '您好，我看到您的检查报告，糖化血红蛋白有点高，您平时有监测血糖吗？';
      const messages = [...this.data.messages, { role: 'nurse', content: userText }];
      this.setData({ messages });

      // 获取AI回复
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

      // 模拟播放AI语音（实际需要播放真实音频）
      await this.sleep(2000);

      // 继续监听
      this.setData({ status: 'idle' });
      this.startListening();
    } catch (e) {
      console.error('处理失败:', e);
      wx.showToast({ title: '处理失败', icon: 'none' });
      this.setData({ status: 'idle' });
      this.startListening();
    }
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  playAudio(url) {
    return new Promise((resolve) => {
      this.innerAudioContext.src = url;
      this.innerAudioContext.onEnded(() => resolve());
      this.innerAudioContext.onError(() => resolve());
      this.innerAudioContext.play();
    });
  },

  startListening() {
    if (!this.isRecording) {
      this.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
        frameSize: 10
      });
    }
  },

  stopListening() {
    if (this.isRecording) {
      this.recorderManager.stop();
    }
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
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

    // 模拟模式：跳过音频播放，直接开始监听
    this.startListening();
  },

  async endExam() {
    this.stopListening();

    wx.showModal({
      title: '提交考核',
      content: '确认结束对话并提交评分？',
      success: async (res) => {
        if (!res.confirm) {
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
