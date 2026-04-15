const express = require('express');
const db = require('../db');
const kc = require('../services/knowledgeCatalog');

const router = express.Router();

router.get('/me', async (req, res) => {
  try {
    const data = await kc.buildKnowledgeTreeForPhone(req.user.phone, db);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '获取知识目录失败' });
  }
});

module.exports = router;
