-- 006_batch_settlement.sql : batch settlement records.
-- Replaces per-match coke_settled tracking with a settlement batch:
-- a "结算" action settles many matches at once and produces one immutable
-- record (created on the settler's "确定"). The record is the artifact players
-- read offline; there is no separate physical-handoff state.

-- One row per "确定" — a finalised settlement of one or more matches.
CREATE TABLE settlements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   INTEGER NOT NULL,
  created_by   INTEGER REFERENCES users(id),
  match_count  INTEGER NOT NULL DEFAULT 0
);

-- Each settled match belongs to exactly one batch.
ALTER TABLE matches ADD COLUMN settlement_id INTEGER REFERENCES settlements(id);
CREATE INDEX idx_matches_settlement ON matches(settlement_id);

-- Backfill: attach pre-existing settled matches to one "历史结算" record so they
-- still appear in the settlement-records list. (At migration time this is the
-- only settlement row, so MAX(id) reliably identifies it.)
INSERT INTO settlements (created_at, created_by, match_count)
  VALUES (strftime('%s','now') * 1000, NULL, 0);
UPDATE matches SET settlement_id = (SELECT MAX(id) FROM settlements)
  WHERE settled = 1;
UPDATE settlements SET match_count =
  (SELECT COUNT(*) FROM matches WHERE settlement_id = settlements.id);
DELETE FROM settlements WHERE match_count = 0;  -- no-op backfill on a fresh DB

-- coke_settled* are superseded by the settlement model. Safe to drop here:
-- migrate.ts runs with foreign_keys = OFF, which lifts the DROP COLUMN
-- restriction on the FK-bearing coke_settled_by column.
ALTER TABLE matches DROP COLUMN coke_settled;
ALTER TABLE matches DROP COLUMN coke_settled_at;
ALTER TABLE matches DROP COLUMN coke_settled_by;
