import type { Stage } from "./stage";

/** Fixed stake per stage, in bottles of coke. Group is cheap (≈28 group matches
 *  a week), stakes rise through the knockout rounds. Single source of truth —
 *  edit here to change. Stake is server-determined by stage; the client only
 *  picks a side. */
const STAKE_BY_STAGE: Record<Stage, number> = {
  group: 1,
  r32: 2,
  r16: 2,
  qf: 2,
  sf: 5,
  third: 5,
  final: 5,
};

export function stakeForStage(stage: string): number {
  return STAKE_BY_STAGE[stage as Stage] ?? 1;
}
