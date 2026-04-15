const express = require('express');
const router = express.Router();
const db = require('../db');
const kc = require('../services/knowledgeCatalog');
const { requireSubUnit } = require('../middleware/subUnit');

/**
 * 闪卡数据来自「知识单元」全量题库；进度按 unit_id 存储，同一单元下多子单元共用一套进度。
 * 仍要求 x-sub-unit-id：用于鉴权（员工是否被授权进入该子单元场景），并解析出 unitId。
 */
router.get('/list', requireSubUnit, (req, res) => {
  try {
    const flashcards = kc.loadFlashcardsForUnit(req.unitId);
    const categories = {};
    flashcards.forEach(card => {
      if (!categories[card.category]) categories[card.category] = [];
      categories[card.category].push(card);
    });
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: e.message || '加载闪卡失败' });
  }
});

router.post('/progress', requireSubUnit, async (req, res) => {
  const { card_id, mastered } = req.body;
  const userId = req.user.id;
  const unitId = req.unitId;
  await db.upsert(
    'flashcard_progress',
    r => r.user_id === userId && r.card_id === card_id && r.unit_id === unitId,
    {
      user_id: userId,
      card_id,
      unit_id: unitId,
      mastered,
      last_review: new Date().toISOString()
    }
  );
  res.json({ ok: true });
});

router.get('/progress', requireSubUnit, async (req, res) => {
  const rows = await db.filter(
    'flashcard_progress',
    r => r.user_id === req.user.id && r.unit_id === req.unitId
  );
  const map = {};
  rows.forEach(r => { map[r.card_id] = r; });
  const flashcards = kc.loadFlashcardsForUnit(req.unitId);
  res.json({ total: flashcards.length, progress: map, scope: 'unit' });
});

module.exports = router;
