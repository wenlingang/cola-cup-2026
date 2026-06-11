-- 007_redemptions.sql : drink redemptions.
-- Players spend accumulated credits to redeem physical drinks. Each drink has
-- its own credit cost (可乐 1, 各种茶/外星人 1.5, 红牛 2.5). A redemption deducts
-- credits from the player's available balance (= settled net − redeemed).
CREATE TABLE redemptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  drink       TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  unit_cost   REAL NOT NULL,
  cost        REAL NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_redemptions_user ON redemptions(user_id);
