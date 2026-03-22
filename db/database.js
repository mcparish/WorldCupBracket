const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'worldcup.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      home_team_id INTEGER NOT NULL REFERENCES teams(id),
      away_team_id INTEGER NOT NULL REFERENCES teams(id),
      home_score INTEGER,
      away_score INTEGER,
      played INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS brackets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bracket_id INTEGER NOT NULL REFERENCES brackets(id),
      match_id INTEGER NOT NULL REFERENCES group_matches(id),
      home_score_pick INTEGER NOT NULL DEFAULT 0,
      away_score_pick INTEGER NOT NULL DEFAULT 0,
      UNIQUE(bracket_id, match_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knockout_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round TEXT NOT NULL,
      position INTEGER NOT NULL,
      home_team_id INTEGER REFERENCES teams(id),
      away_team_id INTEGER REFERENCES teams(id),
      winner_team_id INTEGER REFERENCES teams(id),
      played INTEGER NOT NULL DEFAULT 0,
      UNIQUE(round, position)
    );

    CREATE TABLE IF NOT EXISTS knockout_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bracket_id INTEGER NOT NULL REFERENCES brackets(id),
      knockout_match_id INTEGER NOT NULL REFERENCES knockout_matches(id),
      picked_winner_id INTEGER NOT NULL REFERENCES teams(id),
      UNIQUE(bracket_id, knockout_match_id)
    );
  `);

  // Insert default settings
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('group_stage_complete', '0')`).run();

  // Seed teams and matches if not already done
  const teamCount = db.prepare('SELECT COUNT(*) as cnt FROM teams').get();
  if (teamCount.cnt === 0) {
    seedTeamsAndMatches();
  }
}

function seedTeamsAndMatches() {
  const groups = {
    A: ['USA', 'Canada', 'Mexico', 'Jamaica'],
    B: ['Brazil', 'Argentina', 'Uruguay', 'Chile'],
    C: ['England', 'France', 'Spain', 'Portugal'],
    D: ['Germany', 'Netherlands', 'Belgium', 'Denmark'],
    E: ['Italy', 'Poland', 'Croatia', 'Serbia'],
    F: ['Morocco', 'Senegal', 'Nigeria', 'Egypt'],
    G: ['Japan', 'South Korea', 'Australia', 'Iran'],
    H: ['Saudi Arabia', 'Qatar', 'Iraq', 'Jordan'],
    I: ['Colombia', 'Ecuador', 'Peru', 'Bolivia'],
    J: ['Cameroon', 'Algeria', 'Tunisia', 'Ghana'],
    K: ['Costa Rica', 'Honduras', 'Panama', 'El Salvador'],
    L: ['Switzerland', 'Turkey', 'Czech Republic', 'Greece']
  };

  const insertTeam = db.prepare('INSERT INTO teams (name, group_name) VALUES (?, ?)');
  const insertMatch = db.prepare(
    'INSERT INTO group_matches (match_number, group_name, home_team_id, away_team_id) VALUES (?, ?, ?, ?)'
  );

  const seedAll = db.transaction(() => {
    let matchNumber = 1;
    for (const [groupName, teamNames] of Object.entries(groups)) {
      // Insert teams
      const teamIds = [];
      for (const name of teamNames) {
        const result = insertTeam.run(name, groupName);
        teamIds.push(result.lastInsertRowid);
      }
      // Generate all pairs (6 matches per group)
      for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
          insertMatch.run(matchNumber++, groupName, teamIds[i], teamIds[j]);
        }
      }
    }
  });

  seedAll();
}

initDB();

module.exports = db;
