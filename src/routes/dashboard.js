'use strict';

const express = require('express');
const { getDb } = require('../db/schema');

const router = express.Router();

// Middleware: require login
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/auth/login');
  next();
}

// GET /dashboard
router.get('/', requireLogin, (req, res) => {
  const db = getDb();
  const brackets = db.prepare(
    'SELECT * FROM brackets WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.session.userId);

  // Count picks per bracket
  const bracketData = brackets.map(b => {
    const pickCount = db.prepare(
      'SELECT COUNT(*) AS n FROM group_picks WHERE bracket_id = ?'
    ).get(b.id).n;
    const totalMatches = db.prepare('SELECT COUNT(*) AS n FROM group_matches').get().n;
    return { ...b, pickCount, totalMatches };
  });

  res.render('dashboard', { brackets: bracketData });
});

// POST /dashboard/create
router.post('/create', requireLogin, (req, res) => {
  const { name } = req.body;
  const bracketName = (name || '').trim() || `Bracket ${Date.now()}`;
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO brackets (user_id, name) VALUES (?, ?)'
  ).run(req.session.userId, bracketName);
  res.redirect(`/bracket/${result.lastInsertRowid}/group`);
});

// POST /dashboard/delete/:id
router.post('/delete/:id', requireLogin, (req, res) => {
  const db = getDb();
  const bracket = db.prepare(
    'SELECT * FROM brackets WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.session.userId);
  if (bracket) {
    db.prepare('DELETE FROM brackets WHERE id = ?').run(bracket.id);
  }
  res.redirect('/dashboard');
});

module.exports = router;
