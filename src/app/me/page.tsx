import { redirect } from "next/navigation";
import { getUserLedger, getUserNet } from "../../db/queries/ledger";
import { getUserRedemptions } from "../../db/queries/redemptions";
import { getCurrentUser } from "../../lib/identity";
import { formatBottles } from "../../lib/format";
import { PICK_LABELS, stageLabel, type Pick } from "../../lib/stage";
import { getDrink } from "../../lib/drinks";
import { RedeemPanel } from "../components/RedeemPanel";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/identity");
  }

  const ledger = getUserLedger(user.id);
  const balance = getUserNet(user.id);
  const redemptions = getUserRedemptions(user.id);
  const wins = ledger.filter((l) => l.won).length;
  const hugeClass =
    balance > 0 ? "huge" : balance < 0 ? "huge neg" : "huge zero";

  return (
    <section>
      <div className="me">
        <div className="who">
          <span className="em">{user.emoji ?? "👤"}</span>
          <span>
            <div className="nm disp">{user.nickname}</div>
            <div className="tag">
              参与 {ledger.length} 场 · 猜中 {wins}
            </div>
          </span>
        </div>
        <hr className="rule ink" style={{ marginTop: 18 }} />
        <div className="netlbl">可用额度</div>
        <div className={hugeClass}>
          {formatBottles(balance)}
          <small> 额度</small>
        </div>
        <p className="note">额度 = 累计赢得 − 已兑换。1 额度可兑 1 瓶可乐。</p>
      </div>

      <hr className="rule" />
      <RedeemPanel balance={balance} />

      {redemptions.length > 0 && (
        <>
          <div className="ledh disp">兑换记录</div>
          <hr className="rule" />
          {redemptions.map((r) => {
            const drink = getDrink(r.drink);
            return (
              <div key={r.id}>
                <div className="led">
                  <span className="info">
                    <div className="t">
                      {drink?.emoji ?? "🥤"} {drink?.name ?? r.drink} × {r.qty}
                    </div>
                    <div className="m">兑换 · {r.unit_cost} 额度 / 瓶</div>
                  </span>
                  <span className="d neg">-{r.cost.toFixed(1)}</span>
                </div>
                <hr className="rule" />
              </div>
            );
          })}
        </>
      )}

      <div className="ledh disp">结算明细</div>
      <hr className="rule" />
      {ledger.length === 0 ? (
        <p
          style={{
            padding: "32px 0",
            textAlign: "center",
            color: "var(--low)",
            fontSize: 13,
          }}
        >
          还没有已结算的投注
        </p>
      ) : (
        <>
          {ledger.map((row) => (
            <div key={row.id}>
              <div className="led">
                <span className={`dot ${row.won === 1 ? "w" : "l"}`}></span>
                <span className="info">
                  <div className="t">
                    {row.home_flag ?? ""} {row.home_name} vs {row.away_name}{" "}
                    {row.away_flag ?? ""}
                  </div>
                  <div className="m">
                    {stageLabel(row.stage)} · 看好 {PICK_LABELS[row.pick as Pick]} ·{" "}
                    {row.stake} 瓶 · 赔率 {row.d_used.toFixed(2)}
                  </div>
                </span>
                <span className={`d ${row.delta >= 0 ? "pos" : "neg"}`}>
                  {formatBottles(row.delta)}
                </span>
              </div>
              <hr className="rule" />
            </div>
          ))}
        </>
      )}
    </section>
  );
}
