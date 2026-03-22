'use strict';

const express = require('express');
const { getDb } = require('../db/schema');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/auth/login');
  next();
}

// Helper: verify bracket belongs to logged-in user
function getBracket(req, res) {
  const db = getDb();
  const bracket = db.prepare(
    'SELECT * FROM brackets WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.session.userId);
  if (!bracket) {
    res.status(404).render('error', { message: 'Bracket not found.' });
    return null;
  }
  return bracket;
}

// GET /bracket/:id/group  – show group stage picks form
router.get('/:id/group', requireLogin, (req, res) => {
  const bracket = getBracket(req, res);
  if (!bracket) return;

  const db = getDb();
  const matches = db.prepare(`
    SELECT gm.*,
           t1.name AS team1_name,
           t2.name AS team2_name
    FROM   group_matches gm
    JOIN   teams t1 ON t1.id = gm.team1_id
    JOIN   teams t2 ON t2.id = gm.team2_id
    ORDER  BY gm.match_number
  `).all();

  // Current picks
  const picks = db.prepare(
    'SELECT * FROM group_picks WHERE bracket_id = ?'
  ).all(bracket.id);
  const pickMap = {};
  for (const p of picks) pickMap[p.match_id] = p;

  // Group matches by group letter
  const groups = {};
  for (const m of matches) {
    if (!groups[m.group_letter]) groups[m.group_letter] = [];
    groups[m.group_letter].push({ ...m, pick: pickMap[m.id] || null });
  }

  res.render('bracket/group', { bracket, groups });
});

// POST /bracket/:id/group  – save group stage picks
router.post('/:id/group', requireLogin, (req, res) => {
  const bracket = getBracket(req, res);
  if (!bracket) return;

  const db = getDb();
  const matches = db.prepare('SELECT id FROM group_matches').all();

  const upsert = db.prepare(`
    INSERT INTO group_picks (bracket_id, match_id, predicted_score1, predicted_score2)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(bracket_id, match_id)
    DO UPDATE SET predicted_score1 = excluded.predicted_score1,
                  predicted_score2 = excluded.predicted_score2
  `);

  const save = db.transaction(() => {
    for (const m of matches) {
      const s1 = parseInt(req.body[`score1_${m.id}`], 10);
      const s2 = parseInt(req.body[`score2_${m.id}`], 10);
      if (!isNaN(s1) && !isNaN(s2) && s1 >= 0 && s2 >= 0) {
        upsert.run(bracket.id, m.id, s1, s2);
      }
    }
  });
  save();

  res.redirect(`/bracket/${bracket.id}/group?saved=1`);
});

// GET /bracket/:id/knockout  – show knockout picks form
router.get('/:id/knockout', requireLogin, (req, res) => {
  const bracket = getBracket(req, res);
  if (!bracket) return;

  const db = getDb();
  const rounds = ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];
  const matchesByRound = {};
  for (const round of rounds) {
    const ms = db.prepare(`
      SELECT km.*,
             t1.name AS team1_name,
             t2.name AS team2_name
      FROM   knockout_matches km
      LEFT JOIN teams t1 ON t1.id = km.team1_id
      LEFT JOIN teams t2 ON t2.id = km.team2_id
      WHERE  km.round = ? AND km.status != 'locked'
      ORDER  BY km.match_number
    `).all(round);
    if (ms.length) matchesByRound[round] = ms;
  }

  const picks = db.prepare(
    'SELECT * FROM knockout_picks WHERE bracket_id = ?'
  ).all(bracket.id);
  const pickMap = {};
  for (const p of picks) pickMap[p.match_id] = p;

  const noRoundsOpen = Object.keys(matchesByRound).length === 0;

  res.render('bracket/knockout', { bracket, matchesByRound, pickMap, rounds, noRoundsOpen });
});

// POST /bracket/:id/knockout – save knockout picks
router.post('/:id/knockout', requireLogin, (req, res) => {
  const bracket = getBracket(req, res);
  if (!bracket) return;

  const db = getDb();
  const matches = db.prepare(
    "SELECT * FROM knockout_matches WHERE status != 'locked'"
  ).all();

  const upsert = db.prepare(`
    INSERT INTO knockout_picks (bracket_id, match_id, predicted_winner_id)
    VALUES (?, ?, ?)
    ON CONFLICT(bracket_id, match_id)
    DO UPDATE SET predicted_winner_id = excluded.predicted_winner_id
  `);

  const save = db.transaction(() => {
    for (const m of matches) {
      const winnerId = parseInt(req.body[`winner_${m.id}`], 10);
      if (!isNaN(winnerId) && winnerId > 0) {
        // Ensure chosen team is one of the two
        if (winnerId === m.team1_id || winnerId === m.team2_id) {
          upsert.run(bracket.id, m.id, winnerId);
        }
      }
    }
  });
  save();

  res.redirect(`/bracket/${bracket.id}/knockout?saved=1`);
});

module.exports = router;
