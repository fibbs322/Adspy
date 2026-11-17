const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'adspy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Пользователи
// password_hash может быть пустым для аккаунтов, созданных через Google-вход.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  google_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  role TEXT NOT NULL DEFAULT 'user'
);
`);

// Миграция для существующих баз, созданных до добавления Google-входа.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes('google_id')) {
  db.exec('ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE');
}

// Сохранённые поисковые запросы пользователя (чтобы следить за конкурентами)
db.exec(`
CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  query_params TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// Избранные объявления (чтобы не делать повторный запрос к FB API и отслеживать изменения)
db.exec(`
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  fb_ad_id TEXT NOT NULL,
  page_name TEXT,
  snapshot_url TEXT,
  ad_creation_time TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  raw_json TEXT,
  UNIQUE(user_id, fb_ad_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// Локальный кэш результатов поиска (снижает число обращений к FB API и даёт историю "с какой даты крутится")
db.exec(`
CREATE TABLE IF NOT EXISTS ad_cache (
  fb_ad_id TEXT PRIMARY KEY,
  page_name TEXT,
  page_id TEXT,
  ad_creation_time TEXT,
  first_tracked_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  times_seen INTEGER NOT NULL DEFAULT 1,
  raw_json TEXT
);
`);

module.exports = db;
