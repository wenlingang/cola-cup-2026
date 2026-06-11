-- 005_multi_provider_auth.sql : decouple identity from the login provider.
-- `users` becomes a provider-agnostic profile (nickname/avatar/emoji). Each login
-- identity moves to `accounts`, one row per linked OAuth provider — twitter today,
-- github/google later — keyed by (provider, provider_account_id). Adding a new
-- login method is then just a new provider value, never a schema change, and one
-- user can link several providers. Runs with foreign_keys OFF (see migrate.ts) so
-- the users rebuild can keep the same ids that votes/ledger already reference.

CREATE TABLE accounts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  username            TEXT,
  avatar_url          TEXT,
  created_at          INTEGER NOT NULL,
  UNIQUE(provider, provider_account_id)
);
CREATE INDEX idx_accounts_user ON accounts(user_id);

-- Backfill existing Twitter identities before the old columns disappear.
INSERT INTO accounts (user_id, provider, provider_account_id, username, avatar_url, created_at)
  SELECT id, 'twitter', twitter_id, username, avatar_url, created_at
  FROM users WHERE twitter_id IS NOT NULL;

-- Rebuild users without the Twitter-specific columns (avatar_url stays as the
-- display-avatar snapshot, refreshed from whichever provider was last used).
CREATE TABLE users_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname    TEXT NOT NULL,
  avatar_url  TEXT,
  emoji       TEXT,
  created_at  INTEGER NOT NULL
);

INSERT INTO users_new (id, nickname, avatar_url, emoji, created_at)
  SELECT id, nickname, avatar_url, emoji, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
