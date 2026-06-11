import type { Pick } from "./stage";

export type VoteRow = { user_id: number; pick: Pick; stake: number };

export type VoteDelta = VoteRow & { d_used: number; won: number; delta: number };

/**
 * Pari-mutuel payout (pure, no writes): each loser forfeits exactly their stake
 * into the pool; the winners split that pool in proportion to their stake. The
 * batch is zero-sum, so total winnings can never exceed the pool — the house
 * never subsidises (it only keeps the floored remainder). d_used is the implied
 * pool decimal for the bettor's own pick (total pool ÷ that pick's stake).
 */
export function deltasFromVotes(votes: VoteRow[], result: Pick): VoteDelta[] {
  const total = votes.reduce((sum, v) => sum + v.stake, 0);
  const winStake = votes
    .filter((v) => v.pick === result)
    .reduce((sum, v) => sum + v.stake, 0);
  const loseStake = total - winStake;
  const pickStake: Partial<Record<Pick, number>> = {};
  for (const v of votes) pickStake[v.pick] = (pickStake[v.pick] ?? 0) + v.stake;

  return votes.map((v) => {
    const won = v.pick === result ? 1 : 0;
    const delta = won
      ? winStake > 0
        ? (v.stake / winStake) * loseStake
        : 0
      : -v.stake;
    const ownStake = pickStake[v.pick] ?? v.stake;
    const d_used = ownStake > 0 ? total / ownStake : 1;
    return { ...v, d_used, won, delta };
  });
}
