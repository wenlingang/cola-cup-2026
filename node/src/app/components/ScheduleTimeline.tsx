"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MatchStatus } from "../../lib/matchState";
import type { Pick } from "../../lib/stage";
import { StatusBadge } from "./StatusBadge";
import { formatDecimal } from "../../lib/decimalOdds";
import { LEAD_DIVERGENCE_PCT } from "../../lib/voteOdds";

export type RowVM = {
  id: number;
  kickoffAt: number;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
  stageLabel: string;
  stageKey: string;
  groupKey: string | null;
  groupName: string | null;
  status: MatchStatus;
  voted: boolean;
  home: { name: string; flag: string | null };
  away: { name: string; flag: string | null };
  settled: boolean;
  homeScore: number | null;
  awayScore: number | null;
  resultPick: Pick | null;
  market: { home: number | null; draw: number | null; away: number | null } | null;
  crowd: {
    homePct: number;
    drawPct: number;
    awayPct: number;
    voters: number;
    leaderPick: Pick | null;
    leaderPct: number | null;
  };
  crowdOdds: { home: number | null; draw: number | null; away: number | null } | null;
  countdown: string;
  isLive: boolean;
};

type StatusFilter = "all" | "open" | "done";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "open", label: "仅可预测" },
  { value: "done", label: "已结束" },
];

const PICK_SHORT: Record<Pick, string> = { home: "主", draw: "平", away: "客" };
const PICKS: Pick[] = ["home", "draw", "away"];
const RESULT_LABEL: Record<Pick, string> = {
  home: "主胜",
  draw: "平局",
  away: "客胜",
};
const DIVERGENCE_TIP =
  "市场（聪明钱）与同事看法分歧大 —— 用同事赔率下注可能赢更多可乐";

function matchesStatus(status: MatchStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return status === "open";
  return status === "settled" || status === "locked";
}

function dayKeyOffset(todayKey: string, offsetDays: number): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayHeading(
  dateKey: string,
  todayKey: string,
): { primary: string; isToday: boolean } {
  if (dateKey === todayKey) return { primary: "今天", isToday: true };
  if (dateKey === dayKeyOffset(todayKey, 1)) return { primary: "明天", isToday: false };
  if (dateKey === dayKeyOffset(todayKey, -1)) return { primary: "昨天", isToday: false };
  return { primary: "", isToday: false };
}

function MatchMeta({ row }: { row: RowVM }) {
  const showVoted = row.status === "open" && row.voted;
  return (
    <div className="meta">
      <span className="time">{row.timeLabel}</span>
      <span>·</span>
      <span>
        {row.stageLabel}
        {row.groupKey ? ` ${row.groupKey}` : ""}
      </span>
      {showVoted ? (
        <span className="badge voted meta-badge">✓ 已预测</span>
      ) : (
        <StatusBadge status={row.status} className="meta-badge" />
      )}
    </div>
  );
}

function MatchTeams({ row }: { row: RowVM }) {
  const middle =
    row.homeScore != null && row.awayScore != null
      ? `${row.homeScore}–${row.awayScore}`
      : "VS";
  return (
    <div className="teams">
      <span className="t">
        <span className="flag">{row.home.flag ?? "🏳️"}</span>
        <span className="nm">{row.home.name}</span>
      </span>
      <span className="x">{middle}</span>
      <span className="t">
        <span className="flag">{row.away.flag ?? "🏳️"}</span>
        <span className="nm">{row.away.name}</span>
      </span>
    </div>
  );
}

function pickMarketLeader(
  market: { home: number | null; draw: number | null; away: number | null },
): { pick: Pick; pct: number } | null {
  const entries: [Pick, number | null][] = [
    ["home", market.home],
    ["draw", market.draw],
    ["away", market.away],
  ];
  let best: { pick: Pick; pct: number } | null = null;
  for (const [pick, pct] of entries) {
    if (pct == null) continue;
    if (!best || pct > best.pct) best = { pick, pct };
  }
  return best;
}

function crowdPctFor(row: RowVM, pick: Pick): number | null {
  if (row.crowd.voters === 0) return null;
  return pick === "home"
    ? row.crowd.homePct
    : pick === "draw"
      ? row.crowd.drawPct
      : row.crowd.awayPct;
}

function marketPctFor(row: RowVM, pick: Pick): number | null {
  if (!row.market) return null;
  return pick === "home"
    ? row.market.home
    : pick === "draw"
      ? row.market.draw
      : row.market.away;
}

function pickMaxDivergence(
  row: RowVM,
): { pick: Pick; diff: number } | null {
  let best: { pick: Pick; diff: number } | null = null;
  for (const pick of PICKS) {
    const marketPct = marketPctFor(row, pick);
    const crowdPct = crowdPctFor(row, pick);
    if (marketPct == null || crowdPct == null || crowdPct <= 0) continue;
    const diff = marketPct - crowdPct;
    if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { pick, diff };
  }
  return best;
}

function MatchBig({ row }: { row: RowVM }) {
  if (row.resultPick) {
    return (
      <div className="big">
        <div className="pct score">{RESULT_LABEL[row.resultPick]}</div>
        <div className="cap">{row.settled ? "已结算" : "待结算"}</div>
      </div>
    );
  }

  const marketLeader = row.market ? pickMarketLeader(row.market) : null;
  if (marketLeader) {
    const maxDiv = pickMaxDivergence(row);
    let dv: React.ReactNode = null;
    if (maxDiv && Math.abs(maxDiv.diff) >= LEAD_DIVERGENCE_PCT) {
      const marketLeads = maxDiv.diff > 0;
      const sameAsShown = maxDiv.pick === marketLeader.pick;
      const lead =
        (marketLeads ? "市场更看好" : "同事更看好") +
        (sameAsShown ? "" : PICK_SHORT[maxDiv.pick]);
      dv = (
        <div className={"dv hot " + (marketLeads ? "mk" : "cr")}>
          <span
            className="spark"
            data-tip={DIVERGENCE_TIP}
            tabIndex={0}
            role="button"
            aria-label="分歧说明"
          >
            ⚡
          </span>
          {lead}
        </div>
      );
    }
    return (
      <div className="big">
        <div className="srclbl">市场·{PICK_SHORT[marketLeader.pick]}</div>
        <div className="pct">{marketLeader.pct}%</div>
        {dv}
      </div>
    );
  }

  if (row.crowd.leaderPick && row.crowd.leaderPct != null) {
    const pick = row.crowd.leaderPick;
    const dec = row.crowdOdds ? row.crowdOdds[pick] : null;
    return (
      <div className="big">
        <div className="srclbl cr">同事·{PICK_SHORT[pick]}</div>
        <div className="pct">{row.crowd.leaderPct}%</div>
        <div className="cap">
          {dec != null ? `赔率 ${formatDecimal(dec)}x` : "暂无市场对照"}
        </div>
      </div>
    );
  }

  return (
    <div className="big">
      <div className="cap">暂无赔率</div>
    </div>
  );
}

function MatchRow({ row }: { row: RowVM }) {
  return (
    <Link href={`/match/${row.id}`} className="mrow" prefetch={false}>
      <MatchMeta row={row} />
      <MatchTeams row={row} />
      <MatchBig row={row} />
    </Link>
  );
}

export function ScheduleTimeline({
  rows,
  todayKey,
}: {
  rows: RowVM[];
  todayKey: string;
}) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const visible = useMemo(
    () => rows.filter((r) => matchesStatus(r.status, filter)),
    [rows, filter],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, RowVM[]>();
    for (const row of visible) {
      const list = map.get(row.dateKey) ?? [];
      list.push(row);
      map.set(row.dateKey, list);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <>
      <hr className="rule ink" />
      <div className="subtabs">
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={filter === o.value ? "on" : ""}
            onClick={() => setFilter(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {byDate.length === 0 ? (
        <p
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "var(--low)",
            fontSize: 13,
          }}
        >
          没有符合条件的比赛
        </p>
      ) : (
        byDate.map(([key, dayRows]) => {
          const heading = dayHeading(key, todayKey);
          const primary = heading.primary || dayRows[0].dateLabel;
          const secondary = heading.primary
            ? `${dayRows[0].dateLabel} · ${dayRows.length} 场`
            : `${dayRows.length} 场`;
          return (
            <section key={key}>
              <div className="daylabel">
                <span className={`big${heading.isToday ? " today" : ""}`}>
                  {primary}
                </span>
                <span className="sm">{secondary}</span>
              </div>
              {dayRows.map((row, idx) => (
                <div key={row.id} id={`m-${row.id}`} className="mrow-anchor">
                  {idx === 0 && <hr className="rule" />}
                  <MatchRow row={row} />
                  <hr className="rule" />
                </div>
              ))}
            </section>
          );
        })
      )}
    </>
  );
}
