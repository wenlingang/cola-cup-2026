import { db } from "../client";
import type { Pick } from "../../lib/stage";

export type VoteLine = {
  nickname: string;
  emoji: string | null;
  pick: Pick;
  stake: number;
};

/** A settled match's per-person breakdown, sourced from the ledger so it matches
 *  the payouts exactly — voters excluded at settlement time never appear here. */
function settledVotesForMatch(matchId: number): VoteLine[] {
  return db
    .prepare(
      `SELECT u.nickname, u.emoji, l.pick, l.stake
       FROM ledger l JOIN users u ON u.id = l.user_id
       WHERE l.match_id = ?
       ORDER BY l.created_at, u.id`,
    )
    .all(matchId) as VoteLine[];
}

type UserNet = { user_id: number; net: number };

/** Each bettor's net (raw, un-rounded) across the matches in one settlement. */
function userNetsForSettlement(settlementId: number): UserNet[] {
  return db
    .prepare(
      `SELECT l.user_id, COALESCE(SUM(l.delta), 0) AS net
       FROM ledger l
       JOIN matches m ON m.id = l.match_id
       WHERE m.settlement_id = ?
       GROUP BY l.user_id`,
    )
    .all(settlementId) as UserNet[];
}

export type SettlementListRow = {
  id: number;
  created_at: number;
  match_count: number;
  people: number;
  bottles: number;
};

/** Settlement records, newest first — for the admin "结算记录" list. */
export function getSettlements(): SettlementListRow[] {
  const rows = db
    .prepare(
      "SELECT id, created_at, match_count FROM settlements ORDER BY id DESC",
    )
    .all() as { id: number; created_at: number; match_count: number }[];

  return rows.map((s) => {
    const nets = userNetsForSettlement(s.id);
    return {
      ...s,
      people: nets.length,
      bottles: nets.reduce((sum, n) => sum + Math.max(0, n.net), 0),
    };
  });
}

export type SettlementDetailUser = {
  userId: number;
  nickname: string;
  emoji: string | null;
  net: number;
};

export type SettlementDetailMatch = {
  matchId: number;
  stage: string;
  home: string;
  away: string;
  homeFlag: string | null;
  awayFlag: string | null;
  result: Pick | null;
  homeScore: number | null;
  awayScore: number | null;
  voters: number;
  votes: VoteLine[];
};

export type SettlementDetail = {
  id: number;
  created_at: number;
  match_count: number;
  matches: SettlementDetailMatch[];
  users: SettlementDetailUser[];
};

/** Full content of one settlement record: its matches + each person's buy/receive. */
export function getSettlementDetail(id: number): SettlementDetail | null {
  const s = db
    .prepare("SELECT id, created_at, match_count FROM settlements WHERE id = ?")
    .get(id) as
    | { id: number; created_at: number; match_count: number }
    | undefined;
  if (!s) return null;

  const matchRows = db
    .prepare(
      `SELECT m.id AS matchId, m.stage, m.result, m.home_score AS homeScore,
              m.away_score AS awayScore,
              COALESCE(ht.name_zh, ht.name, m.home_label) AS home,
              COALESCE(at.name_zh, at.name, m.away_label) AS away,
              ht.flag AS homeFlag, at.flag AS awayFlag,
              (SELECT COUNT(*) FROM ledger l WHERE l.match_id = m.id) AS voters
       FROM matches m
       LEFT JOIN teams ht ON ht.id = m.home_team_id
       LEFT JOIN teams at ON at.id = m.away_team_id
       WHERE m.settlement_id = ?
       ORDER BY m.kickoff_at, m.id`,
    )
    .all(id) as Omit<SettlementDetailMatch, "votes">[];
  const matches: SettlementDetailMatch[] = matchRows.map((mm) => ({
    ...mm,
    votes: settledVotesForMatch(mm.matchId),
  }));

  const nets = userNetsForSettlement(id);
  const userInfo = nets.length
    ? (db
        .prepare(
          `SELECT id, nickname, emoji FROM users WHERE id IN (${nets
            .map(() => "?")
            .join(",")})`,
        )
        .all(...nets.map((n) => n.user_id)) as {
        id: number;
        nickname: string;
        emoji: string | null;
      }[])
    : [];
  const byId = new Map(userInfo.map((u) => [u.id, u]));

  const users: SettlementDetailUser[] = nets
    .map((n) => {
      const u = byId.get(n.user_id);
      return {
        userId: n.user_id,
        nickname: u?.nickname ?? "?",
        emoji: u?.emoji ?? null,
        net: n.net,
      };
    })
    .sort((a, b) => b.net - a.net);

  return {
    id: s.id,
    created_at: s.created_at,
    match_count: s.match_count,
    matches,
    users,
  };
}
