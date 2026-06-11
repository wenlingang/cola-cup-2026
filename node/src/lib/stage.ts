export type Stage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "third"
  | "final";

export type Pick = "home" | "draw" | "away";

const KNOCKOUT_STAGES: ReadonlySet<string> = new Set([
  "r32",
  "r16",
  "qf",
  "sf",
  "third",
  "final",
]);

export function isKnockout(stage: string): boolean {
  return KNOCKOUT_STAGES.has(stage);
}

export function allowsDraw(stage: string): boolean {
  return !isKnockout(stage);
}

export function validPicks(stage: string): Pick[] {
  return allowsDraw(stage) ? ["home", "draw", "away"] : ["home", "away"];
}

export const STAGE_LABELS: Record<string, string> = {
  group: "小组赛",
  r32: "32 强",
  r16: "16 强",
  qf: "8 强",
  sf: "半决赛",
  third: "季军赛",
  final: "决赛",
};

export const PICK_LABELS: Record<Pick, string> = {
  home: "主胜",
  draw: "平局",
  away: "客胜",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
