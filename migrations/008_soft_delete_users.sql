-- 008_soft_delete_users.sql : soft-delete for accounts.
-- A non-null deleted_at hides the user from the leaderboard, vote displays,
-- odds tallies and settlement — without destroying any history. Fully
-- reversible: set deleted_at = NULL to restore the account and its records.
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
