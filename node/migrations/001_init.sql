-- 001_init.sql : World Cup Coca-Cola betting platform schema

-- Participants (lightweight, password-less identity)
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  emoji       TEXT NOT NULL,
  nickname    TEXT NOT NULL UNIQUE,
  token       TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

-- Teams (standard names + aliases to help Polymarket title matching)
CREATE TABLE teams (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  code     TEXT,
  name     TEXT NOT NULL UNIQUE,
  flag     TEXT,
  confed   TEXT,
  aliases  TEXT
);

-- Matches (all 104 fixtures; group stage allows draw, knockout does not)
CREATE TABLE matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  external_key  TEXT NOT NULL UNIQUE,
  group_name    TEXT,
  stage         TEXT NOT NULL,
  home_team_id  INTEGER REFERENCES teams(id),
  away_team_id  INTEGER REFERENCES teams(id),
  home_label    TEXT,
  away_label    TEXT,
  venue         TEXT,
  kickoff_at    INTEGER NOT NULL,
  result        TEXT,
  home_score    INTEGER,
  away_score    INTEGER,
  result_at     INTEGER,
  settled       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_matches_kickoff ON matches(kickoff_at);
CREATE INDEX idx_matches_stage ON matches(stage);

-- Polymarket market mapping (one match -> one 3-way / 2-way market set)
CREATE TABLE poly_markets (
  match_id      INTEGER PRIMARY KEY REFERENCES matches(id),
  event_id      TEXT,
  slug          TEXT,
  condition_id  TEXT,
  token_home    TEXT,
  token_draw    TEXT,
  token_away    TEXT,
  match_method  TEXT,
  match_score   REAL,
  closed        INTEGER DEFAULT 0,
  updated_at    INTEGER
);

-- Odds snapshots (multiple rows kept for history; is_locked=1 is the binding one)
CREATE TABLE odds_snapshot (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL REFERENCES matches(id),
  source     TEXT NOT NULL,
  is_locked  INTEGER NOT NULL DEFAULT 0,
  p_home     REAL,
  p_draw     REAL,
  p_away     REAL,
  d_home     REAL,
  d_draw     REAL,
  d_away     REAL,
  taken_at   INTEGER NOT NULL
);
CREATE INDEX idx_odds_match ON odds_snapshot(match_id, source, is_locked);

-- Votes (one per user per match; editable until kickoff)
CREATE TABLE votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    INTEGER NOT NULL REFERENCES matches(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  pick        TEXT NOT NULL,
  stake       REAL NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE(match_id, user_id)
);
CREATE INDEX idx_votes_match ON votes(match_id);

-- Ledger (one settled row per user per match; raw un-rounded delta)
CREATE TABLE ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    INTEGER NOT NULL REFERENCES matches(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  pick        TEXT NOT NULL,
  stake       REAL NOT NULL,
  d_used      REAL NOT NULL,
  won         INTEGER NOT NULL,
  delta       REAL NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE(match_id, user_id)
);
CREATE INDEX idx_ledger_user ON ledger(user_id);
