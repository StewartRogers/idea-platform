const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'ideas.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS focus_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    focus_area_id INTEGER NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    name TEXT DEFAULT '',
    description TEXT DEFAULT '',
    -- problem_what/problem_who/problem_scale/benefits are legacy/unused, kept for
    -- backward data compatibility; superseded by problem_statement/value_proposition/hypothesis below.
    problem_what TEXT DEFAULT '',
    problem_who TEXT DEFAULT '',
    problem_scale TEXT DEFAULT '',
    benefits TEXT DEFAULT '',
    problem_statement TEXT DEFAULT '',
    value_proposition TEXT DEFAULT '',
    hypothesis TEXT DEFAULT '',
    pitch TEXT DEFAULT '',
    conversation TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  );
`);

// Migration for pre-existing databases: SQLite has no "ADD COLUMN IF NOT EXISTS",
// so check PRAGMA table_info before altering. The CREATE TABLE above only applies
// to brand-new databases; existing ones need these columns added explicitly.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('ideas', 'problem_statement', "problem_statement TEXT DEFAULT ''");
ensureColumn('ideas', 'value_proposition', "value_proposition TEXT DEFAULT ''");
ensureColumn('ideas', 'hypothesis', "hypothesis TEXT DEFAULT ''");
ensureColumn('ideas', 'pitch', "pitch TEXT DEFAULT ''");

module.exports = db;
