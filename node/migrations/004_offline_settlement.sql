-- 004_offline_settlement.sql : per-match offline coke payout tracking.
-- settled = result entered & ledger computed (online).
-- coke_settled = physical coke collected from losers / handed to winners offline.
ALTER TABLE matches ADD COLUMN coke_settled    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN coke_settled_at INTEGER;
ALTER TABLE matches ADD COLUMN coke_settled_by INTEGER REFERENCES users(id);
