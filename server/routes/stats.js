const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取全局统计数据
router.get('/overview', async (req, res) => {
  try {
    const employees = await db.filter('employees', e => e.active !== false);
    const users = await db.filter('users', () => true);
    const examRecords = await db.filter('exam_records', () => true);
    const flashcardProgress = await db.filter('flashcard_progress', () => true);

    res.json({
      total_employees: employees.length,
      total_users: users.length,
      total_exams: examRecords.length,
      total_passed: examRecords.filter(r => r.passed).length,
      avg_score: examRecords.length > 0
        ? (examRecords.reduce((sum, r) => sum + r.score, 0) / examRecords.length).toFixed(2)
        : 0
    });
  } catch (e) {
    res.status(500).json({ error: '统计失败：' + e.message });
  }
});

// 按城市/部门统计
router.get('/by-region', async (req, res) => {
  try {
    const employees = await db.filter('employees', e => e.active !== false);
    const users = await db.filter('users', () => true);
    const examRecords = await db.filter('exam_records', () => true);

    // 构建员工手机号到城市/部门的映射
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.phone] = {
        city: emp.city || '未知',
        department: emp.department || '未知'
      };
    });

    // 按城市分组统计
    const cityStats = {};
    users.forEach(user => {
      const empInfo = employeeMap[user.phone] || { city: '未知', department: '未知' };
      const city = empInfo.city;

      if (!cityStats[city]) {
        cityStats[city] = {
          city,
          employee_count: 0,
          exam_count: 0,
          passed_count: 0,
          total_score: 0,
          practice_count: 0
        };
      }

      cityStats[city].employee_count++;

      // 统计该用户的考核记录
      const userExams = examRecords.filter(r => r.user_id === user.id);
      cityStats[city].exam_count += userExams.length;
      cityStats[city].passed_count += userExams.filter(r => r.passed).length;
      cityStats[city].total_score += userExams.reduce((sum, r) => sum + r.score, 0);
    });

    // 计算平均分
    Object.values(cityStats).forEach(stat => {
      stat.avg_score = stat.exam_count > 0
        ? (stat.total_score / stat.exam_count).toFixed(2)
        : 0;
      delete stat.total_score;
    });

    res.json(Object.values(cityStats));
  } catch (e) {
    res.status(500).json({ error: '统计失败：' + e.message });
  }
});

// 导出所有数据（CSV格式）
router.get('/export', async (req, res) => {
  try {
    const employees = await db.filter('employees', e => e.active !== false);
    const users = await db.filter('users', () => true);
    const examRecords = await db.filter('exam_records', () => true);

    // 构建员工映射
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.phone] = emp;
    });

    // 构建用户映射
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });

    // 生成CSV
    const rows = [];
    rows.push(['姓名', '手机号', '城市', '部门', '考核次数', '通过次数', '最高分', '平均分', '最近考核时间'].join(','));

    users.forEach(user => {
      const emp = employeeMap[user.phone] || {};
      const userExams = examRecords.filter(r => r.user_id === user.id);

      const examCount = userExams.length;
      const passedCount = userExams.filter(r => r.passed).length;
      const maxScore = examCount > 0 ? Math.max(...userExams.map(r => r.score)) : 0;
      const avgScore = examCount > 0
        ? (userExams.reduce((sum, r) => sum + r.score, 0) / examCount).toFixed(2)
        : 0;
      const lastExamTime = examCount > 0
        ? userExams.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
        : '';

      rows.push([
        user.name,
        user.phone,
        emp.city || '未知',
        emp.department || '未知',
        examCount,
        passedCount,
        maxScore,
        avgScore,
        lastExamTime
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=cgm-training-stats.csv');
    res.send('\uFEFF' + rows.join('\n')); // \uFEFF 是 BOM，让 Excel 正确识别 UTF-8
  } catch (e) {
    res.status(500).json({ error: '导出失败：' + e.message });
  }
});

// 获取详细考核记录
router.get('/exam-details', async (req, res) => {
  try {
    const employees = await db.filter('employees', e => e.active !== false);
    const users = await db.filter('users', () => true);
    const examRecords = await db.filter('exam_records', () => true);

    // 构建映射
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.phone] = emp;
    });

    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });

    // 组装详细数据
    const details = examRecords.map(record => {
      const user = userMap[record.user_id] || {};
      const emp = employeeMap[user.phone] || {};

      return {
        name: user.name,
        phone: user.phone,
        city: emp.city || '未知',
        department: emp.department || '未知',
        patient_type: record.patient_type,
        score: record.score,
        passed: record.passed,
        created_at: record.created_at,
        deductions: record.deductions
      };
    });

    res.json(details);
  } catch (e) {
    res.status(500).json({ error: '查询失败：' + e.message });
  }
});

module.exports = router;
