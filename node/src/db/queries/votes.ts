import { db } from "../client";
import type { Pick } from "../../lib/stage";

export type Vote = {
  id: number;
  match_id: number;
  user_id: number;
  pick: Pick;
  stake: number;
  created_at: number;
  updated_at: number;
};

export function getUserVote(matchId: number, userId: number): Vote | null {
  return (
    (db
      .prepare("SELECT * FROM votes WHERE match_id = ? AND user_id = ?")
      .get(matchId, userId) as Vote | undefined) ?? null
  );
}

export function getUserVotedMatchIds(userId: number): Set<number> {
  const rows = db
    .prepare("SELECT match_id FROM votes WHERE user_id = ?")
    .all(userId) as { match_id: number }[];
  return new Set(rows.map((r) => r.match_id));
}

export function upsertVote(
  matchId: number,
  userId: number,
  pick: Pick,
  stake: number,
): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO votes (match_id, user_id, pick, stake, created_at, updated_at)
     VALUES (@matchId, @userId, @pick, @stake, @now, @now)
     ON CONFLICT(match_id, user_id) DO UPDATE SET
       pick = excluded.pick,
       stake = excluded.stake,
       updated_at = excluded.updated_at`,
  ).run({ matchId, userId, pick, stake, now });
}

export function deleteVote(matchId: number, userId: number): void {
  db.prepare("DELETE FROM votes WHERE match_id = ? AND user_id = ?").run(
    matchId,
    userId,
  );
}

export type VoteTally = {
  // Stake sums per outcome (bottles) — drives the stake-weighted vote odds.
  home: number;
  draw: number;
  away: number;
  stakeTotal: number;
  // Distinct voters (people) — for "N 人" display and small-sample warnings.
  voters: number;
};

const EMPTY_TALLY: VoteTally = {
  home: 0,
  draw: 0,
  away: 0,
  stakeTotal: 0,
  voters: 0,
};

// Soft-deleted users (users.deleted_at NOT NULL) are excluded everywhere their
// votes would be visible or counted: tallies (odds), the per-match roster, and
// — via getMatchVotesDetailed — settlement itself.
export function getVoteTally(matchId: number): VoteTally {
  const rows = db
    .prepare(
      `SELECT v.pick, COUNT(*) AS n, COALESCE(SUM(v.stake),0) AS s
       FROM votes v JOIN users u ON u.id = v.user_id
       WHERE v.match_id = ? AND u.deleted_at IS NULL
       GROUP BY v.pick`,
    )
    .all(matchId) as { pick: Pick; n: number; s: number }[];
  const tally: VoteTally = { ...EMPTY_TALLY };
  for (const row of rows) {
    tally[row.pick] = row.s;
    tally.stakeTotal += row.s;
    tally.voters += row.n;
  }
  return tally;
}

export function getMatchVotes(matchId: number): Vote[] {
  return db
    .prepare(
      `SELECT v.* FROM votes v JOIN users u ON u.id = v.user_id
       WHERE v.match_id = ? AND u.deleted_at IS NULL`,
    )
    .all(matchId) as Vote[];
}

export type VoteDetail = {
  user_id: number;
  avatar_url: string | null;
  emoji: string | null;
  nickname: string;
  pick: Pick;
  stake: number;
  updated_at: number;
};

export function getMatchVotesDetailed(matchId: number): VoteDetail[] {
  return db
    .prepare(
      `SELECT v.user_id, u.avatar_url, u.emoji, u.nickname, v.pick, v.stake, v.updated_at
       FROM votes v JOIN users u ON u.id = v.user_id
       WHERE v.match_id = ? AND u.deleted_at IS NULL
       ORDER BY v.updated_at`,
    )
    .all(matchId) as VoteDetail[];
}

export function getAllTallies(): Map<number, VoteTally> {
  const rows = db
    .prepare(
      `SELECT v.match_id, v.pick, COUNT(*) AS n, COALESCE(SUM(v.stake),0) AS s
       FROM votes v JOIN users u ON u.id = v.user_id
       WHERE u.deleted_at IS NULL
       GROUP BY v.match_id, v.pick`,
    )
    .all() as { match_id: number; pick: Pick; n: number; s: number }[];
  const map = new Map<number, VoteTally>();
  for (const row of rows) {
    const tally = map.get(row.match_id) ?? { ...EMPTY_TALLY };
    tally[row.pick] = row.s;
    tally.stakeTotal += row.s;
    tally.voters += row.n;
    map.set(row.match_id, tally);
  }
  return map;
}
