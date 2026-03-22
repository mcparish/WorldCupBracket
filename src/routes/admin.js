'use strict';

const express = require('express');
const { getDb } = require('../db/schema');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).render('error', { message: 'Admin access required.' });
  }
  next();
}

// GET /admin
router.get('/', requireAdmin, (req, res) => {
  const db = getDb();
  const groupMatches = db.prepare(`
    SELECT gm.*, t1.name AS team1_name, t2.name AS team2_name
    FROM   group_matches gm
    JOIN   teams t1 ON t1.id = gm.team1_id
    JOIN   teams t2 ON t2.id = gm.team2_id
    ORDER  BY gm.match_number
  `).all();

  const knockoutMatches = db.prepare(`
    SELECT km.*,
           t1.name AS team1_name,
           t2.name AS team2_name,
           tw.name AS winner_name
    FROM   knockout_matches km
    LEFT JOIN teams t1 ON t1.id = km.team1_id
    LEFT JOIN teams t2 ON t2.id = km.team2_id
    LEFT JOIN teams tw ON tw.id = km.actual_winner_id
    ORDER  BY km.round, km.match_number
  `).all();

  res.render('admin/index', { groupMatches, knockoutMatches });
});

// POST /admin/group/:id/result  – enter actual score
router.post('/group/:id/result', requireAdmin, (req, res) => {
  const { score1, score2 } = req.body;
  const s1 = parseInt(score1, 10);
  const s2 = parseInt(score2, 10);
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
    return res.redirect('/admin?error=invalid');
  }
  const db = getDb();
  db.prepare(
    "UPDATE group_matches SET actual_score1 = ?, actual_score2 = ?, status = 'completed' WHERE id = ?"
  ).run(s1, s2, req.params.id);
  res.redirect('/admin');
});

// POST /admin/group/:id/reset
router.post('/group/:id/reset', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare(
    "UPDATE group_matches SET actual_score1 = NULL, actual_score2 = NULL, status = 'pending' WHERE id = ?"
  ).run(req.params.id);
  res.redirect('/admin');
});

// POST /admin/knockout/setup  – create knockout stage matches from group results
router.post('/knockout/setup', requireAdmin, (req, res) => {
  const db = getDb();

  // Check all group matches are completed
  const pending = db.prepare(
    "SELECT COUNT(*) AS n FROM group_matches WHERE status != 'completed'"
  ).get().n;
  if (pending > 0) {
    return res.redirect('/admin?error=group_not_complete');
  }

  // Create 16 Round of 32 matches (placeholder – admin sets teams manually for now)
  const existing = db.prepare(
    "SELECT COUNT(*) AS n FROM knockout_matches WHERE round = 'Round of 32'"
  ).get().n;
  if (existing === 0) {
    const insert = db.prepare(
      "INSERT OR IGNORE INTO knockout_matches (round, match_number, status) VALUES (?, ?, 'open')"
    );
    const run = db.transaction(() => {
      for (let i = 1; i <= 16; i++) insert.run('Round of 32', i);
      for (let i = 1; i <= 8;  i++) insert.run('Round of 16',  i);
      for (let i = 1; i <= 4;  i++) insert.run('Quarterfinal', i);
      for (let i = 1; i <= 2;  i++) insert.run('Semifinal',    i);
      insert.run('Final', 1);
    });
    run();
  }

  res.redirect('/admin');
});

// POST /admin/knockout/:id/teams  – set the two teams for a knockout match
router.post('/knockout/:id/teams', requireAdmin, (req, res) => {
  const { team1_id, team2_id } = req.body;
  const db = getDb();
  db.prepare(
    "UPDATE knockout_matches SET team1_id = ?, team2_id = ?, status = 'open' WHERE id = ?"
  ).run(parseInt(team1_id, 10) || null, parseInt(team2_id, 10) || null, req.params.id);
  res.redirect('/admin');
});

// POST /admin/knockout/:id/result  – enter winner
router.post('/knockout/:id/result', requireAdmin, (req, res) => {
  const { winner_id } = req.body;
  const db = getDb();
  const match = db.prepare('SELECT * FROM knockout_matches WHERE id = ?').get(req.params.id);
  if (!match) return res.redirect('/admin?error=not_found');
  const wId = parseInt(winner_id, 10);
  if (wId !== match.team1_id && wId !== match.team2_id) {
    return res.redirect('/admin?error=invalid_winner');
  }
  db.prepare(
    "UPDATE knockout_matches SET actual_winner_id = ?, status = 'completed' WHERE id = ?"
  ).run(wId, match.id);
  res.redirect('/admin');
});

// GET /admin/users  – list users, toggle admin
router.get('/users', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at').all();
  res.render('admin/users', { users });
});

router.post('/users/:id/toggle-admin', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (user && user.id !== req.session.userId) {
    const newVal = user.is_admin ? 0 : 1;
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(newVal, user.id);
  }
  res.redirect('/admin/users');
});

module.exports = router;
