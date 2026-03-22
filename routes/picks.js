const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const { ROUNDS, ROUND_LABELS, MAX_SCORE } = require('../utils/constants');

// Helper: verify bracket belongs to logged-in user
function ownsBracket(bracketId, userId) {
  const bracket = db.prepare('SELECT id FROM brackets WHERE id = ? AND user_id = ?').get(bracketId, userId);
  return !!bracket;
}

// GET /brackets/:id/group-picks
router.get('/brackets/:id/group-picks', requireLogin, (req, res) => {
  const bracketId = parseInt(req.params.id, 10);

  if (!ownsBracket(bracketId, req.session.userId)) {
    req.session.flash = { type: 'danger', message: 'Bracket not found.' };
    return res.redirect('/dashboard');
  }

  const bracket = db.prepare('SELECT * FROM brackets WHERE id = ?').get(bracketId);

  // Get all group matches with team names and existing picks
  const matches = db.prepare(`
    SELECT gm.id, gm.match_number, gm.group_name,
           ht.name AS home_team, at.name AS away_team,
           gm.home_score, gm.away_score, gm.played,
           gp.home_score_pick, gp.away_score_pick
    FROM group_matches gm
    JOIN teams ht ON ht.id = gm.home_team_id
    JOIN teams at ON at.id = gm.away_team_id
    LEFT JOIN group_picks gp ON gp.match_id = gm.id AND gp.bracket_id = ?
    ORDER BY gm.group_name, gm.match_number
  `).all(bracketId);

  // Group matches by group name
  const groupedMatches = {};
  for (const match of matches) {
    if (!groupedMatches[match.group_name]) {
      groupedMatches[match.group_name] = [];
    }
    groupedMatches[match.group_name].push(match);
  }

  res.render('group-picks', {
    title: `Group Picks — ${bracket.name}`,
    bracket,
    groupedMatches,
    groupNames: Object.keys(groupedMatches).sort(),
    maxScore: MAX_SCORE
  });
});

// POST /brackets/:id/group-picks
router.post('/brackets/:id/group-picks', requireLogin, (req, res) => {
  const bracketId = parseInt(req.params.id, 10);

  if (!ownsBracket(bracketId, req.session.userId)) {
    req.session.flash = { type: 'danger', message: 'Bracket not found.' };
    return res.redirect('/dashboard');
  }

  const upsert = db.prepare(`
    INSERT INTO group_picks (bracket_id, match_id, home_score_pick, away_score_pick)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(bracket_id, match_id) DO UPDATE SET
      home_score_pick = excluded.home_score_pick,
      away_score_pick = excluded.away_score_pick
  `);

  const allMatches = db.prepare('SELECT id FROM group_matches').all();

  const saveAll = db.transaction(() => {
    for (const match of allMatches) {
      const homeKey = `home_${match.id}`;
      const awayKey = `away_${match.id}`;
      const homeScore = parseInt(req.body[homeKey], 10);
      const awayScore = parseInt(req.body[awayKey], 10);
      if (!isNaN(homeScore) && !isNaN(awayScore) && homeScore >= 0 && awayScore >= 0) {
        upsert.run(bracketId, match.id, homeScore, awayScore);
      }
    }
  });

  try {
    saveAll();
    req.session.flash = { type: 'success', message: 'Group stage picks saved!' };
    res.redirect(`/brackets/${bracketId}/group-picks`);
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Failed to save picks.' };
    res.redirect(`/brackets/${bracketId}/group-picks`);
  }
});

// GET /brackets/:id/knockout-picks
router.get('/brackets/:id/knockout-picks', requireLogin, (req, res) => {
  const bracketId = parseInt(req.params.id, 10);

  if (!ownsBracket(bracketId, req.session.userId)) {
    req.session.flash = { type: 'danger', message: 'Bracket not found.' };
    return res.redirect('/dashboard');
  }

  const groupStageComplete = db.prepare(
    "SELECT value FROM settings WHERE key = 'group_stage_complete'"
  ).get();

  if (!groupStageComplete || groupStageComplete.value !== '1') {
    req.session.flash = { type: 'warning', message: 'Knockout picks are not available until the group stage is complete.' };
    return res.redirect('/dashboard');
  }

  const bracket = db.prepare('SELECT * FROM brackets WHERE id = ?').get(bracketId);

  const rounds = ROUNDS;
  const roundLabels = ROUND_LABELS;

  // Get all knockout matches with team names and existing picks
  const knockoutMatches = db.prepare(`
    SELECT km.id, km.round, km.position,
           ht.id AS home_team_id, ht.name AS home_team,
           at.id AS away_team_id, at.name AS away_team,
           km.winner_team_id, km.played,
           kp.picked_winner_id
    FROM knockout_matches km
    LEFT JOIN teams ht ON ht.id = km.home_team_id
    LEFT JOIN teams at ON at.id = km.away_team_id
    LEFT JOIN knockout_picks kp ON kp.knockout_match_id = km.id AND kp.bracket_id = ?
    ORDER BY km.round, km.position
  `).all(bracketId);

  // Group by round
  const byRound = {};
  for (const round of rounds) {
    byRound[round] = knockoutMatches.filter(m => m.round === round);
  }

  res.render('knockout-picks', {
    title: `Knockout Picks — ${bracket.name}`,
    bracket,
    byRound,
    rounds,
    roundLabels
  });
});

// POST /brackets/:id/knockout-picks
router.post('/brackets/:id/knockout-picks', requireLogin, (req, res) => {
  const bracketId = parseInt(req.params.id, 10);

  if (!ownsBracket(bracketId, req.session.userId)) {
    req.session.flash = { type: 'danger', message: 'Bracket not found.' };
    return res.redirect('/dashboard');
  }

  const groupStageComplete = db.prepare(
    "SELECT value FROM settings WHERE key = 'group_stage_complete'"
  ).get();

  if (!groupStageComplete || groupStageComplete.value !== '1') {
    req.session.flash = { type: 'warning', message: 'Knockout picks not available yet.' };
    return res.redirect('/dashboard');
  }

  const upsert = db.prepare(`
    INSERT INTO knockout_picks (bracket_id, knockout_match_id, picked_winner_id)
    VALUES (?, ?, ?)
    ON CONFLICT(bracket_id, knockout_match_id) DO UPDATE SET
      picked_winner_id = excluded.picked_winner_id
  `);

  const allKnockoutMatches = db.prepare('SELECT id FROM knockout_matches').all();

  const saveAll = db.transaction(() => {
    for (const km of allKnockoutMatches) {
      const pickedId = parseInt(req.body[`winner_${km.id}`], 10);
      if (!isNaN(pickedId) && pickedId > 0) {
        upsert.run(bracketId, km.id, pickedId);
      }
    }
  });

  try {
    saveAll();
    req.session.flash = { type: 'success', message: 'Knockout picks saved!' };
    res.redirect(`/brackets/${bracketId}/knockout-picks`);
  } catch (err) {
    console.error(err);
    req.session.flash = { type: 'danger', message: 'Failed to save knockout picks.' };
    res.redirect(`/brackets/${bracketId}/knockout-picks`);
  }
});

module.exports = router;
