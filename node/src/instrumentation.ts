// Next.js calls register() once when the server process boots. We use it to
// start the in-process job scheduler — only on the Node.js runtime and only
// when RUN_SCHEDULER is explicitly enabled (set in docker-compose, off in dev).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RUN_SCHEDULER !== "true") return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
