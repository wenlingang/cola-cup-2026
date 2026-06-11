import { db } from "../../db/client";
import { fetchJsonRetry } from "./http";

const BASE =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026";

type RawTeam = {
  name: string;
  name_normalised?: string;
  flag_icon?: string;
  fifa_code?: string;
  confed?: string;
  continent?: string;
};

type RawMatch = {
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
};

// Stable identity for idempotent re-import. Knockout slots carry a fixed `num`
// (73, 74, …) that survives "2A" → real-team resolution; group matches have
// fixed teams, so a team-based key is stable for them.
function externalKey(match: RawMatch): string {
  return match.num != null
    ? `m:${match.num}`
    : `${match.round}|${match.date}|${match.team1}|${match.team2}`;
}

const ZH_NAMES: Record<string, string> = {
  Algeria: "阿尔及利亚",
  Argentina: "阿根廷",
  Australia: "澳大利亚",
  Austria: "奥地利",
  Belgium: "比利时",
  "Bosnia & Herzegovina": "波黑",
  "Bosnia and Herzegovina": "波黑",
  Brazil: "巴西",
  Canada: "加拿大",
  "Cape Verde": "佛得角",
  Colombia: "哥伦比亚",
  Croatia: "克罗地亚",
  "Curaçao": "库拉索",
  "Czech Republic": "捷克",
  Czechia: "捷克",
  "DR Congo": "刚果（金）",
  Ecuador: "厄瓜多尔",
  Egypt: "埃及",
  England: "英格兰",
  France: "法国",
  Germany: "德国",
  Ghana: "加纳",
  Haiti: "海地",
  Iran: "伊朗",
  Iraq: "伊拉克",
  "Ivory Coast": "科特迪瓦",
  Japan: "日本",
  Jordan: "约旦",
  Mexico: "墨西哥",
  Morocco: "摩洛哥",
  Netherlands: "荷兰",
  "New Zealand": "新西兰",
  Norway: "挪威",
  Panama: "巴拿马",
  Paraguay: "巴拉圭",
  Portugal: "葡萄牙",
  Qatar: "卡塔尔",
  "Saudi Arabia": "沙特阿拉伯",
  Scotland: "苏格兰",
  Senegal: "塞内加尔",
  "South Africa": "南非",
  "South Korea": "韩国",
  Spain: "西班牙",
  Sweden: "瑞典",
  Switzerland: "瑞士",
  Tunisia: "突尼斯",
  Turkey: "土耳其",
  USA: "美国",
  Uruguay: "乌拉圭",
  Uzbekistan: "乌兹别克斯坦",
};

const ROUND_TO_STAGE: Record<string, string> = {
  "Round of 32": "r32",
  "Round of 16": "r16",
  "Quarter-final": "qf",
  "Semi-final": "sf",
  "Match for third place": "third",
  Final: "final",
};

function mapStage(round: string): string {
  if (round.startsWith("Matchday")) return "group";
  return ROUND_TO_STAGE[round] ?? "group";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// openfootball time looks like "13:00 UTC-6"; convert to UTC epoch ms.
function parseKickoff(date: string, time: string): number {
  const [hm, tz] = time.trim().split(/\s+/);
  const offsetMatch = tz?.match(/UTC([+-])(\d{1,2})(?::?(\d{2}))?/);
  let offset = "+00:00";
  if (offsetMatch) {
    const sign = offsetMatch[1];
    const hours = pad2(Number(offsetMatch[2]));
    const minutes = pad2(Number(offsetMatch[3] ?? 0));
    offset = `${sign}${hours}:${minutes}`;
  }
  const timestamp = new Date(`${date}T${hm}:00${offset}`).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Unable to parse kickoff: "${date}" "${time}"`);
  }
  return timestamp;
}

/** Import teams + the full fixture list from openfootball. Idempotent upsert. */
export async function runImportSchedule(): Promise<{
  teams: number;
  matches: number;
}> {
  const teams = await fetchJsonRetry<RawTeam[]>(`${BASE}/worldcup.teams.json`);
  const schedule = await fetchJsonRetry<{ name: string; matches: RawMatch[] }>(
    `${BASE}/worldcup.json`,
  );

  const upsertTeam = db.prepare(`
    INSERT INTO teams (code, name, name_zh, flag, confed, aliases)
    VALUES (@code, @name, @nameZh, @flag, @confed, @aliases)
    ON CONFLICT(name) DO UPDATE SET
      code = excluded.code,
      name_zh = excluded.name_zh,
      flag = excluded.flag,
      confed = excluded.confed,
      aliases = excluded.aliases
  `);

  const importTeams = db.transaction((rows: RawTeam[]) => {
    for (const team of rows) {
      const aliases: string[] = [];
      if (team.name_normalised && team.name_normalised !== team.name) {
        aliases.push(team.name_normalised);
      }
      if (team.fifa_code) aliases.push(team.fifa_code);
      upsertTeam.run({
        code: team.fifa_code ?? null,
        name: team.name,
        nameZh: ZH_NAMES[team.name] ?? team.name_normalised ?? team.name,
        flag: team.flag_icon ?? null,
        confed: team.confed ?? null,
        aliases: JSON.stringify(aliases),
      });
    }
  });
  importTeams(teams);

  const teamRows = db.prepare("SELECT id, name FROM teams").all() as {
    id: number;
    name: string;
  }[];
  const nameToId = new Map(teamRows.map((row) => [row.name, row.id]));

  const upsertMatch = db.prepare(`
    INSERT INTO matches
      (external_key, group_name, stage, home_team_id, away_team_id,
       home_label, away_label, venue, kickoff_at)
    VALUES
      (@external_key, @group_name, @stage, @home_team_id, @away_team_id,
       @home_label, @away_label, @venue, @kickoff_at)
    ON CONFLICT(external_key) DO UPDATE SET
      group_name = excluded.group_name,
      stage = excluded.stage,
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      home_label = excluded.home_label,
      away_label = excluded.away_label,
      venue = excluded.venue,
      kickoff_at = excluded.kickoff_at
  `);

  const importMatches = db.transaction((rows: RawMatch[]) => {
    for (const match of rows) {
      const stage = mapStage(match.round);
      const homeId = nameToId.get(match.team1) ?? null;
      const awayId = nameToId.get(match.team2) ?? null;
      upsertMatch.run({
        external_key: externalKey(match),
        group_name: match.group ?? null,
        stage,
        home_team_id: homeId,
        away_team_id: awayId,
        home_label: homeId ? null : match.team1,
        away_label: awayId ? null : match.team2,
        venue: match.ground ?? null,
        kickoff_at: parseKickoff(match.date, match.time),
      });
    }
  });
  importMatches(schedule.matches);

  return { teams: teams.length, matches: schedule.matches.length };
}
