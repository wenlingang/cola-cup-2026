import { getLeaderboard } from "../../db/queries/ledger";
import { getCurrentUser } from "../../lib/identity";
import { formatBottles } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const board = getLeaderboard();
  const me = await getCurrentUser();

  return (
    <section>
      <div className="lbh">
        <h1 className="disp">可乐榜 🏆</h1>
        <div className="sub">按总分排序（兑换不影响排名）</div>
      </div>
      <hr className="rule ink" />

      {board.length === 0 ? (
        <p style={{ padding: "40px 0", textAlign: "center", color: "var(--low)", fontSize: 13 }}>
          还没有人参与
        </p>
      ) : (
        board.map((entry, i) => {
          const isMe = me?.id === entry.id;
          const isLeader = i === 0 && entry.bets > 0;
          const totalClass =
            entry.total > 0 ? "b pos" : entry.total < 0 ? "b neg" : "b zero";
          const hitText =
            entry.bets > 0
              ? ` · ${Math.round((entry.wins / entry.bets) * 100)}% 命中`
              : "";
          const redeemText =
            entry.redeemed > 0 ? `已兑 ${entry.redeemed.toFixed(1)}` : "未兑换";
          return (
            <div key={entry.id}>
              <div className={isLeader ? "lr leader" : "lr"}>
                <span className="rk">{i + 1}</span>
                <span className="em">{entry.emoji ?? "👤"}</span>
                <span className="who">
                  <div className="nm">
                    {entry.nickname}
                    {isMe && <span className="you">你</span>}
                  </div>
                  <div className="m">
                    {entry.bets} 场 · 猜中 {entry.wins}
                    {hitText}
                  </div>
                </span>
                <span className="n">
                  <div className={totalClass}>{formatBottles(entry.total)}</div>
                  <div className="st">{redeemText}</div>
                </span>
              </div>
              <hr className="rule" />
            </div>
          );
        })
      )}
    </section>
  );
}
