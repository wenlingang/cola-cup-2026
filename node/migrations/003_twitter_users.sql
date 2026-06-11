-- 003_twitter_users.sql : switch identity to Twitter OAuth.
-- Rebuild users: twitter_id (unique) replaces the cookie token; nickname is the
-- editable display name (no longer unique — Twitter names collide); avatar_url
-- from Twitter. Safe rebuild: votes/ledger reference users(id) but FK names are
-- restored by the rename, and those tables are empty at migration time.

CREATE TABLE users_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  twitter_id  TEXT UNIQUE,
  username    TEXT,
  nickname    TEXT NOT NULL,
  avatar_url  TEXT,
  emoji       TEXT,
  created_at  INTEGER NOT NULL
);

INSERT INTO users_new (id, nickname, emoji, created_at)
  SELECT id, nickname, emoji, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
