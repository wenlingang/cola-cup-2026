const SIZE_PX: Record<string, number> = { sm: 28, md: 40, lg: 64 };

/** Display priority: user-chosen emoji override > Twitter photo > name initial. */
export function Avatar({
  avatarUrl,
  emoji,
  nickname,
  size = "md",
  ring = "border-border-hi",
}: {
  avatarUrl?: string | null;
  emoji?: string | null;
  nickname: string;
  size?: "sm" | "md" | "lg";
  ring?: string;
}) {
  const px = SIZE_PX[size];

  if (emoji) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-bg-elevated ${ring}`}
        style={{ width: px, height: px, fontSize: px * 0.55 }}
      >
        {emoji}
      </span>
    );
  }

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={nickname}
        referrerPolicy="no-referrer"
        className={`shrink-0 rounded-full border-2 object-cover ${ring}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-bg-elevated font-display ${ring}`}
      style={{ width: px, height: px, fontSize: px * 0.45 }}
    >
      {nickname.slice(0, 1).toUpperCase()}
    </span>
  );
}
