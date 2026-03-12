const { request } = require('../../utils/api');
const plugin = requirePlugin("WechatSI");

Page({
  data: {
    patient: null,
    started: false,
    status: 'idle', // idle, listening, processing, speaking
    messages: [],
    sessionId: null
  },

  recognitionManager: null,
  innerAudioContext: null,
  isRecording: false,
  recognizedText: '',

  onLoad() {
    this.recognitionManager = plugin.getRecordRecognitionManager();
    this.innerAudioContext = wx.createInnerAudioContext();
    this.setupRecognition();
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

  setupRecognition() {
    this.recognitionManager.onStart = () => {
      this.isRecording = true;
      this.recognizedText = '';
      this.setData({ status: 'listening' });
    };

    this.recognitionManager.onRecognize = (res) => {
      // 实时识别结果
      this.recognizedText = res.result;
    };

    this.recognitionManager.onStop = (res) => {
      this.isRecording = false;
      const finalText = res.result || this.recognizedText;
      if (finalText) {
        this.processRecognizedText(finalText);
      }
    };

    this.recognitionManager.onError = (err) => {
      console.error('识别错误:', err);
      wx.showToast({ title: '识别失败', icon: 'none' });
      this.setData({ status: 'idle' });
      this.startListening();
    };
  },

  async processRecognizedText(userText) {
    this.setData({ status: 'processing' });

    try {
      if (!userText || userText.trim() === '') {
        throw new Error('未识别到语音内容');
      }

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

      // 播放AI语音回复
      if (aiRes.audioUrl) {
        await this.playAudio(aiRes.audioUrl);
      } else {
        await this.sleep(2000);
      }

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
      this.recognitionManager.start({
        lang: 'zh_CN',
        duration: 60000
      });
    }
  },

  stopListening() {
    if (this.isRecording) {
      this.recognitionManager.stop();
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
