import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/identity";
import { redeemDrink } from "../../../db/queries/redemptions";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    drink?: string;
    qty?: number;
  } | null;

  const drink = body?.drink;
  if (!drink) {
    return NextResponse.json({ error: "请选择饮料" }, { status: 400 });
  }

  const result = redeemDrink(user.id, String(drink), Number(body?.qty));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
