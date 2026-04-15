const express = require('express');
const router = express.Router();
const llm = require('../services/llm');
const voiceService = require('../services/voice');
const kc = require('../services/knowledgeCatalog');
const { requireSubUnit } = require('../middleware/subUnit');

const sessionStore = require('../services/voiceSessionStore');

router.post('/recognize', async (req, res) => {
  const { fileId } = req.body;

  try {
    const text = await recognizeSpeech(fileId);
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: '语音识别失败：' + e.message });
  }
});

router.post('/chat', requireSubUnit, async (req, res) => {
  const { sessionId, patientId, history, message } = req.body;
  const patients = kc.loadPatientsForSubUnit(req.subUnitId);
  const patient = patients.find(p => p.id === patientId);

  if (!patient) return res.status(400).json({ error: '患者不存在' });

  try {
    const safeHistory = Array.isArray(history) ? history : [];
    const messages = [
      { role: 'system', content: patient.system_prompt },
      ...safeHistory.map(m => ({
        role: m.role === 'nurse' ? 'user' : 'assistant',
        content: m.content
      })),
      ...(message ? [{ role: 'user', content: message }] : [])
    ];

    const reply = await llm.chat(messages);

    const audioUrl = await textToSpeech(reply);

    sessionStore.set(sessionId, {
      patientId,
      subUnitId: req.subUnitId,
      history: [...safeHistory, { role: 'patient', content: reply }]
    });

    res.json({ reply, audioUrl, sessionId });
  } catch (e) {
    res.status(500).json({ error: '对话失败：' + e.message });
  }
});

router.post('/tts', async (req, res) => {
  const { text } = req.body;
  try {
    const audioUrl = await textToSpeech(text);
    res.json({ audioUrl });
  } catch (e) {
    res.status(500).json({ error: 'TTS失败：' + e.message });
  }
});

async function recognizeSpeech(fileId) {
  return await voiceService.recognizeSpeech(fileId);
}

async function textToSpeech(text) {
  return await voiceService.textToSpeech(text);
}

module.exports = router;
