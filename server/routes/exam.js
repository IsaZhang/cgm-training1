const express = require('express');
const router = express.Router();
const db = require('../db');
const { scoreConversation } = require('../services/scoring');

router.post('/submit', async (req, res) => {
  const { patient_type, conversation, exam_type } = req.body;
  const userId = req.user.id;
  try {
    const result = await scoreConversation(patient_type, conversation);
    const record = {
      id: Date.now().toString(),
      user_id: userId,
      patient_type,
      exam_type: exam_type || 'text',
      score: result.total,
      passed: result.passed,
      deductions: result.scores,
      conversation,
      created_at: new Date().toISOString()
    };
    await db.insert('exam_records', record);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: '评分失败：' + e.message });
  }
});

router.post('/submit-voice', async (req, res) => {
  const { sessionId, patientType, conversation } = req.body;
  const userId = req.user.id;
  try {
    const result = await scoreConversation(patientType, conversation);
    const record = {
      id: Date.now().toString(),
      user_id: userId,
      session_id: sessionId,
      patient_type: patientType,
      exam_type: 'voice',
      score: result.total,
      passed: result.passed,
      deductions: result.scores,
      conversation,
      created_at: new Date().toISOString()
    };
    await db.insert('exam_records', record);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: '评分失败：' + e.message });
  }
});

router.get('/history', async (req, res) => {
  const rows = await db.filter('exam_records', r => r.user_id === req.user.id);
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(rows.map(r => ({
    id: r.id, patient_type: r.patient_type, score: r.score,
    passed: r.passed, deductions: r.deductions, created_at: r.created_at
  })));
});

router.get('/detail/:id', async (req, res) => {
  const row = await db.find('exam_records', r => r.id === req.params.id && r.user_id === req.user.id);
  if (!row) return res.status(404).json({ error: '记录不存在' });
  res.json(row);
});

router.get('/stats', async (req, res) => {
  const userId = req.user.id;
  const records = await db.filter('exam_records', r => r.user_id === userId);
  records.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const total = records.length;
  const passed = records.filter(r => r.passed).length;
  const firstPassIdx = records.findIndex(r => r.passed);
  res.json({
    total_exams: total, passed,
    first_pass_attempt: firstPassIdx >= 0 ? firstPassIdx + 1 : null
  });
});

module.exports = router;
