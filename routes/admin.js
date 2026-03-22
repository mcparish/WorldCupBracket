const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// GET /admin
router.get('/admin', requireAdmin, (req, res) => {
  const groupMatches = db.prepare(`
    SELECT gm.id, gm.match_number, gm.group_name,
           ht.name AS home_team, at.name AS away_team,
           gm.home_score, gm.away_score, gm.played
    FROM group_matches gm
    JOIN teams ht ON ht.id = gm.home_team_id
    JOIN teams at ON at.id = gm.away_team_id
    ORDER BY gm.group_name, gm.match_number
  `).all();

  const groupStageComplete = db.prepare(
    "SELECT value FROM settings WHERE key = 'group_stage_complete'"
  ).get();

  const knockoutMatches = db.prepare(`
    SELECT km.id, km.round, km.position,
           ht.name AS home_team, at.name AS away_team,
           wt.name AS winner_team, km.played
    FROM knockout_matches km
    LEFT JOIN teams ht ON ht.id = km.home_team_id
    LEFT JOIN teams at ON at.id = km.away_team_id
    LEFT JOIN teams wt ON wt.id = km.winner_team_id
    ORDER BY km.round, km.position
  `).all();

  const roundLabels = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-Finals', sf: 'Semi-Finals', final: 'Final' };
  const rounds = ['r32', 'r16', 'qf', 'sf', 'final'];

  const knockoutByRound = {};
  for (const round of rounds) {
    knockoutByRound[round] = knockoutMatches.filter(m => m.round === round);
  }

  // Group the group matches by group name
  const groupedMatches = {};
  for (const match of groupMatches) {
    if (!groupedMatches[match.group_name]) groupedMatches[match.group_name] = [];
    groupedMatches[match.group_name].push(match);
  }

  res.render('admin', {
    title: 'Admin Panel',
    groupedMatches,
    groupNames: Object.keys(groupedMatches).sort(),
    groupStageComplete: groupStageComplete ? groupStageComplete.value === '1' : false,
    knockoutByRound,
    rounds,
    roundLabels
  });
});

// POST /admin/group-result
router.post('/admin/group-result', requireAdmin, (req, res) => {
  const { match_id, home_score, away_score } = req.body;
  const homeScore = parseInt(home_score, 10);
  const awayScore = parseInt(away_score, 10);

  if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
    req.session.flash = { type: 'danger', message: 'Invalid scores.' };
    return res.redirect('/admin');
  }

  db.prepare(
    'UPDATE group_matches SET home_score = ?, away_score = ?, played = 1 WHERE id = ?'
  ).run(homeScore, awayScore, parseInt(match_id, 10));

  req.session.flash = { type: 'success', message: 'Match result saved.' };
  res.redirect('/admin');
});

// POST /admin/complete-group-stage
router.post('/admin/complete-group-stage', requireAdmin, (req, res) => {
  db.prepare("UPDATE settings SET value = '1' WHERE key = 'group_stage_complete'").run();
  req.session.flash = { type: 'success', message: 'Group stage marked as complete. Knockout picks are now available.' };
  res.redirect('/admin');
});

// POST /admin/knockout-match — create or update a knockout matchup
router.post('/admin/knockout-match', requireAdmin, (req, res) => {
  const { round, position, home_team_name, away_team_name } = req.body;
  const pos = parseInt(position, 10);

  if (!round || isNaN(pos) || !home_team_name || !away_team_name) {
    req.session.flash = { type: 'danger', message: 'All fields required for knockout match.' };
    return res.redirect('/admin');
  }

  const homeTeam = db.prepare('SELECT id FROM teams WHERE name = ?').get(home_team_name.trim());
  const awayTeam = db.prepare('SELECT id FROM teams WHERE name = ?').get(away_team_name.trim());

  if (!homeTeam || !awayTeam) {
    req.session.flash = { type: 'danger', message: `Team not found. Check spelling. (Home: "${home_team_name}", Away: "${away_team_name}")` };
    return res.redirect('/admin');
  }

  db.prepare(`
    INSERT INTO knockout_matches (round, position, home_team_id, away_team_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(round, position) DO UPDATE SET
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      winner_team_id = NULL,
      played = 0
  `).run(round, pos, homeTeam.id, awayTeam.id);

  req.session.flash = { type: 'success', message: `Knockout match (${round} #${pos}) set.` };
  res.redirect('/admin');
});

// POST /admin/knockout-result
router.post('/admin/knockout-result', requireAdmin, (req, res) => {
  const { knockout_match_id, winner_team_name } = req.body;
  const matchId = parseInt(knockout_match_id, 10);

  if (!winner_team_name || isNaN(matchId)) {
    req.session.flash = { type: 'danger', message: 'Invalid knockout result data.' };
    return res.redirect('/admin');
  }

  const winner = db.prepare('SELECT id FROM teams WHERE name = ?').get(winner_team_name.trim());
  if (!winner) {
    req.session.flash = { type: 'danger', message: `Team "${winner_team_name}" not found.` };
    return res.redirect('/admin');
  }

  db.prepare(
    'UPDATE knockout_matches SET winner_team_id = ?, played = 1 WHERE id = ?'
  ).run(winner.id, matchId);

  req.session.flash = { type: 'success', message: 'Knockout result recorded.' };
  res.redirect('/admin');
});

// GET /admin/create-admin — bootstrap first admin (only if no admin exists)
router.get('/admin/create-admin', (req, res) => {
  if (!req.session.userId) {
    req.session.flash = { type: 'danger', message: 'You must be logged in.' };
    return res.redirect('/login');
  }
  const existingAdmin = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
  if (existingAdmin) {
    req.session.flash = { type: 'warning', message: 'An admin already exists.' };
    return res.redirect('/dashboard');
  }
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(req.session.userId);
  req.session.isAdmin = 1;
  req.session.flash = { type: 'success', message: 'You are now an admin!' };
  res.redirect('/admin');
});

module.exports = router;
