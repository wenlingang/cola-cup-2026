import { db } from "../client";
import type { Pick } from "../../lib/stage";

export type LeaderboardEntry = {
  id: number;
  avatar_url: string | null;
  emoji: string | null;
  nickname: string;
  net_raw: number;
  bets: number;
  wins: number;
};

/** Available balance = settled net (SUM delta) − credits spent on redemptions.
 *  This is the "钱包榜" figure: redeeming a drink lowers your standing. */
export function getLeaderboard(): LeaderboardEntry[] {
  return db
    .prepare(
      `SELECT u.id, u.avatar_url, u.emoji, u.nickname,
              COALESCE((SELECT SUM(delta) FROM ledger WHERE user_id = u.id), 0)
            - COALESCE((SELECT SUM(cost) FROM redemptions WHERE user_id = u.id), 0) AS net_raw,
              (SELECT COUNT(*) FROM ledger WHERE user_id = u.id) AS bets,
              COALESCE((SELECT SUM(won) FROM ledger WHERE user_id = u.id), 0) AS wins
       FROM users u
       WHERE u.deleted_at IS NULL
       ORDER BY net_raw DESC, bets DESC, u.created_at`,
    )
    .all() as LeaderboardEntry[];
}

export type LedgerEntry = {
  id: number;
  match_id: number;
  pick: Pick;
  stake: number;
  d_used: number;
  won: number;
  delta: number;
  created_at: number;
  stage: string;
  kickoff_at: number;
  home_name: string;
  away_name: string;
  home_flag: string | null;
  away_flag: string | null;
};

export function getUserLedger(userId: number): LedgerEntry[] {
  return db
    .prepare(
      `SELECT l.id, l.match_id, l.pick, l.stake, l.d_used, l.won, l.delta, l.created_at,
              m.stage, m.kickoff_at,
              COALESCE(ht.name_zh, ht.name, m.home_label) AS home_name,
              COALESCE(at.name_zh, at.name, m.away_label) AS away_name,
              ht.flag AS home_flag, at.flag AS away_flag
       FROM ledger l
       JOIN matches m ON m.id = l.match_id
       LEFT JOIN teams ht ON ht.id = m.home_team_id
       LEFT JOIN teams at ON at.id = m.away_team_id
       WHERE l.user_id = ?
       ORDER BY m.kickoff_at DESC`,
    )
    .all(userId) as LedgerEntry[];
}

/** Available balance = settled net − credits spent on redemptions. */
export function getUserNet(userId: number): number {
  const row = db
    .prepare(
      `SELECT COALESCE((SELECT SUM(delta) FROM ledger WHERE user_id = @u), 0)
            - COALESCE((SELECT SUM(cost) FROM redemptions WHERE user_id = @u), 0) AS net`,
    )
    .get({ u: userId }) as { net: number };
  return row.net;
}
