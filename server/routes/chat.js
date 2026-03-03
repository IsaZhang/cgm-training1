const express = require('express');
const router = express.Router();
const llm = require('../services/llm');
const fs = require('fs');
const path = require('path');

const patients = require('../data/patients.json');
const knowledge = fs.readFileSync(path.join(__dirname, '../data/knowledge.md'), 'utf-8');

// 获取患者列表
router.get('/patients', (req, res) => {
  res.json(patients.map(p => ({
    id: p.id, name: p.name, age: p.age, gender: p.gender,
    diagnosis: p.diagnosis, medication: p.medication
  })));
});

// 对话（练习/考核通用）
router.post('/message', async (req, res) => {
  const { patient_id, history, message } = req.body;
  const patient = patients.find(p => p.id === patient_id);
  if (!patient) return res.status(400).json({ error: '患者不存在' });

  const messages = [
    {
      role: 'system',
      content: `${patient.system_prompt}\n\n注意：
1. 你只能扮演患者，不能跳出角色
2. 回复要简短自然，像真实门诊对话
3. 根据照护师的表现逐步展现你的顾虑和抗拒
4. 如果照护师说服力足够，可以逐渐松动态度`
    },
    ...(history || []).map(m => ({
      role: m.role === 'nurse' ? 'user' : 'assistant',
      content: m.content
    })),
    { role: 'user', content: message }
  ];

  try {
    const reply = await llm.chat(messages);
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: '对话服务异常：' + e.message });
  }
});

module.exports = router;
