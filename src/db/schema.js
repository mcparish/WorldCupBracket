'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/worldcup.db');

let _db = null;

function getDb() {
  if (!_db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL UNIQUE,
      email       TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      group_letter TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_matches (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL UNIQUE,
      group_letter TEXT NOT NULL,
      team1_id     INTEGER NOT NULL REFERENCES teams(id),
      team2_id     INTEGER NOT NULL REFERENCES teams(id),
      match_date   TEXT,
      actual_score1 INTEGER,
      actual_score2 INTEGER,
      status       TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS brackets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_picks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      bracket_id       INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
      match_id         INTEGER NOT NULL REFERENCES group_matches(id),
      predicted_score1 INTEGER NOT NULL DEFAULT 0,
      predicted_score2 INTEGER NOT NULL DEFAULT 0,
      UNIQUE(bracket_id, match_id)
    );

    CREATE TABLE IF NOT EXISTS knockout_matches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      round           TEXT NOT NULL,
      match_number    INTEGER NOT NULL,
      team1_id        INTEGER REFERENCES teams(id),
      team2_id        INTEGER REFERENCES teams(id),
      actual_winner_id INTEGER REFERENCES teams(id),
      status          TEXT NOT NULL DEFAULT 'locked',
      UNIQUE(round, match_number)
    );

    CREATE TABLE IF NOT EXISTS knockout_picks (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      bracket_id          INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
      match_id            INTEGER NOT NULL REFERENCES knockout_matches(id),
      predicted_winner_id INTEGER NOT NULL REFERENCES teams(id),
      UNIQUE(bracket_id, match_id)
    );
  `);

  return db;
}

module.exports = { getDb, initDb };
