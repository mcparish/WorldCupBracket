const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');

// GET /dashboard
router.get('/dashboard', requireLogin, (req, res) => {
  const brackets = db.prepare(
    'SELECT * FROM brackets WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.session.userId);

  const groupStageComplete = db.prepare(
    "SELECT value FROM settings WHERE key = 'group_stage_complete'"
  ).get();

  res.render('dashboard', {
    title: 'My Brackets',
    brackets,
    groupStageComplete: groupStageComplete ? groupStageComplete.value === '1' : false
  });
});

// GET /brackets/new
router.get('/brackets/new', requireLogin, (req, res) => {
  res.render('bracket-new', { title: 'Create New Bracket' });
});

// POST /brackets
router.post('/brackets', requireLogin, (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    req.session.flash = { type: 'danger', message: 'Bracket name is required.' };
    return res.redirect('/brackets/new');
  }

  try {
    const result = db.prepare(
      'INSERT INTO brackets (user_id, name) VALUES (?, ?)'
    ).run(req.session.userId, name.trim());

    req.session.flash = { type: 'success', message: `Bracket "${name.trim()}" created!` };
    res.redirect(`/brackets/${result.lastInsertRowid}/group-picks`);
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Failed to create bracket.' };
    res.redirect('/brackets/new');
  }
});

module.exports = router;
