"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DRINKS } from "../../lib/drinks";

const EPSILON = 1e-9;

function fmtCredits(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function RedeemPanel({ balance }: { balance: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const qtyOf = (key: string) => qtys[key] ?? 1;
  const setQty = (key: string, n: number) =>
    setQtys((prev) => ({ ...prev, [key]: Math.max(1, n) }));

  async function redeem(key: string) {
    const qty = qtyOf(key);
    setError(null);
    setDone(null);
    setBusy(key);
    const res = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drink: key, qty }),
    });
    setBusy(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "兑换失败");
      return;
    }
    setQty(key, 1);
    setDone(key);
    startTransition(() => router.refresh());
    setTimeout(() => setDone((d) => (d === key ? null : d)), 1800);
  }

  return (
    <div className="redeem">
      {DRINKS.map((d) => {
        const qty = qtyOf(d.key);
        const total = d.cost * qty;
        const affordable = balance + EPSILON >= total;
        return (
          <div className="rdrink" key={d.key}>
            <span className="em">{d.emoji}</span>
            <span className="meta">
              <div className="dn">{d.name}</div>
              <div className="price">{fmtCredits(d.cost)} 额度 / 瓶</div>
            </span>
            <span className="stepper">
              <button
                type="button"
                onClick={() => setQty(d.key, qty - 1)}
                disabled={qty <= 1}
                aria-label="减少"
              >
                −
              </button>
              <b>{qty}</b>
              <button
                type="button"
                onClick={() => setQty(d.key, qty + 1)}
                aria-label="增加"
              >
                ＋
              </button>
            </span>
            <button
              type="button"
              className="rbtn"
              disabled={!affordable || busy === d.key}
              onClick={() => redeem(d.key)}
            >
              {busy === d.key
                ? "兑换中…"
                : done === d.key
                  ? "✅ 已兑"
                  : `兑换 · ${fmtCredits(total)}`}
            </button>
          </div>
        );
      })}
      {error && <p className="formerror">{error}</p>}
      <p className="redeem-hint">
        兑换后自动扣额度，线下凭记录领饮料。额度不足时按钮不可点。
      </p>
    </div>
  );
}
