-- Blog-OS 初始表结构（D1）
-- 应用：wrangler d1 migrations apply blog-os-db

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  excerpt     TEXT NOT NULL DEFAULT '',
  content_md  TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  created_at  INTEGER NOT NULL,               -- unix 秒
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS messages (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  ts   INTEGER NOT NULL,   -- unix 秒
  ip   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts DESC);

-- 默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('announcement', ''),
  ('posts_per_page', '50');
