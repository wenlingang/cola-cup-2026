import type { VoteTally } from "../db/queries/votes";

export const MIN_SAMPLE = 3;

/** Min gap (percentage points) between market and crowd before surfacing a "更看好" lead. */
export const LEAD_DIVERGENCE_PCT = 33;

export type VoteOdds = {
  p_home: number;
  p_draw: number | null;
  p_away: number;
  d_home: number | null;
  d_draw: number | null;
  d_away: number | null;
  total: number;
  lowSample: boolean;
};

/**
 * Pari-mutuel pool odds from the crowd's stakes. An outcome's implied
 * probability is its share of all bottles wagered; its decimal odds are the
 * whole pool divided by that outcome's stake — i.e. what each backing bottle
 * returns if it wins. An outcome with no stake has no defined odds (null).
 *
 * This mirrors settlement exactly: losers forfeit their stake into the pool and
 * winners split it in proportion to stake, so payouts can never exceed the pool
 * (the house never subsidises).
 */
export function computeVoteOdds(
  tally: VoteTally,
  allowsDraw: boolean,
): VoteOdds | null {
  if (tally.stakeTotal === 0) return null;

  const share = (stake: number) => stake / tally.stakeTotal;
  const decimal = (stake: number) =>
    stake > 0 ? tally.stakeTotal / stake : null;

  return {
    p_home: share(tally.home),
    p_draw: allowsDraw ? share(tally.draw) : null,
    p_away: share(tally.away),
    d_home: decimal(tally.home),
    d_draw: allowsDraw ? decimal(tally.draw) : null,
    d_away: decimal(tally.away),
    total: tally.voters,
    lowSample: tally.voters < MIN_SAMPLE,
  };
}
