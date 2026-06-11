import { runSyncResults } from "../lib/jobs/syncResults";

runSyncResults()
  .then((r) => {
    console.log(
      `Synced results: recorded ${r.recorded}, skipped ${r.skipped}, unmatched ${r.unmatched}.`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
