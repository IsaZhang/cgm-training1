const express = require('express');
const router = express.Router();
const db = require('../db');
const flashcards = require('../data/flashcards.json');

router.get('/list', (req, res) => {
  const categories = {};
  flashcards.forEach(card => {
    if (!categories[card.category]) categories[card.category] = [];
    categories[card.category].push(card);
  });
  res.json(categories);
});

router.post('/progress', async (req, res) => {
  const { card_id, mastered } = req.body;
  const userId = req.user.id;
  await db.upsert('flashcard_progress',
    r => r.user_id === userId && r.card_id === card_id,
    { user_id: userId, card_id, mastered, last_review: new Date().toISOString() }
  );
  res.json({ ok: true });
});

router.get('/progress', async (req, res) => {
  const rows = await db.filter('flashcard_progress', r => r.user_id === req.user.id);
  const map = {};
  rows.forEach(r => { map[r.card_id] = r; });
  res.json({ total: flashcards.length, progress: map });
});

module.exports = router;
