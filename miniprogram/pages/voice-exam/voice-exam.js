const { request } = require('../../utils/api');
const plugin = requirePlugin('WechatSI');

Page({
  data: {
    patients: [],
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
  recoverTimer: null,

  onLoad() {
    this.recordManager = plugin.getRecordRecognitionManager();
    this.innerAudioContext = wx.createInnerAudioContext();
    this.setupRecorder();
    this.loadPatients();
  },

  onHide() {
    this.isEnding = true;
    this.stopListening();
  },

  onUnload() {
    this.isEnding = true;
    this.stopListening();
    this.clearRecoverTimer();
    if (this.innerAudioContext) this.innerAudioContext.destroy();
  },

  async loadPatients() {
    const patients = await request('/chat/patients');
    this.setData({ patients });
  },

  selectPatient(e) {
    const id = e.currentTarget.dataset.id;
    const patient = this.data.patients.find(x => x.id === id);
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
      console.error('录音错误:', res);
      that.handleRecordError(res);
      that.setData({ status: 'idle' });
    };
  },

  async ensureRecordPermission() {
    try {
      const setting = await new Promise((resolve, reject) => {
        wx.getSetting({
          success: resolve,
          fail: reject
        });
      });

      if (setting.authSetting['scope.record']) {
        return true;
      }

      try {
        await new Promise((resolve, reject) => {
          wx.authorize({
            scope: 'scope.record',
            success: resolve,
            fail: reject
          });
        });
        return true;
      } catch (e) {
        return await this.promptRecordPermission();
      }
    } catch (e) {
      console.error('检查录音权限失败:', e);
      wx.showToast({ title: '暂时无法录音', icon: 'none' });
      return false;
    }
  },

  promptRecordPermission() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '需要开启麦克风',
        content: '语音考核要先打开麦克风权限。点“去开启”后允许使用麦克风，再回来继续。',
        confirmText: '去开启',
        success: (res) => {
          if (!res.confirm) {
            resolve(false);
            return;
          }
          wx.openSetting({
            success: (settingRes) => {
              resolve(!!settingRes.authSetting['scope.record']);
            },
            fail: () => resolve(false)
          });
        },
        fail: () => resolve(false)
      });
    });
  },

  isPermissionError(message) {
    const text = String(message || '').toLowerCase();
    return text.includes('auth deny') ||
      text.includes('permission') ||
      text.includes('denied') ||
      text.includes('authorize') ||
      text.includes('scope.record');
  },

  handleRecordError(res) {
    const message = res && res.msg;
    const normalizedMessage = String(message || '').toLowerCase();

    if (this.isPermissionError(message)) {
      this.promptRecordPermission();
      return;
    }

    if (normalizedMessage.includes('please wait recognition finished')) {
      wx.showToast({ title: '正在识别刚才的语音，请稍等', icon: 'none' });
      this.scheduleRecoverListening(1500);
      return;
    }

    if (normalizedMessage.includes('record manager record failed')) {
      wx.showToast({ title: '没录上声音，请重试', icon: 'none' });
      this.startListening();
      return;
    }

    wx.showToast({ title: '录音没成功，请重试', icon: 'none' });
    this.startListening();
  },

  clearRecoverTimer() {
    if (this.recoverTimer) {
      clearTimeout(this.recoverTimer);
      this.recoverTimer = null;
    }
  },

  scheduleRecoverListening(delay = 1000) {
    this.clearRecoverTimer();
    this.recoverTimer = setTimeout(() => {
      this.recoverTimer = null;
      if (this.isEnding) return;
      if (!this.data.started || !this.data.patient) return;
      if (this.data.status === 'speaking' || this.data.status === 'processing') return;
      this.startListening();
    }, delay);
  },

  getFriendlyErrorMessage(error) {
    const text = String(
      (error && (error.msg || error.errMsg || error.message)) || ''
    ).toLowerCase();

    if (!text) return '操作没成功，请重试';
    if (this.isPermissionError(text)) return '需要打开麦克风才能继续';
    if (text.includes('please wait recognition finished')) return '正在识别刚才的语音，请稍等';
    if (text.includes('record manager record failed')) return '没录上声音，请重试';
    if (text.includes('start record failed')) return '录音没开始成功，请重试';
    if (text.includes('operate too frequent')) return '操作太快了，请稍等一下再试';
    if (text.includes('audio is playing')) return '正在播放语音，请等播放完再说';
    if (text.includes('interrupted')) return '录音被打断了，请再说一遍';
    if (text.includes('network')) return '网络有点不稳定，请稍后再试';
    if (text.includes('timeout')) return '等待时间有点久，请重试';
    if (text.includes('recognition')) return '语音还在识别中，请稍等';

    return '操作没成功，请重试';
  },

  async processAudio(userText) {
    try {
      const messages = [...this.data.messages, { role: 'nurse', content: userText }];
      this.setData({ messages });

      this.setData({ status: 'speaking' });
      const aiRes = await request('/voice/chat', {
        method: 'POST',
        timeout: 30000,
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
      wx.showToast({ title: this.getFriendlyErrorMessage(e) || '处理失败', icon: 'none' });
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
    this.clearRecoverTimer();
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
      wx.showToast({ title: this.getFriendlyErrorMessage(e) || '启动录音失败', icon: 'none' });
      this.setData({ status: 'idle' });
    }
  },

  stopListening() {
    this.clearRecoverTimer();
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
    const hasPermission = await this.ensureRecordPermission();
    if (!hasPermission) return;

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
