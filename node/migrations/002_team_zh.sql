-- 002_team_zh.sql : Chinese display names for teams (English name kept for matching)
ALTER TABLE teams ADD COLUMN name_zh TEXT;
