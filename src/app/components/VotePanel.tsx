"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Pick } from "../../lib/stage";

export type VotePanelProps = {
  matchId: number;
  picks: { key: Pick; label: string }[];
  oddsDecimal: Partial<Record<Pick, number | null>>;
  votable: boolean;
  hasIdentity: boolean;
  initialPick: Pick | null;
  initialStake: number | null;
  stake: number;
  nextMatchId: number | null;
};

export function VotePanel({
  matchId,
  picks,
  oddsDecimal,
  votable,
  hasIdentity,
  initialPick,
  initialStake,
  stake,
  nextMatchId,
}: VotePanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pick, setPick] = useState<Pick | null>(initialPick);
  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState<Pick | null>(initialPick);

  function pickLabel(p: Pick): string {
    return picks.find((x) => x.key === p)?.label ?? p;
  }

  if (!hasIdentity) {
    return (
      <div className="vp">
        <h2 className="disp">想预测？</h2>
        <p className="signed-lock">
          先去{" "}
          <Link
            href="/identity"
            style={{
              color: "var(--red)",
              borderBottom: "1px solid color-mix(in srgb,var(--red) 45%,transparent)",
            }}
          >
            设置身份
          </Link>
          。
        </p>
      </div>
    );
  }

  if (!votable) {
    return (
      <div className="vp">
        <h2 className="disp">{initialPick ? "已锁定" : "未开放"}</h2>
        <p className="signed-lock">
          {initialPick ? (
            <>
              🔒 你看好 <b>{pickLabel(initialPick)}</b> · {initialStake} 瓶。
            </>
          ) : (
            <>🔒 当前无法预测（无赔率或已锁定）。</>
          )}
        </p>
      </div>
    );
  }

  const decimal = pick ? oddsDecimal[pick] ?? null : null;
  const potential =
    decimal != null && Number.isFinite(decimal) ? stake * (decimal - 1) : null;

  async function submit() {
    if (!pick) return;
    setError(null);
    setSaving(true);
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, pick }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "预测失败");
      return;
    }
    setSaved(true);
    setConfirmed(pick);
    startTransition(() => router.refresh());
    setTimeout(() => setSaved(false), 1800);
  }

  async function cancel() {
    setError(null);
    setCanceling(true);
    const res = await fetch("/api/votes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    });
    setCanceling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "取消失败");
      return;
    }
    setPick(null);
    setConfirmed(null);
    setSaved(false);
    startTransition(() => router.refresh());
  }

  const isUnchanged = pick != null && pick === confirmed;
  const ctaLabel = saving
    ? "预测中…"
    : saved
      ? "✅ 已记录"
      : isUnchanged
        ? `✅ 当前已预测 ${pickLabel(pick)}`
        : pick
          ? `🥤 提交预测 · ${pickLabel(pick)} · ${stake} 瓶`
          : "🥤 选个看好的";

  return (
    <div className="vp">
      <h2 className="disp">你看好谁？</h2>

      <div className={picks.length === 2 ? "picks two" : "picks"}>
        {picks.map((p) => (
          <button
            key={p.key}
            type="button"
            className={"p" + (pick === p.key ? " sel" : "")}
            onClick={() => setPick(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p
        className="changenote"
        style={{
          textAlign: "left",
          color: "var(--mid)",
          fontSize: 13,
          padding: "18px 0 0",
        }}
      >
        本场固定下注 <b>{stake} 瓶</b> · 猜错就请这几瓶
      </p>

      {potential != null && pick ? (
        <p className="pot">
          猜中约赢 <b>+{potential.toFixed(1)} 瓶</b> · 按当前预测赔率
          <br />
          <span style={{ color: "var(--low)", fontSize: 12 }}>
            零头会累计，攒满 1 瓶即可领
          </span>
        </p>
      ) : (
        <p className="pot">选个看好的</p>
      )}

      {error && <p className="formerror">{error}</p>}

      <button
        type="button"
        className="cta"
        disabled={!pick || isUnchanged || saving || canceling}
        onClick={submit}
      >
        {ctaLabel}
      </button>

      <div className="vp-foot">
        {nextMatchId != null ? (
          <Link
            href={`/match/${nextMatchId}`}
            className={"vp-back" + (saved ? " go" : "")}
          >
            下一场 <span className="bk-arrow">→</span>
          </Link>
        ) : (
          <Link
            href={`/#m-${matchId}`}
            className={"vp-back" + (saved ? " go" : "")}
          >
            <span className="bk-arrow">←</span> 返回赛程
          </Link>
        )}
        <span className="vp-hint">
          开赛前可随时改或
          {confirmed ? (
            <button
              type="button"
              className="vp-cancel-link"
              disabled={saving || canceling}
              onClick={cancel}
            >
              {canceling ? "取消中…" : "取消预测"}
            </button>
          ) : (
            "取消预测"
          )}
        </span>
      </div>
    </div>
  );
}
