import { Avatar } from "./Avatar";

const NAME_SIZE: Record<string, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "font-display text-2xl tracking-wide",
};

export function IdentityBadge({
  avatarUrl,
  emoji,
  nickname,
  size = "md",
  ringColor = "border-border-hi",
}: {
  avatarUrl: string | null;
  emoji?: string | null;
  nickname: string;
  size?: "sm" | "md" | "lg";
  ringColor?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Avatar
        avatarUrl={avatarUrl}
        emoji={emoji}
        nickname={nickname}
        size={size}
        ring={ringColor}
      />
      <span className={NAME_SIZE[size]}>{nickname}</span>
    </span>
  );
}
