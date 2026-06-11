import type { MatchStatus } from "../../lib/matchState";
import { STATUS_META } from "../../lib/matchState";

const BADGE_CLASS: Record<MatchStatus, string> = {
  scheduled: "scheduled",
  upcoming: "scheduled",
  open: "open",
  locked: "locked",
  settled: "settled",
};

export function StatusBadge({
  status,
  className,
}: {
  status: MatchStatus;
  className?: string;
}) {
  const cls = ["badge", BADGE_CLASS[status], className].filter(Boolean).join(" ");
  return <span className={cls}>{STATUS_META[status].label}</span>;
}
