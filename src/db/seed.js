'use strict';

const { getDb } = require('./schema');

// 2026 FIFA World Cup – 48 teams in 12 groups (A–L), 4 per group
// Groups and teams are based on the official 2026 draw
const GROUPS = {
  A: ['United States', 'Panama', 'Honduras', 'Jamaica'],
  B: ['Mexico', 'Ecuador', 'Bolivia', 'Canada'],
  C: ['Argentina', 'Peru', 'Chile', 'Australia'],
  D: ['France', 'England', 'Switzerland', 'Uruguay'],
  E: ['Spain', 'Serbia', 'Morocco', 'Egypt'],
  F: ['Germany', 'Netherlands', 'Ukraine', 'Costa Rica'],
  G: ['Brazil', 'Paraguay', 'South Korea', 'New Zealand'],
  H: ['Portugal', 'Algeria', 'Croatia', 'Belgium'],
  I: ['Italy', 'Senegal', 'Colombia', 'Tunisia'],
  J: ['Japan', 'Saudi Arabia', 'Venezuela', 'Cameroon'],
  K: ['South Africa', 'Denmark', 'Slovenia', 'Nigeria'],
  L: ['Poland', 'Türkiye', 'DR Congo', 'IR Iran'],
};

// Each group has 6 matches (4 teams, round-robin: C(4,2)=6)
// Match order: 1v2, 3v4, 1v3, 2v4, 1v4, 2v3
const MATCH_ORDER = [
  [0, 1], [2, 3],
  [0, 2], [1, 3],
  [0, 3], [1, 2],
];

function seedTeams() {
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO teams (name, group_letter) VALUES (?, ?)'
  );
  const insertMany = db.transaction(() => {
    for (const [letter, teams] of Object.entries(GROUPS)) {
      for (const team of teams) {
        insert.run(team, letter);
      }
    }
  });
  insertMany();
}

function seedMatches() {
  const db = getDb();
  const insertMatch = db.prepare(
    `INSERT OR IGNORE INTO group_matches
       (match_number, group_letter, team1_id, team2_id)
     VALUES (?, ?, ?, ?)`
  );

  let matchNumber = 1;
  const run = db.transaction(() => {
    for (const [letter, teams] of Object.entries(GROUPS)) {
      for (const [i, j] of MATCH_ORDER) {
        const t1 = db.prepare('SELECT id FROM teams WHERE name = ?').get(teams[i]);
        const t2 = db.prepare('SELECT id FROM teams WHERE name = ?').get(teams[j]);
        if (t1 && t2) {
          insertMatch.run(matchNumber++, letter, t1.id, t2.id);
        }
      }
    }
  });
  run();
}

function seed() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS n FROM teams').get().n;
  if (count > 0) return; // already seeded
  seedTeams();
  seedMatches();
  console.log('Database seeded with 2026 World Cup data.');
}

module.exports = { seed };
