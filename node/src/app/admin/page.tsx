import { getAllMatches } from "../../db/queries/matches";
import { getAllTallies, getMatchVotesDetailed } from "../../db/queries/votes";
import {
  getSettlements,
  getSettlementDetail,
  type SettlementDetail,
} from "../../db/queries/settlements";
import { getCurrentSettler } from "../../lib/settler";
import { stageLabel, allowsDraw, isKnockout, type Pick } from "../../lib/stage";
import { AdminPanel, type TodoMatch } from "../components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const settler = await getCurrentSettler();
  if (!settler) {
    return (
      <section className="adm-locked">
        <h1>⚙️ 结算后台</h1>
        <p>此页面仅限结算账号访问。</p>
        <p>请用结算账号登录后再来。</p>
      </section>
    );
  }

  const now = Date.now();
  const matches = getAllMatches();
  const tallies = getAllTallies();

  const todo: TodoMatch[] = matches
    .filter((m) => !m.settled && m.kickoff_at <= now)
    .sort((a, b) => a.kickoff_at - b.kickoff_at)
    .map((m) => ({
      id: m.id,
      home: m.home.name,
      away: m.away.name,
      homeFlag: m.home.flag,
      awayFlag: m.away.flag,
      stageLabel: stageLabel(m.stage),
      kickoffAt: m.kickoff_at,
      votes: tallies.get(m.id)?.voters ?? 0,
      allowsDraw: allowsDraw(m.stage),
      isKnockout: isKnockout(m.stage),
      result: (m.result as Pick) ?? null,
      homeScore: m.home_score,
      awayScore: m.away_score,
      voteLines: getMatchVotesDetailed(m.id).map((v) => ({
        nickname: v.nickname,
        emoji: v.emoji,
        pick: v.pick,
        stake: v.stake,
      })),
    }));

  const records: SettlementDetail[] = getSettlements()
    .map((s) => getSettlementDetail(s.id))
    .filter((d): d is SettlementDetail => d !== null);

  return (
    <section>
      <div className="adm-head">
        <h1>⚙️ 结算后台</h1>
        <p>
          勾选已结束的比赛 → 结算预览每人净瓶数 → 确定生成结算记录，账本随即对同事可见。
        </p>
      </div>
      <hr className="rule ink" />
      <AdminPanel todo={todo} records={records} />
    </section>
  );
}
