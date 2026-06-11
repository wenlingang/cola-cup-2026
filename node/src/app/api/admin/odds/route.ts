import { NextResponse } from "next/server";
import { db } from "../../../../db/client";
import { getCurrentSettler } from "../../../../lib/settler";
import { getMatch } from "../../../../db/queries/matches";
import { priceToDecimal } from "../../../../lib/decimalOdds";
import { allowsDraw } from "../../../../lib/stage";

export async function POST(request: Request) {
  const settler = await getCurrentSettler();
  if (!settler) {
    return NextResponse.json({ error: "无结算权限" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    matchId?: number;
    pHome?: number;
    pDraw?: number;
    pAway?: number;
  } | null;

  const matchId = Number(body?.matchId);
  const match = Number.isFinite(matchId) ? getMatch(matchId) : null;
  if (!match) return NextResponse.json({ error: "比赛不存在" }, { status: 404 });

  const withDraw = allowsDraw(match.stage);
  const pHome = Number(body?.pHome);
  const pAway = Number(body?.pAway);
  const pDraw = withDraw ? Number(body?.pDraw) : null;

  const inRange = (v: number) => Number.isFinite(v) && v > 0 && v < 1;
  if (!inRange(pHome) || !inRange(pAway) || (withDraw && !inRange(pDraw!))) {
    return NextResponse.json(
      { error: "概率需为 0–1 之间（小数）" },
      { status: 400 },
    );
  }

  db.prepare(
    `INSERT INTO odds_snapshot
       (match_id, source, is_locked, p_home, p_draw, p_away, d_home, d_draw, d_away, taken_at)
     VALUES (@matchId, 'manual', 0, @pHome, @pDraw, @pAway, @dHome, @dDraw, @dAway, @now)`,
  ).run({
    matchId,
    pHome,
    pDraw,
    pAway,
    dHome: priceToDecimal(pHome),
    dDraw: pDraw == null ? null : priceToDecimal(pDraw),
    dAway: priceToDecimal(pAway),
    now: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
