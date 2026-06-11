import { db } from "../client";

export type TeamRef = {
  id: number | null;
  name: string;
  flag: string | null;
  code: string | null;
};

export type OddsRow = {
  source: string;
  is_locked: number;
  p_home: number | null;
  p_draw: number | null;
  p_away: number | null;
  d_home: number | null;
  d_draw: number | null;
  d_away: number | null;
  taken_at: number;
};

export type MatchRow = {
  id: number;
  stage: string;
  group_name: string | null;
  venue: string | null;
  kickoff_at: number;
  result: string | null;
  home_score: number | null;
  away_score: number | null;
  settled: number;
  home: TeamRef;
  away: TeamRef;
};

type RawMatchRow = {
  id: number;
  stage: string;
  group_name: string | null;
  venue: string | null;
  kickoff_at: number;
  result: string | null;
  home_score: number | null;
  away_score: number | null;
  settled: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_label: string | null;
  away_label: string | null;
  home_name: string | null;
  home_flag: string | null;
  home_code: string | null;
  away_name: string | null;
  away_flag: string | null;
  away_code: string | null;
};

const MATCH_SELECT = `
  SELECT m.id, m.stage, m.group_name, m.venue, m.kickoff_at,
         m.result, m.home_score, m.away_score, m.settled,
         m.home_team_id, m.away_team_id, m.home_label, m.away_label,
         COALESCE(ht.name_zh, ht.name) AS home_name, ht.flag AS home_flag, ht.code AS home_code,
         COALESCE(at.name_zh, at.name) AS away_name, at.flag AS away_flag, at.code AS away_code
  FROM matches m
  LEFT JOIN teams ht ON ht.id = m.home_team_id
  LEFT JOIN teams at ON at.id = m.away_team_id
`;

function shape(row: RawMatchRow): MatchRow {
  return {
    id: row.id,
    stage: row.stage,
    group_name: row.group_name,
    venue: row.venue,
    kickoff_at: row.kickoff_at,
    result: row.result,
    home_score: row.home_score,
    away_score: row.away_score,
    settled: row.settled,
    home: {
      id: row.home_team_id,
      name: row.home_name ?? row.home_label ?? "待定",
      flag: row.home_flag,
      code: row.home_code,
    },
    away: {
      id: row.away_team_id,
      name: row.away_name ?? row.away_label ?? "待定",
      flag: row.away_flag,
      code: row.away_code,
    },
  };
}

export function getAllMatches(): MatchRow[] {
  const rows = db
    .prepare(`${MATCH_SELECT} ORDER BY m.kickoff_at, m.id`)
    .all() as RawMatchRow[];
  return rows.map(shape);
}

export function getMatch(id: number): MatchRow | null {
  const row = db
    .prepare(`${MATCH_SELECT} WHERE m.id = ?`)
    .get(id) as RawMatchRow | undefined;
  return row ? shape(row) : null;
}

/** Latest odds per source for a match (locked snapshot preferred). */
export function getMatchOdds(matchId: number): {
  polymarket: OddsRow | null;
  vote: OddsRow | null;
  locked: OddsRow | null;
} {
  const latest = (source: string, locked: boolean): OddsRow | null =>
    (db
      .prepare(
        `SELECT * FROM odds_snapshot
         WHERE match_id = ? AND source = ? ${locked ? "AND is_locked = 1" : ""}
         ORDER BY is_locked DESC, taken_at DESC LIMIT 1`,
      )
      .get(matchId, source) as OddsRow | undefined) ?? null;

  const lockedSettleOdds =
    (db
      .prepare(
        `SELECT * FROM odds_snapshot
         WHERE match_id = ? AND is_locked = 1 AND source IN ('polymarket','manual')
         ORDER BY taken_at DESC LIMIT 1`,
      )
      .get(matchId) as OddsRow | undefined) ?? null;

  return {
    polymarket: latest("polymarket", false),
    vote: latest("vote", false),
    locked: lockedSettleOdds,
  };
}

/** Map of matchId -> whether a usable (settleable) odds source exists. */
export function getMatchesWithOdds(): Set<number> {
  const rows = db
    .prepare(
      `SELECT DISTINCT match_id FROM odds_snapshot
       WHERE source IN ('polymarket','manual')`,
    )
    .all() as { match_id: number }[];
  return new Set(rows.map((r) => r.match_id));
}

export function getPolyMarketSlug(matchId: number): string | null {
  const row = db
    .prepare("SELECT slug FROM poly_markets WHERE match_id = ?")
    .get(matchId) as { slug: string | null } | undefined;
  return row?.slug ?? null;
}

/** True if the match has any market (polymarket/manual) odds — i.e. the line is open. */
export function hasSettleableOdds(matchId: number): boolean {
  return !!db
    .prepare(
      `SELECT 1 FROM odds_snapshot
       WHERE match_id = ? AND source IN ('polymarket','manual') LIMIT 1`,
    )
    .get(matchId);
}

/** Latest non-locked polymarket odds for many matches, keyed by matchId. */
export function getLatestPolymarketOdds(): Map<number, OddsRow> {
  const rows = db
    .prepare(
      `SELECT o.* FROM odds_snapshot o
       JOIN (
         SELECT match_id, MAX(taken_at) AS mx
         FROM odds_snapshot WHERE source = 'polymarket'
         GROUP BY match_id
       ) latest ON latest.match_id = o.match_id AND latest.mx = o.taken_at
       WHERE o.source = 'polymarket'`,
    )
    .all() as (OddsRow & { match_id: number })[];
  const map = new Map<number, OddsRow>();
  for (const row of rows) map.set(row.match_id, row);
  return map;
}

/** The locked crowd-vote odds used as the settlement basis for a match. */
export function getLockedVoteOdds(matchId: number): OddsRow | null {
  return (
    (db
      .prepare(
        `SELECT * FROM odds_snapshot
         WHERE match_id = ? AND source = 'vote' AND is_locked = 1
         ORDER BY taken_at DESC LIMIT 1`,
      )
      .get(matchId) as OddsRow | undefined) ?? null
  );
}
