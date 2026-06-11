import { db } from "../db/client";

export type PolyMarket = {
  slug: string;
  question: string;
  outcomes: string[];
  outcomePrices: string[];
  clobTokenIds: string[];
  conditionId?: string;
};

export type PolyEvent = {
  id: string;
  slug: string;
  title: string;
  markets: PolyMarket[];
};

export type MatchedOdds = {
  matchId: number;
  eventId: string;
  slug: string;
  pHome: number;
  pDraw: number | null;
  pAway: number;
  tokenHome: string | null;
  tokenDraw: string | null;
  tokenAway: string | null;
  conditionId: string | null;
  score: number;
};

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type TeamRow = { id: number; name: string; aliases: string | null };

export type MatchIndex = {
  nameToTeamId: Map<string, number>;
  pairToMatch: Map<string, { id: number; homeId: number; awayId: number }>;
};

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function buildMatchIndex(): MatchIndex {
  const teams = db
    .prepare("SELECT id, name, aliases FROM teams")
    .all() as TeamRow[];
  const nameToTeamId = new Map<string, number>();
  for (const team of teams) {
    nameToTeamId.set(normalize(team.name), team.id);
    const aliases: string[] = team.aliases ? JSON.parse(team.aliases) : [];
    for (const alias of aliases) nameToTeamId.set(normalize(alias), team.id);
  }

  const matches = db
    .prepare(
      `SELECT id, home_team_id, away_team_id FROM matches
       WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL`,
    )
    .all() as { id: number; home_team_id: number; away_team_id: number }[];
  const pairToMatch = new Map<
    string,
    { id: number; homeId: number; awayId: number }
  >();
  for (const m of matches) {
    pairToMatch.set(pairKey(m.home_team_id, m.away_team_id), {
      id: m.id,
      homeId: m.home_team_id,
      awayId: m.away_team_id,
    });
  }

  return { nameToTeamId, pairToMatch };
}

/** Resolve a team name to a team_id, exact alias first then token subset. */
export function resolveTeam(
  polyName: string,
  index: MatchIndex,
): number | null {
  const norm = normalize(polyName);
  const exact = index.nameToTeamId.get(norm);
  if (exact != null) return exact;

  const polyTokens = norm.split(" ").filter(Boolean);
  for (const [name, id] of index.nameToTeamId) {
    const tokens = name.split(" ").filter(Boolean);
    const aSubsetB = polyTokens.every((t) => tokens.includes(t));
    const bSubsetA = tokens.every((t) => polyTokens.includes(t));
    if (aSubsetB || bSubsetA) return id;
  }
  return null;
}

function parsePrices(market: PolyMarket): number | null {
  const yes = parseFloat(market.outcomePrices?.[0]);
  return Number.isFinite(yes) ? yes : null;
}

const MONEYLINE_SLUG = /-\d{4}-\d{2}-\d{2}$/;

export function isMoneylineEvent(event: PolyEvent): boolean {
  return (
    MONEYLINE_SLUG.test(event.slug) &&
    event.markets.length >= 2 &&
    event.markets.length <= 3
  );
}

/** Map one Polymarket moneyline event to a DB match + extracted probabilities. */
export function matchEvent(
  event: PolyEvent,
  index: MatchIndex,
): MatchedOdds | null {
  const [t1, t2] = event.title.split(/\s+vs\.?\s+/i);
  if (!t1 || !t2) return null;

  const id1 = resolveTeam(t1, index);
  const id2 = resolveTeam(t2, index);
  if (id1 == null || id2 == null) return null;

  const match = index.pairToMatch.get(pairKey(id1, id2));
  if (!match) return null;

  // Identify draw market and the two win markets.
  let drawMarket: PolyMarket | null = null;
  const winMarkets: PolyMarket[] = [];
  for (const market of event.markets) {
    const isDraw =
      market.slug.endsWith("-draw") || /draw/i.test(market.question);
    if (isDraw) drawMarket = market;
    else winMarkets.push(market);
  }

  // Assign win markets to home/away by which team name is in the question.
  const homeNorm = t1NormForId(event, index, match.homeId);
  let homeMarket: PolyMarket | null = null;
  let awayMarket: PolyMarket | null = null;
  for (const market of winMarkets) {
    const q = normalize(market.question);
    if (homeNorm && q.includes(homeNorm)) homeMarket = market;
    else awayMarket = market;
  }
  if (!homeMarket && winMarkets.length === 2) {
    [homeMarket, awayMarket] = winMarkets;
  }

  const pHome = homeMarket ? parsePrices(homeMarket) : null;
  const pAway = awayMarket ? parsePrices(awayMarket) : null;
  const pDraw = drawMarket ? parsePrices(drawMarket) : null;
  if (pHome == null || pAway == null) return null;

  return {
    matchId: match.id,
    eventId: event.id,
    slug: event.slug,
    pHome,
    pDraw,
    pAway,
    tokenHome: homeMarket?.clobTokenIds?.[0] ?? null,
    tokenDraw: drawMarket?.clobTokenIds?.[0] ?? null,
    tokenAway: awayMarket?.clobTokenIds?.[0] ?? null,
    conditionId: homeMarket?.conditionId ?? event.id,
    score: 1,
  };
}

function t1NormForId(
  event: PolyEvent,
  index: MatchIndex,
  teamId: number,
): string | null {
  const [t1, t2] = event.title.split(/\s+vs\.?\s+/i);
  if (resolveTeam(t1, index) === teamId) return normalize(t1);
  if (resolveTeam(t2, index) === teamId) return normalize(t2);
  return null;
}
