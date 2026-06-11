import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/identity";
import { updateProfile, getUserById } from "../../../db/queries/users";

const MAX_NICKNAME = 16;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatar_url,
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    nickname?: string;
    emoji?: string | null;
  } | null;
  const nickname = body?.nickname?.trim();

  if (!nickname) {
    return NextResponse.json({ error: "昵称不能为空" }, { status: 400 });
  }
  if (nickname.length > MAX_NICKNAME) {
    return NextResponse.json(
      { error: `昵称不能超过 ${MAX_NICKNAME} 个字符` },
      { status: 400 },
    );
  }

  updateProfile(user.id, nickname, body?.emoji ?? null);
  const updated = getUserById(user.id)!;
  return NextResponse.json({
    user: {
      id: updated.id,
      nickname: updated.nickname,
      emoji: updated.emoji,
    },
  });
}
