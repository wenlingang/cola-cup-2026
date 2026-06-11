import { runFetchOdds } from "./jobs/fetchOdds";
import { runSyncResults } from "./jobs/syncResults";
import { runImportSchedule } from "./jobs/importSchedule";

const MINUTE = 60_000;

function envMinutes(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function schedule(
  name: string,
  everyMinutes: number,
  job: () => unknown | Promise<unknown>,
): void {
  let running = false;
  const tick = async () => {
    if (running) return; // skip if the previous run is still in flight
    running = true;
    try {
      await job();
    } catch (error) {
      console.error(`[scheduler] ${name} failed:`, error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, everyMinutes * MINUTE);
  timer.unref?.();
  console.log(`[scheduler] ${name} every ${everyMinutes}min`);
}

let started = false;

/** Register all in-process periodic jobs. Idempotent. */
export function startScheduler(): void {
  if (started) return;
  started = true;
  console.log("[scheduler] starting in-process jobs");
  schedule("odds", envMinutes("CRON_ODDS_MIN", 60), runFetchOdds);
  schedule("results", envMinutes("CRON_RESULTS_MIN", 15), runSyncResults);
  schedule("schedule", envMinutes("CRON_SCHEDULE_MIN", 1440), runImportSchedule);
}
