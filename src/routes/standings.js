'use strict';

const express = require('express');
const { getDb } = require('../db/schema');

const router = express.Router();

// Points per round
const ROUND_POINTS = {
  'group':        { outcome: 1, exact: 2 },
  'Round of 32':  { correct: 2 },
  'Round of 16':  { correct: 4 },
  'Quarterfinal': { correct: 8 },
  'Semifinal':    { correct: 16 },
  'Final':        { correct: 32 },
};

// GET /standings
router.get('/', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username FROM users ORDER BY username').all();
  const brackets = db.prepare('SELECT * FROM brackets ORDER BY user_id, name').all();
  const completedGroupMatches = db.prepare(
    "SELECT * FROM group_matches WHERE status = 'completed'"
  ).all();
  const completedKnockoutMatches = db.prepare(
    "SELECT * FROM knockout_matches WHERE status = 'completed' AND actual_winner_id IS NOT NULL"
  ).all();

  const standings = [];

  for (const b of brackets) {
    let groupPoints    = 0;
    let knockoutPoints = 0;

    // Group stage scoring
    for (const m of completedGroupMatches) {
      const pick = db.prepare(
        'SELECT * FROM group_picks WHERE bracket_id = ? AND match_id = ?'
      ).get(b.id, m.id);
      if (!pick) continue;

      const actualOutcome = Math.sign(m.actual_score1 - m.actual_score2);
      const pickedOutcome = Math.sign(pick.predicted_score1 - pick.predicted_score2);

      if (pick.predicted_score1 === m.actual_score1 && pick.predicted_score2 === m.actual_score2) {
        groupPoints += ROUND_POINTS.group.exact;
      } else if (actualOutcome === pickedOutcome) {
        groupPoints += ROUND_POINTS.group.outcome;
      }
    }

    // Knockout scoring
    for (const m of completedKnockoutMatches) {
      const pick = db.prepare(
        'SELECT * FROM knockout_picks WHERE bracket_id = ? AND match_id = ?'
      ).get(b.id, m.id);
      if (!pick) continue;

      if (pick.predicted_winner_id === m.actual_winner_id) {
        knockoutPoints += (ROUND_POINTS[m.round] || { correct: 0 }).correct;
      }
    }

    const owner = users.find(u => u.id === b.user_id);
    standings.push({
      bracketId:    b.id,
      bracketName:  b.name,
      username:     owner ? owner.username : 'Unknown',
      groupPoints,
      knockoutPoints,
      totalPoints:  groupPoints + knockoutPoints,
    });
  }

  // Sort by total points descending
  standings.sort((a, b) => b.totalPoints - a.totalPoints);

  res.render('standings', { standings });
});

module.exports = router;
