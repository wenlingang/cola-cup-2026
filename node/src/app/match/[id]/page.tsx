import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getMatch,
  getMatchOdds,
  getPolyMarketSlug,
  getAllMatches,
  type OddsRow,
} from "../../../db/queries/matches";
import {
  getVoteTally,
  getUserVote,
  getMatchVotesDetailed,
} from "../../../db/queries/votes";
import { getCurrentUser } from "../../../lib/identity";
import { deriveStatus, isVotable } from "../../../lib/matchState";
import { allowsDraw, validPicks, stageLabel, type Pick } from "../../../lib/stage";
import { stakeForStage } from "../../../lib/betting";
import { computeVoteOdds } from "../../../lib/voteOdds";
import { formatKickoff } from "../../../lib/format";
import { StatusBadge } from "../../components/StatusBadge";
import { OddsCompare, type OutcomeOdds } from "../../components/OddsCompare";
import { VotePanel } from "../../components/VotePanel";
import { VotesList } from "../../components/VotesList";

const POLYMARKET_EVENT_BASE = "https://polymarket.com/event/";

export const dynamic = "force-dynamic";

function marketP(odds: OddsRow | null, key: Pick): number | null {
  if (!odds) return null;
  return key === "home" ? odds.p_home : key === "draw" ? odds.p_draw : odds.p_away;
}
function marketD(odds: OddsRow | null, key: Pick): number | null {
  if (!odds) return null;
  return key === "home" ? odds.d_home : key === "draw" ? odds.d_draw : odds.d_away;
}

type SchedMatch = ReturnType<typeof getAllMatches>[number];

function pickNextMatchId(all: SchedMatch[], currentId: number): number | null {
  const sorted = [...all].sort(
    (a, b) => a.kickoff_at - b.kickoff_at || a.id - b.id,
  );
  const idx = sorted.findIndex((m) => m.id === currentId);
  if (idx === -1) return null;
  return sorted[idx + 1]?.id ?? null;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = getMatch(Number(id));
  if (!match) notFound();

  const user = await getCurrentUser();
  const nextMatchId = user ? pickNextMatchId(getAllMatches(), match.id) : null;
  const { polymarket, locked } = getMatchOdds(match.id);
  const marketOdds = locked ?? polymarket;
  const tally = getVoteTally(match.id);
  const withDraw = allowsDraw(match.stage);
  const voteOdds = computeVoteOdds(tally, withDraw);
  const userVote = user ? getUserVote(match.id, user.id) : null;
  const votes = getMatchVotesDetailed(match.id);
  const polySlug = getPolyMarketSlug(match.id);
  const polymarketUrl = polySlug ? `${POLYMARKET_EVENT_BASE}${polySlug}` : null;

  const status = deriveStatus({
    kickoffAt: match.kickoff_at,
    bettable: !!match.home.id && !!match.away.id,
    settled: !!match.settled,
    now: Date.now(),
  });

  const teamLabel: Record<Pick, string> = {
    home: match.home.name,
    draw: "平局",
    away: match.away.name,
  };

  const crowdP = (key: Pick): number | null =>
    key === "home"
      ? (voteOdds?.p_home ?? null)
      : key === "draw"
        ? (voteOdds?.p_draw ?? null)
        : (voteOdds?.p_away ?? null);
  const crowdD = (key: Pick): number | null =>
    key === "home"
      ? (voteOdds?.d_home ?? null)
      : key === "draw"
        ? (voteOdds?.d_draw ?? null)
        : (voteOdds?.d_away ?? null);

  const picks = validPicks(match.stage);
  const outcomes: OutcomeOdds[] = picks.map((key) => ({
    key,
    teamLabel: teamLabel[key],
    marketP: marketP(marketOdds, key),
    marketD: marketD(marketOdds, key),
    crowdP: crowdP(key),
    crowdD: crowdD(key),
  }));

  const voteDecimal: Partial<Record<Pick, number | null>> = {};
  for (const key of picks) voteDecimal[key] = crowdD(key);

  const middleVs =
    match.settled && match.home_score != null && match.away_score != null
      ? `${match.home_score}–${match.away_score}`
      : "VS";

  return (
    <section>
      <div className="detail-head">
        <Link href={`/#m-${match.id}`} className="back-btn">
          <span className="bk-arrow">←</span> 返回赛程
        </Link>
        <span className="detail-stage">
          {stageLabel(match.stage)}
          {match.group_name ? ` · ${match.group_name}` : ""}
        </span>
        <StatusBadge status={status} />
      </div>
      <hr className="rule" />

      <div className="detail-vs">
        <span className="team">
          <span className="flag">{match.home.flag ?? "🏳️"}</span>
          <span className="nm">{match.home.name}</span>
        </span>
        <span className="x">{middleVs}</span>
        <span className="team">
          <span className="flag">{match.away.flag ?? "🏳️"}</span>
          <span className="nm">{match.away.name}</span>
        </span>
      </div>

      <div className="detail-when">
        {formatKickoff(match.kickoff_at)}
        {match.venue && <span className="venue"> · {match.venue}</span>}
      </div>
      <hr className="rule" />

      <div className="detail-cols">
        <div className="left">
          <OddsCompare
            outcomes={outcomes}
            crowdTotal={tally.voters}
            lowSample={!!voteOdds?.lowSample}
            locked={!!locked}
            polymarketUrl={polymarketUrl}
          />
        </div>
        <div className="right">
          <VotePanel
            matchId={match.id}
            picks={picks.map((key) => ({ key, label: teamLabel[key] }))}
            oddsDecimal={voteDecimal}
            votable={isVotable(status)}
            hasIdentity={!!user}
            initialPick={(userVote?.pick as Pick) ?? null}
            initialStake={userVote?.stake ?? null}
            stake={stakeForStage(match.stage)}
            nextMatchId={nextMatchId}
          />
          <VotesList
            votes={votes}
            teamLabel={teamLabel}
            result={(match.result as Pick) ?? null}
            settled={!!match.settled}
          />
        </div>
      </div>
    </section>
  );
}
