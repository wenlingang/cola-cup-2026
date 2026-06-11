// All kickoff/schedule times are displayed in Beijing time, regardless of the
// server (UTC in the container) or viewer's local timezone.
export const DISPLAY_TIME_ZONE = "Asia/Shanghai";

const DATE_FMT = new Intl.DateTimeFormat("zh-CN", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKDAY_FMT = new Intl.DateTimeFormat("zh-CN", {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: "short",
});

const DAY_FMT = new Intl.DateTimeFormat("zh-CN", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "long",
  day: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("zh-CN", {
  timeZone: DISPLAY_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatKickoff(epochMs: number): string {
  return `${DATE_FMT.format(epochMs)} ${WEEKDAY_FMT.format(epochMs)}`;
}

export function formatDayLabel(epochMs: number): string {
  return `${DAY_FMT.format(epochMs)} ${WEEKDAY_FMT.format(epochMs)}`;
}

export function formatTimeOnly(epochMs: number): string {
  return TIME_FMT.format(epochMs);
}

/** Stable YYYY-MM-DD key in Beijing time, for day grouping. */
export function dateKey(epochMs: number): string {
  return KEY_FMT.format(epochMs);
}

export function formatCountdown(epochMs: number, now: number): string {
  const diff = epochMs - now;
  if (diff <= 0) return "已开赛";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}天${hours}小时后`;
  if (hours > 0) return `${hours}小时${minutes}分后`;
  return `${minutes}分钟后`;
}

export function formatBottles(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}
