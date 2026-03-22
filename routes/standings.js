const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { KNOCKOUT_POINTS, calcGroupPickPoints } = require('../utils/constants');

// GET /standings
router.get('/standings', (req, res) => {
  // Get all brackets with user info
  const brackets = db.prepare(`
    SELECT b.id AS bracket_id, b.name AS bracket_name, b.user_id,
           u.username
    FROM brackets b
    JOIN users u ON u.id = b.user_id
    ORDER BY u.username, b.name
  `).all();

  const rows = [];

  for (const bracket of brackets) {
    // --- Group stage scoring ---
    const groupPicks = db.prepare(`
      SELECT gp.home_score_pick, gp.away_score_pick,
             gm.home_score, gm.away_score, gm.played
      FROM group_picks gp
      JOIN group_matches gm ON gm.id = gp.match_id
      WHERE gp.bracket_id = ?
    `).all(bracket.bracket_id);

    let groupPoints = 0;
    for (const pick of groupPicks) {
      if (!pick.played || pick.home_score === null || pick.away_score === null) continue;
      groupPoints += calcGroupPickPoints(
        pick.home_score, pick.away_score,
        pick.home_score_pick, pick.away_score_pick
      );
    }

    // --- Knockout stage scoring ---
    const knockoutPicks = db.prepare(`
      SELECT kp.picked_winner_id,
             km.winner_team_id, km.played, km.round
      FROM knockout_picks kp
      JOIN knockout_matches km ON km.id = kp.knockout_match_id
      WHERE kp.bracket_id = ?
    `).all(bracket.bracket_id);

    let knockoutPoints = 0;
    for (const pick of knockoutPicks) {
      if (!pick.played || !pick.winner_team_id) continue;
      if (pick.picked_winner_id === pick.winner_team_id) {
        knockoutPoints += KNOCKOUT_POINTS[pick.round] || 0;
      }
    }

    rows.push({
      bracket_id: bracket.bracket_id,
      bracket_name: bracket.bracket_name,
      username: bracket.username,
      groupPoints,
      knockoutPoints,
      total: groupPoints + knockoutPoints
    });
  }

  // Sort by total descending
  rows.sort((a, b) => b.total - a.total);

  res.render('standings', {
    title: 'Standings',
    rows
  });
});

module.exports = router;
