import { Fragment } from "react";
import type { VoteDetail } from "../../db/queries/votes";
import { type Pick } from "../../lib/stage";

const PICK_TAG_CLASS: Record<Pick, string> = {
  home: "tag h",
  draw: "tag d",
  away: "tag a",
};

export function VotesList({
  votes,
  teamLabel,
  result,
  settled,
}: {
  votes: VoteDetail[];
  teamLabel: Record<Pick, string>;
  result: Pick | null;
  settled: boolean;
}) {
  const showResult = settled && result != null;

  return (
    <div className="voters">
      <hr className="rule" style={{ marginTop: 24 }} />
      <h3 className="disp" style={{ paddingTop: 18 }}>
        同事预测 · {votes.length} 人
      </h3>
      <hr className="rule" />
      {votes.length === 0 ? (
        <p style={{ padding: "20px 0", color: "var(--low)", fontSize: 13 }}>
          还没有人预测，来当第一个 🥤
        </p>
      ) : (
        votes.map((vote) => {
          const won = showResult ? vote.pick === result : null;
          return (
            <Fragment key={vote.user_id}>
              <div className="vrow">
                <span className="em">{vote.emoji ?? "👤"}</span>
                <span className="nm">{vote.nickname}</span>
                <span className={PICK_TAG_CLASS[vote.pick]}>
                  {teamLabel[vote.pick]}
                </span>
                <span className="pk">
                  🥤 <b>{vote.stake}</b> 瓶
                </span>
                {won != null && (
                  <span className={won ? "res w" : "res l"}>
                    {won ? "✓" : "✗"}
                  </span>
                )}
              </div>
              <hr className="rule" />
            </Fragment>
          );
        })
      )}
    </div>
  );
}
