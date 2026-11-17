// Postgres вместо SQLite — на бесплатном Render диск эфемерный и SQLite-файл стирается
// при каждом перезапуске/деплое, стирая вообще всех пользователей. Postgres (отдельная
// управляемая база на Render) переживает деплои и рестарты сервиса.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL не задан. Нужна Postgres-база — см. DEPLOY_GUIDE.md, раздел "База данных".');
}

// Render (и большинство облачных Postgres) требуют SSL на внешних подключениях, но обычно
// с самоподписанным сертификатом — поэтому rejectUnauthorized: false. Для локальной разработки
// (DATABASE_URL с localhost/127.0.0.1) SSL не включаем.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Неожиданная ошибка пула Postgres:', err);
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  google_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'user',
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_code TEXT,
  verification_expires TIMESTAMPTZ,
  plan_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  query_params TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fb_ad_id TEXT NOT NULL,
  page_name TEXT,
  snapshot_url TEXT,
  ad_creation_time TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_json TEXT,
  vertical TEXT,
  UNIQUE(user_id, fb_ad_id)
);

CREATE TABLE IF NOT EXISTS ad_cache (
  fb_ad_id TEXT PRIMARY KEY,
  page_name TEXT,
  page_id TEXT,
  ad_creation_time TEXT,
  first_tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active INTEGER NOT NULL DEFAULT 1,
  times_seen INTEGER NOT NULL DEFAULT 1,
  raw_json TEXT
);
`;

// На случай базы, созданной до какой-то из этих колонок — IF NOT EXISTS в Postgres делает
// миграцию тривиальной (без ручной проверки PRAGMA table_info, как было с SQLite).
const MIGRATIONS_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_active INTEGER NOT NULL DEFAULT 0;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS vertical TEXT;
`;

let readyPromise = null;

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await pool.query(SCHEMA_SQL);
      await pool.query(MIGRATIONS_SQL);
    })();
  }
  return readyPromise;
}

// Тонкая обёртка: ждём готовности схемы перед первым запросом каждого соединения из пула.
async function query(text, params) {
  await ensureReady();
  return pool.query(text, params);
}

module.exports = { query, pool, ensureReady };
