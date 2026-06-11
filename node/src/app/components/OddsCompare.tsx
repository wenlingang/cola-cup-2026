import { PICK_LABELS, type Pick } from "../../lib/stage";
import { LEAD_DIVERGENCE_PCT } from "../../lib/voteOdds";

export type OutcomeOdds = {
  key: Pick;
  teamLabel: string;
  marketP: number | null;
  marketD: number | null;
  crowdP: number | null;
  crowdD: number | null;
};

function clampWidth(p: number | null): number {
  if (p == null) return 0;
  const clamped = Math.max(0, Math.min(1, p));
  return Math.round(clamped * 100);
}

function pctText(p: number | null): string {
  return p == null ? "—" : `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

function findFeaturedIndex(outcomes: OutcomeOdds[]): number {
  let bestIndex = -1;
  let bestValue = -Infinity;
  outcomes.forEach((o, i) => {
    if (o.marketP != null && o.marketP > bestValue) {
      bestValue = o.marketP;
      bestIndex = i;
    }
  });
  if (bestIndex !== -1) return bestIndex;
  outcomes.forEach((o, i) => {
    if (o.crowdP != null && o.crowdP > bestValue) {
      bestValue = o.crowdP;
      bestIndex = i;
    }
  });
  return bestIndex;
}

function findLeadIndex(outcomes: OutcomeOdds[]): number {
  let bestIndex = -1;
  let bestDiff = -1;
  outcomes.forEach((o, i) => {
    if (o.crowdP == null || o.crowdP <= 0 || o.marketP == null) return;
    const diff = Math.abs(o.marketP - o.crowdP);
    if (diff > bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  });
  return bestIndex;
}

function renderLead(
  crowdP: number | null,
  marketP: number | null,
  isFeatured: boolean,
) {
  if (crowdP == null || marketP == null) return null;
  const diff = Math.round((marketP - crowdP) * 100);
  if (Math.abs(diff) < LEAD_DIVERGENCE_PCT) {
    return null;
  }
  if (diff > 0) {
    return (
      <span className={"o-lead mk-lead" + (isFeatured ? " strong" : "")}>
        市场更看好
      </span>
    );
  }
  return <span className="o-lead cr-lead">同事更看好</span>;
}

export function OddsCompare({
  outcomes,
  crowdTotal,
  lowSample,
  locked: _locked,
  polymarketUrl,
}: {
  outcomes: OutcomeOdds[];
  crowdTotal: number;
  lowSample: boolean;
  locked: boolean;
  polymarketUrl?: string | null;
}) {
  const featuredIndex = findFeaturedIndex(outcomes);
  const leadIndex = findLeadIndex(outcomes);
  const hasMarket = outcomes.some((o) => o.marketP != null);
  const crowdLegend = crowdTotal > 0 ? `同事 · ${crowdTotal} 人` : "同事";
  const showLowSample = lowSample && crowdTotal > 0;

  return (
    <div className="oc">
      <h2 className="disp">赔率对比</h2>
      <p className="oc-note">
        每个结果对比两个来源 —— <b className="mk">⚽ Polymarket 市场</b> 与{" "}
        <b className="cr">🥤 同事预测</b>。
        <b style={{ color: "var(--hi)" }}>结算只看同事预测</b>
        （开赛前 1 小时锁定），市场仅作参考。
      </p>

      <div className="bar-head">
        <div className="legend">
          <span className="lg">
            <i className="mk" />
            市场
            {!hasMarket && <span className="lg-tag info">未开盘</span>}
          </span>
          <span className="lg">
            <i className="cr" />
            {crowdLegend}
            {showLowSample && (
              <span className="lg-tag warn" title="样本不足，赔率仅供参考">
                样本少
              </span>
            )}
          </span>
        </div>
        {polymarketUrl && (
          <a
            className="market-link"
            href={polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            ⚽ Polymarket 市场数据 <span className="arrow">↗</span>
          </a>
        )}
      </div>

      {outcomes.map((o, i) => {
        const isFeatured = i === featuredIndex;
        const pickLabel = PICK_LABELS[o.key];
        const showSmall = o.key !== "draw";
        return (
          <div
            key={o.key}
            className={isFeatured ? "odds-out featured" : "odds-out"}
          >
            <div className="odds-head">
              <span className="o-nm">
                {o.teamLabel}
                {showSmall && <small>{pickLabel}</small>}
              </span>
              {i === leadIndex && renderLead(o.crowdP, o.marketP, isFeatured)}
            </div>
            <div className="odds-bars">
              <div className="ob">
                <span className="ob-lbl mk">⚽ 市场</span>
                <span className="ob-track">
                  <i
                    className="mk"
                    style={{ width: `${clampWidth(o.marketP)}%` }}
                  />
                </span>
                <span className="ob-pct mk">{pctText(o.marketP)}</span>
              </div>
              <div className="ob">
                <span className="ob-lbl cr">🥤 同事</span>
                <span className="ob-track">
                  <i
                    className="cr"
                    style={{ width: `${clampWidth(o.crowdP)}%` }}
                  />
                </span>
                <span className="ob-pct cr">{pctText(o.crowdP)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
