import { NextResponse } from "next/server";
import { getCurrentSettler } from "../../../../lib/settler";
import { recordResult, updateMatchScore } from "../../../../lib/settlement";
import { getMatch } from "../../../../db/queries/matches";
import type { Pick } from "../../../../lib/stage";

export async function POST(request: Request) {
  const settler = await getCurrentSettler();
  if (!settler) {
    return NextResponse.json({ error: "无结算权限" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    matchId?: number;
    homeScore?: number | null;
    awayScore?: number | null;
    result?: Pick;
  } | null;

  const matchId = Number(body?.matchId);
  if (!Number.isFinite(matchId)) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  const match = getMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "比赛不存在" }, { status: 404 });
  }

  const homeScore =
    body?.homeScore == null || body.homeScore === ("" as never)
      ? null
      : Number(body.homeScore);
  const awayScore =
    body?.awayScore == null || body.awayScore === ("" as never)
      ? null
      : Number(body.awayScore);

  // Un-settled: record the result+score (result derived from score, or the
  // explicit pick for a knockout draw). Settled: only fix the display score.
  const outcome = match.settled
    ? updateMatchScore(matchId, homeScore, awayScore)
    : recordResult(matchId, homeScore, awayScore, body?.result);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
