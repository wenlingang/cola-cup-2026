import { NextResponse } from "next/server";
import { getCurrentSettler } from "../../../../lib/settler";
import {
  previewSettlement,
  settleSelected,
  type IncludedMap,
} from "../../../../lib/settlement";

export async function POST(request: Request) {
  const settler = await getCurrentSettler();
  if (!settler) {
    return NextResponse.json({ error: "无结算权限" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    matchIds?: number[];
    included?: IncludedMap;
    commit?: boolean;
  } | null;

  const matchIds = Array.isArray(body?.matchIds)
    ? body.matchIds.map(Number).filter((n) => Number.isFinite(n))
    : [];
  if (matchIds.length === 0) {
    return NextResponse.json({ error: "请选择要结算的比赛" }, { status: 400 });
  }

  const included =
    body?.included && typeof body.included === "object" ? body.included : undefined;

  if (body?.commit) {
    const outcome = settleSelected(matchIds, settler.id, included);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: 409 });
    }
    return NextResponse.json(outcome);
  }

  return NextResponse.json(previewSettlement(matchIds, included));
}
