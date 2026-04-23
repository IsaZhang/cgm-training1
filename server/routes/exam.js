const express = require('express');
const router = express.Router();
const db = require('../db');
const { scoreConversation } = require('../services/scoring');
const { adminAuth } = require('./auth');
const { requireSubUnit } = require('../middleware/subUnit');
const kc = require('../services/knowledgeCatalog');

/** 城市/部门等字段去首尾空格，与管理端下拉选项一致（Excel 导入常见尾随空格） */
function trimEmpField(v) {
  if (v == null) return '';
  return String(v).trim();
}

function buildEmployeeGeoMap(employees) {
  const empMap = {};
  employees.forEach(e => {
    empMap[e.phone] = {
      city: trimEmpField(e.city),
      department: trimEmpField(e.department)
    };
  });
  return empMap;
}

router.post('/submit', requireSubUnit, async (req, res) => {
  const { patient_type, conversation, exam_type } = req.body;
  const userId = req.user.id;
  try {
    const result = await scoreConversation(patient_type, conversation, req.subUnitId);
    const record = {
      id: Date.now().toString(),
      user_id: userId,
      unit_id: req.unitId,
      sub_unit_id: req.subUnitId,
      patient_type,
      exam_type: exam_type || 'text',
      score: result.total,
      passed: result.passed,
      deductions: result.scores,
      dimensions: result.dimensions || [],
      conversation,
      created_at: new Date().toISOString()
    };
    await db.insert('exam_records', record);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: '评分失败：' + e.message });
  }
});

router.post('/submit-voice', requireSubUnit, async (req, res) => {
  const { sessionId, patientType, conversation } = req.body;
  const userId = req.user.id;
  try {
    const result = await scoreConversation(patientType, conversation, req.subUnitId);
    const record = {
      id: Date.now().toString(),
      user_id: userId,
      unit_id: req.unitId,
      sub_unit_id: req.subUnitId,
      session_id: sessionId,
      patient_type: patientType,
      exam_type: 'voice',
      score: result.total,
      passed: result.passed,
      deductions: result.scores,
      dimensions: result.dimensions || [],
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
  const subQ = req.query.sub_unit_id;
  let rows = await db.filter('exam_records', r => r.user_id === req.user.id);
  if (subQ) rows = rows.filter(r => r.sub_unit_id === subQ);
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(rows.map(r => ({
    id: r.id,
    patient_type: r.patient_type,
    score: r.score,
    passed: r.passed,
    deductions: r.deductions,
    exam_type: r.exam_type || (r.session_id && String(r.session_id).startsWith('voice_') ? 'voice' : 'text'),
    created_at: r.created_at,
    unit_id: r.unit_id,
    sub_unit_id: r.sub_unit_id
  })));
});

router.get('/detail/:id', async (req, res) => {
  const row = await db.find('exam_records', r => r.id === req.params.id && r.user_id === req.user.id);
  if (!row) return res.status(404).json({ error: '记录不存在' });
  res.json(row);
});

router.get('/stats', async (req, res) => {
  const userId = req.user.id;
  const subQ = req.query.sub_unit_id;
  let records = await db.filter('exam_records', r => r.user_id === userId);
  if (subQ) records = records.filter(r => r.sub_unit_id === subQ);
  records.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const total = records.length;
  const passed = records.filter(r => r.passed).length;
  const firstPassIdx = records.findIndex(r => r.passed);
  res.json({
    total_exams: total,
    passed,
    first_pass_attempt: firstPassIdx >= 0 ? firstPassIdx + 1 : null
  });
});

function filterRecordsByAdminQuery(records, query) {
  let out = records;
  if (query.sub_unit_id) out = out.filter(r => r.sub_unit_id === query.sub_unit_id);
  if (query.unit_id) out = out.filter(r => r.unit_id === query.unit_id);
  return out;
}

const adminRouter = express.Router();

adminRouter.get('/all-stats', adminAuth, async (req, res) => {
  let records = await db.filter('exam_records', () => true);
  records = filterRecordsByAdminQuery(records, req.query);
  const users = await db.filter('users', () => true);
  const employees = await db.filter('employees', () => true);

  const empMap = buildEmployeeGeoMap(employees);

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
  let records = await db.filter('exam_records', () => true);
  records = filterRecordsByAdminQuery(records, req.query);
  const users = await db.filter('users', () => true);
  const employees = await db.filter('employees', () => true);

  const userMap = {};
  users.forEach(u => { userMap[u.id] = u.name; });

  const empMap = buildEmployeeGeoMap(employees);

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
      created_at: r.created_at,
      unit_id: r.unit_id || '',
      sub_unit_id: r.sub_unit_id || ''
    };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));

  res.json(result);
});

adminRouter.get('/summary-by-subunit', adminAuth, async (req, res) => {
  let records = await db.filter('exam_records', () => true);
  records = filterRecordsByAdminQuery(records, req.query);
  const map = {};
  for (const r of records) {
    const sid = r.sub_unit_id || 'unknown';
    if (!map[sid]) {
      map[sid] = {
        sub_unit_id: sid,
        unit_id: r.unit_id || '',
        total: 0,
        passed: 0,
        sum_score: 0
      };
    }
    map[sid].total++;
    if (r.passed) map[sid].passed++;
    map[sid].sum_score += Number(r.score) || 0;
  }
  const cat = kc.loadCatalog();
  const subMeta = {};
  cat.subunits.forEach(s => { subMeta[s.id] = s.name; });
  const list = Object.values(map).map(x => ({
    ...x,
    sub_unit_name: subMeta[x.sub_unit_id] || x.sub_unit_id,
    pass_rate: x.total > 0 ? Math.round((x.passed / x.total) * 100) : 0,
    avg_score: x.total > 0 ? Math.round((x.sum_score / x.total) * 10) / 10 : 0
  })).sort((a, b) => a.sub_unit_id.localeCompare(b.sub_unit_id));
  res.json(list);
});

module.exports = { router, adminRouter };
