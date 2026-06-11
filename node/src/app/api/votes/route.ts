import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/identity";
import { getMatch } from "../../../db/queries/matches";
import {
  upsertVote,
  getUserVote,
  deleteVote,
} from "../../../db/queries/votes";
import { deriveStatus, isVotable } from "../../../lib/matchState";
import { validPicks, type Pick } from "../../../lib/stage";
import { stakeForStage } from "../../../lib/betting";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先用 Twitter 登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    matchId?: number;
    pick?: Pick;
  } | null;

  const matchId = Number(body?.matchId);
  const pick = body?.pick;

  const match = Number.isFinite(matchId) ? getMatch(matchId) : null;
  if (!match) {
    return NextResponse.json({ error: "比赛不存在" }, { status: 404 });
  }

  if (!pick || !validPicks(match.stage).includes(pick)) {
    return NextResponse.json(
      { error: "该比赛不支持这个投注选项" },
      { status: 400 },
    );
  }

  const stake = stakeForStage(match.stage);

  const status = deriveStatus({
    kickoffAt: match.kickoff_at,
    bettable: !!match.home.id && !!match.away.id,
    settled: !!match.settled,
    now: Date.now(),
  });
  if (!isVotable(status)) {
    return NextResponse.json(
      { error: "该比赛当前无法预测（未开放、已截止或对阵未定）" },
      { status: 409 },
    );
  }

  upsertVote(match.id, user.id, pick, stake);
  return NextResponse.json({ vote: getUserVote(match.id, user.id) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先用 Twitter 登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    matchId?: number;
  } | null;

  const matchId = Number(body?.matchId);
  const match = Number.isFinite(matchId) ? getMatch(matchId) : null;
  if (!match) {
    return NextResponse.json({ error: "比赛不存在" }, { status: 404 });
  }

  const status = deriveStatus({
    kickoffAt: match.kickoff_at,
    bettable: !!match.home.id && !!match.away.id,
    settled: !!match.settled,
    now: Date.now(),
  });
  if (!isVotable(status)) {
    return NextResponse.json(
      { error: "该比赛当前无法取消预测（未开放、已截止或对阵未定）" },
      { status: 409 },
    );
  }

  deleteVote(match.id, user.id);
  return NextResponse.json({ ok: true });
}
