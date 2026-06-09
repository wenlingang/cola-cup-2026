import { db } from "../db/client";
import type { OddsRow } from "../db/queries/matches";
import { getVoteTally, getMatchVotesDetailed } from "../db/queries/votes";
import { computeVoteOdds } from "./voteOdds";
import { deltasFromVotes } from "./pariMutuel";
import { allowsDraw, isKnockout, type Pick } from "./stage";
import { VOTE_CLOSES_MS_BEFORE } from "./matchState";

function getLockedOdds(matchId: number, sources: string[]): OddsRow | null {
  const placeholders = sources.map(() => "?").join(",");
  return (
    (db
      .prepare(
        `SELECT * FROM odds_snapshot
         WHERE match_id = ? AND is_locked = 1 AND source IN (${placeholders})
         ORDER BY taken_at DESC LIMIT 1`,
      )
      .get(matchId, ...sources) as OddsRow | undefined) ?? null
  );
}

function getLatestMarketOdds(matchId: number): OddsRow | null {
  return (
    (db
      .prepare(
        `SELECT * FROM odds_snapshot
         WHERE match_id = ? AND source IN ('polymarket','manual')
         ORDER BY is_locked DESC, taken_at DESC LIMIT 1`,
      )
      .get(matchId) as OddsRow | undefined) ?? null
  );
}

function insertLockedSnapshot(
  matchId: number,
  source: string,
  odds: {
    p_home: number | null;
    p_draw: number | null;
    p_away: number | null;
    d_home: number | null;
    d_draw: number | null;
    d_away: number | null;
  },
  now: number,
): void {
  db.prepare(
    `INSERT INTO odds_snapshot
       (match_id, source, is_locked, p_home, p_draw, p_away, d_home, d_draw, d_away, taken_at)
     VALUES (@matchId, @source, 1, @pHome, @pDraw, @pAway, @dHome, @dDraw, @dAway, @now)`,
  ).run({
    matchId,
    source,
    pHome: odds.p_home,
    pDraw: odds.p_draw,
    pAway: odds.p_away,
    dHome: odds.d_home,
    dDraw: odds.d_draw,
    dAway: odds.d_away,
    now,
  });
}

/**
 * Freeze a match's binding odds. Settlement uses the locked VOTE odds (crowd
 * implied), so the smart can arbitrage the distribution; the Polymarket/manual
 * market odds are locked too, but only for "crowd vs market" display.
 * Idempotent per source. Returns the locked vote odds (settlement basis).
 */
export function ensureLocked(matchId: number, now: number): OddsRow | null {
  const match = db
    .prepare("SELECT stage FROM matches WHERE id = ?")
    .get(matchId) as { stage: string } | undefined;
  if (!match) return null;

  // Market odds — display only.
  if (!getLockedOdds(matchId, ["polymarket", "manual"])) {
    const latest = getLatestMarketOdds(matchId);
    if (latest) insertLockedSnapshot(matchId, latest.source, latest, now);
  }

  // Vote odds — settlement basis.
  let vote = getLockedOdds(matchId, ["vote"]);
  if (!vote) {
    const voteOdds = computeVoteOdds(
      getVoteTally(matchId),
      allowsDraw(match.stage),
    );
    if (voteOdds) {
      insertLockedSnapshot(matchId, "vote", voteOdds, now);
      vote = getLockedOdds(matchId, ["vote"]);
    }
  }

  return vote;
}

export type OkResult = { ok: true } | { ok: false; error: string };

/** Result implied by the score. Null when undecidable (no score, or a knockout
 *  draw — where the advancing side must be picked explicitly). */
export function deriveResultFromScore(
  stage: string,
  homeScore: number | null,
  awayScore: number | null,
): Pick | null {
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return isKnockout(stage) ? null : "draw";
}

/**
 * Record a match's score + result without settling (no ledger, settled stays 0).
 * Used by the results sync (passes the explicit winner, covering ET/penalties)
 * and by admin score edits on un-settled matches (result derived from score).
 */
export function recordResult(
  matchId: number,
  homeScore: number | null,
  awayScore: number | null,
  result?: Pick,
): OkResult {
  const match = db
    .prepare("SELECT stage, settled FROM matches WHERE id = ?")
    .get(matchId) as { stage: string; settled: number } | undefined;
  if (!match) return { ok: false, error: "比赛不存在" };
  if (match.settled) return { ok: false, error: "该比赛已结算，请用修改比分" };

  const resolved = result ?? deriveResultFromScore(match.stage, homeScore, awayScore);
  if (!resolved) {
    return {
      ok: false,
      error: isKnockout(match.stage)
        ? "淘汰赛比分相同，请选择晋级方"
        : "请填写比分",
    };
  }

  db.prepare(
    `UPDATE matches
       SET result = ?, home_score = ?, away_score = ?, result_at = ?
     WHERE id = ?`,
  ).run(resolved, homeScore, awayScore, Date.now(), matchId);
  return { ok: true };
}

type SettleableMatch = {
  id: number;
  stage: string;
  settled: number;
  result: Pick | null;
  home_score: number | null;
  away_score: number | null;
};

function getSettleableMatch(matchId: number): SettleableMatch | undefined {
  return db
    .prepare(
      "SELECT id, stage, settled, result, home_score, away_score FROM matches WHERE id = ?",
    )
    .get(matchId) as SettleableMatch | undefined;
}

function validateForSettle(
  m: SettleableMatch | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!m) return { ok: false, reason: "比赛不存在" };
  if (m.settled) return { ok: false, reason: "已结算" };
  if (!m.result) return { ok: false, reason: "尚未录入赛果" };
  return { ok: true };
}

/** A match's full roster of voters — always the complete list, regardless of
 *  who is currently included, so the UI can render a toggleable checklist. */
export type RosterVote = {
  userId: number;
  nickname: string;
  emoji: string | null;
  pick: Pick;
  stake: number;
};

export type PreviewMatch = {
  matchId: number;
  result: Pick;
  homeScore: number | null;
  awayScore: number | null;
  voters: number;
  votes: RosterVote[];
};

/** Per-match opt-in: matchId (string after JSON) → userIds participating in the
 *  settlement. A missing key means "include everyone who voted that match"; an
 *  explicit empty array means "include nobody — skip the match". */
export type IncludedMap = Record<string, number[]>;

/** Resolve the participating voters for one match. `provided` distinguishes a
 *  missing key (default to all voters) from an explicit empty array (skip). The
 *  ids are intersected with the real voters, so the client can never settle
 *  someone who didn't actually vote that match. */
function resolveIncluded(
  matchId: number,
  included: IncludedMap | undefined,
  realUserIds: Set<number>,
): { userIds: Set<number>; provided: boolean } {
  const raw = included?.[String(matchId)];
  if (!Array.isArray(raw)) {
    return { userIds: new Set(realUserIds), provided: false };
  }
  const userIds = new Set<number>();
  for (const value of raw) {
    const id = Number(value);
    if (Number.isFinite(id) && realUserIds.has(id)) userIds.add(id);
  }
  return { userIds, provided: true };
}

export type PreviewUser = {
  userId: number;
  nickname: string;
  emoji: string | null;
  net: number;
};

export type SettlementPreview = {
  ok: boolean;
  error?: string;
  matches: PreviewMatch[];
  skipped: { matchId: number; reason: string }[];
  users: PreviewUser[];
};

function toRosterVotes(detailed: ReturnType<typeof getMatchVotesDetailed>): RosterVote[] {
  return detailed.map((v) => ({
    userId: v.user_id,
    nickname: v.nickname,
    emoji: v.emoji,
    pick: v.pick,
    stake: v.stake,
  }));
}

/** Dry-run a batch settlement: compute each person's net buy/receive for the
 *  selected matches without writing anything. `included` opts specific voters
 *  in per match (defaults to everyone who voted). */
export function previewSettlement(
  matchIds: number[],
  included?: IncludedMap,
): SettlementPreview {
  const matches: PreviewMatch[] = [];
  const skipped: { matchId: number; reason: string }[] = [];
  const netByUser = new Map<number, number>();

  for (const matchId of matchIds) {
    const m = getSettleableMatch(matchId);
    const check = validateForSettle(m);
    if (!check.ok) {
      skipped.push({ matchId, reason: check.reason });
      continue;
    }
    const match = m!;
    const detailed = getMatchVotesDetailed(matchId);
    const realUserIds = new Set(detailed.map((v) => v.user_id));
    const { userIds, provided } = resolveIncluded(matchId, included, realUserIds);
    const participating = detailed.filter((v) => userIds.has(v.user_id));
    if (provided && participating.length === 0) {
      skipped.push({ matchId, reason: "未选择参与者" });
      continue;
    }
    for (const d of deltasFromVotes(participating, match.result as Pick)) {
      netByUser.set(d.user_id, (netByUser.get(d.user_id) ?? 0) + d.delta);
    }
    matches.push({
      matchId,
      result: match.result as Pick,
      homeScore: match.home_score,
      awayScore: match.away_score,
      voters: detailed.length,
      votes: toRosterVotes(detailed),
    });
  }

  const users = buildPreviewUsers(netByUser);
  return {
    ok: matches.length > 0,
    error: matches.length > 0 ? undefined : skipped[0]?.reason ?? "没有可结算的比赛",
    matches,
    skipped,
    users,
  };
}

function buildPreviewUsers(netByUser: Map<number, number>): PreviewUser[] {
  const ids = [...netByUser.keys()];
  if (ids.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT id, nickname, emoji FROM users WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(...ids) as { id: number; nickname: string; emoji: string | null }[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => {
      const net = netByUser.get(id) ?? 0;
      const u = byId.get(id);
      return {
        userId: id,
        nickname: u?.nickname ?? "?",
        emoji: u?.emoji ?? null,
        net,
      };
    })
    .sort((a, b) => b.net - a.net);
}

export type SettleSelectedResult =
  | { ok: true; settlementId: number; settled: number; skipped: { matchId: number; reason: string }[] }
  | { ok: false; error: string };

/**
 * Commit a batch settlement: create one settlement record, write each voter's
 * pari-mutuel delta into the ledger, and mark the matches settled & linked to
 * the record. Atomic; rolls back if nothing settles.
 */
export function settleSelected(
  matchIds: number[],
  settlerId: number,
  included?: IncludedMap,
): SettleSelectedResult {
  const now = Date.now();

  const insertLedger = db.prepare(
    `INSERT INTO ledger
       (match_id, user_id, pick, stake, d_used, won, delta, created_at)
     VALUES (@matchId, @userId, @pick, @stake, @dUsed, @won, @delta, @now)
     ON CONFLICT(match_id, user_id) DO NOTHING`,
  );

  const run = db.transaction((): SettleSelectedResult => {
    const settlementId = Number(
      db
        .prepare(
          "INSERT INTO settlements (created_at, created_by, match_count) VALUES (?, ?, 0)",
        )
        .run(now, settlerId).lastInsertRowid,
    );

    const skipped: { matchId: number; reason: string }[] = [];
    let settled = 0;

    for (const matchId of matchIds) {
      const m = getSettleableMatch(matchId);
      const check = validateForSettle(m);
      if (!check.ok) {
        skipped.push({ matchId, reason: check.reason });
        continue;
      }
      const result = m!.result as Pick;
      const detailed = getMatchVotesDetailed(matchId);
      const realUserIds = new Set(detailed.map((v) => v.user_id));
      const { userIds, provided } = resolveIncluded(matchId, included, realUserIds);
      const participating = detailed.filter((v) => userIds.has(v.user_id));
      if (provided && participating.length === 0) {
        skipped.push({ matchId, reason: "未选择参与者" });
        continue;
      }
      ensureLocked(matchId, now); // freeze display snapshots (crowd + market)
      for (const d of deltasFromVotes(participating, result)) {
        insertLedger.run({
          matchId,
          userId: d.user_id,
          pick: d.pick,
          stake: d.stake,
          dUsed: d.d_used,
          won: d.won,
          delta: d.delta,
          now,
        });
      }
      db.prepare("UPDATE matches SET settled = 1, settlement_id = ? WHERE id = ?").run(
        settlementId,
        matchId,
      );
      settled += 1;
    }

    if (settled === 0) {
      throw new Error(skipped[0]?.reason ?? "没有可结算的比赛");
    }
    db.prepare("UPDATE settlements SET match_count = ? WHERE id = ?").run(
      settled,
      settlementId,
    );
    return { ok: true, settlementId, settled, skipped };
  });

  try {
    return run();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Correct or fill a settled match's display score without re-running settlement. */
export function updateMatchScore(
  matchId: number,
  homeScore: number | null,
  awayScore: number | null,
): OkResult {
  const match = db
    .prepare("SELECT id FROM matches WHERE id = ?")
    .get(matchId) as { id: number } | undefined;
  if (!match) return { ok: false, error: "比赛不存在" };
  db.prepare(
    "UPDATE matches SET home_score = ?, away_score = ? WHERE id = ?",
  ).run(homeScore, awayScore, matchId);
  return { ok: true };
}

/** Lock snapshots once voting closes (1h before kickoff) (cron/manual). */
export function lockDueMatches(now: number): number {
  const due = db
    .prepare(
      `SELECT id FROM matches
       WHERE (kickoff_at - ?) <= ? AND settled = 0`,
    )
    .all(VOTE_CLOSES_MS_BEFORE, now) as { id: number }[];
  let locked = 0;
  for (const { id } of due) {
    const alreadyLocked = getLockedOdds(id, ["vote", "polymarket", "manual"]);
    ensureLocked(id, now);
    if (!alreadyLocked && getLockedOdds(id, ["vote", "polymarket", "manual"])) {
      locked += 1;
    }
  }
  return locked;
}
