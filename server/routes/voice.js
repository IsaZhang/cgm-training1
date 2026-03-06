const express = require('express');
const router = express.Router();
const llm = require('../services/llm');
const voiceService = require('../services/voice');
const patients = require('../data/patients.json');

// 存储会话上下文
const sessions = new Map();

// 语音识别接口
router.post('/recognize', async (req, res) => {
  const { fileId } = req.body;

  try {
    // 调用阿里云语音识别服务
    const text = await recognizeSpeech(fileId);
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: '语音识别失败：' + e.message });
  }
});

// 语音对话接口
router.post('/chat', async (req, res) => {
  const { sessionId, patientId, history, message } = req.body;
  const patient = patients.find(p => p.id === patientId);

  if (!patient) return res.status(400).json({ error: '患者不存在' });

  try {
    // 构建对话消息
    const messages = [
      { role: 'system', content: patient.system_prompt },
      ...(history || []).map(m => ({
        role: m.role === 'nurse' ? 'user' : 'assistant',
        content: m.content
      }))
    ];

    // 获取AI回复
    const reply = await llm.chat(messages);

    // 生成语音
    const audioUrl = await textToSpeech(reply);

    // 保存会话
    sessions.set(sessionId, { patientId, history: [...history, { role: 'patient', content: reply }] });

    res.json({ reply, audioUrl, sessionId });
  } catch (e) {
    res.status(500).json({ error: '对话失败：' + e.message });
  }
});

// 文字转语音接口
router.post('/tts', async (req, res) => {
  const { text } = req.body;
  try {
    const audioUrl = await textToSpeech(text);
    res.json({ audioUrl });
  } catch (e) {
    res.status(500).json({ error: 'TTS失败：' + e.message });
  }
});

// 语音识别实现（使用阿里云）
async function recognizeSpeech(fileId) {
  return await voiceService.recognizeSpeech(fileId);
}

// 文字转语音实现（使用阿里云）
async function textToSpeech(text) {
  return await voiceService.textToSpeech(text);
}

module.exports = router;
