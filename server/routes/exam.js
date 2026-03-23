const express = require('express');
const router = express.Router();
const db = require('../db');
const { scoreConversation } = require('../services/scoring');
const { adminAuth } = require('./auth');

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
    passed: r.passed,
    deductions: r.deductions,
    exam_type: r.exam_type || (r.session_id && String(r.session_id).startsWith('voice_') ? 'voice' : 'text'),
    created_at: r.created_at
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

// 管理员路由（单独挂载，不经过 auth）
const adminRouter = express.Router();
adminRouter.get('/all-stats', adminAuth, async (req, res) => {
  const records = await db.filter('exam_records', () => true);
  const users = await db.filter('users', () => true);
  const employees = await db.filter('employees', () => true);

  const empMap = {};
  employees.forEach(e => {
    empMap[e.phone] = { city: e.city, department: e.department };
  });

  const userStats = {};
  users.forEach(u => {
    const empInfo = empMap[u.phone] || {};
    userStats[u.id] = {
      id: u.id,
      name: u.name,
      phone: u.phone,
      city: empInfo.city || '-',
      department: empInfo.department || '-',
      total: 0,
      passed: 0,
      voicePassedCases: new Set(),
      latestVoiceExamAt: null
    };
  });

  records.forEach(r => {
    if (userStats[r.user_id]) {
      userStats[r.user_id].total++;
      if (r.passed) userStats[r.user_id].passed++;
      if (r.exam_type === 'voice' && r.score >= 80) {
        userStats[r.user_id].voicePassedCases.add(r.patient_type);
      }
      if (r.exam_type === 'voice') {
        const currentLatest = userStats[r.user_id].latestVoiceExamAt;
        if (!currentLatest || r.created_at > currentLatest) {
          userStats[r.user_id].latestVoiceExamAt = r.created_at;
        }
      }
    }
  });

  const result = Object.values(userStats).map(u => ({
    id: u.id,
    name: u.name,
    city: u.city,
    department: u.department,
    total: u.total,
    passed: u.passed,
    pass_rate: u.total > 0 ? Math.round((u.passed / u.total) * 100) : 0,
    voice_passed_cases: u.voicePassedCases.size,
    latest_voice_exam_at: u.latestVoiceExamAt
  })).filter(u => u.total > 0)
    .sort((a, b) => {
      if (a.latest_voice_exam_at && b.latest_voice_exam_at) {
        return b.latest_voice_exam_at.localeCompare(a.latest_voice_exam_at);
      }
      if (a.latest_voice_exam_at) return -1;
      if (b.latest_voice_exam_at) return 1;
      return b.total - a.total;
    });

  res.json(result);
});
adminRouter.get('/all-records', adminAuth, async (req, res) => {
  const records = await db.filter('exam_records', () => true);
  const users = await db.filter('users', () => true);
  const employees = await db.filter('employees', () => true);

  const userMap = {};
  users.forEach(u => userMap[u.id] = u.name);

  const empMap = {};
  employees.forEach(e => empMap[e.phone] = { city: e.city, department: e.department });

  const result = records.map(r => {
    const userName = userMap[r.user_id] || '未知';
    const user = users.find(u => u.id === r.user_id);
    const empInfo = user ? empMap[user.phone] : null;

    return {
      id: r.id,
      user_name: userName,
      city: empInfo?.city || '-',
      department: empInfo?.department || '-',
      patient_type: r.patient_type,
      exam_type: r.exam_type,
      score: r.score,
      passed: r.passed,
      created_at: r.created_at
    };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));

  res.json(result);
});

module.exports = { router, adminRouter };
