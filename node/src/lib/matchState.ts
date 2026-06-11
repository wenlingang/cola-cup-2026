export const VOTE_OPENS_MS_BEFORE = 7 * 24 * 60 * 60 * 1000; // 1 week
export const VOTE_CLOSES_MS_BEFORE = 60 * 60 * 1000; // 1 hour

export type MatchStatus =
  | "scheduled" // more than a week out — voting not open yet
  | "upcoming" // in window but no odds yet -> view only
  | "open" // in window with odds -> votable
  | "locked" // within 1h of kickoff / kicked off, not settled
  | "settled"; // result entered, ledger written

export type MatchStateInput = {
  kickoffAt: number;
  bettable: boolean; // both teams determined (knockout placeholders are not)
  settled: boolean;
  now: number;
};

export function voteOpensAt(kickoffAt: number): number {
  return kickoffAt - VOTE_OPENS_MS_BEFORE;
}

export function voteClosesAt(kickoffAt: number): number {
  return kickoffAt - VOTE_CLOSES_MS_BEFORE;
}

export function deriveStatus({
  kickoffAt,
  bettable,
  settled,
  now,
}: MatchStateInput): MatchStatus {
  if (settled) return "settled";
  if (now >= voteClosesAt(kickoffAt)) return "locked";
  if (now < voteOpensAt(kickoffAt)) return "scheduled";
  return bettable ? "open" : "upcoming";
}

export function isVotable(status: MatchStatus): boolean {
  return status === "open";
}

export const STATUS_META: Record<
  MatchStatus,
  { label: string; tone: string }
> = {
  scheduled: { label: "未开放", tone: "text-text-low" },
  upcoming: { label: "待开盘", tone: "text-text-mid" },
  open: { label: "可预测", tone: "text-win" },
  locked: { label: "已截止", tone: "text-amber" },
  settled: { label: "已结算", tone: "text-text-mid" },
};
