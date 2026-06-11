import { runFetchOdds } from "../lib/jobs/fetchOdds";

runFetchOdds()
  .then((r) => {
    console.log(`Fetched ${r.events} world-cup events.`);
    console.log(`  matched to fixtures: ${r.matched}`);
    console.log(`  unmatched moneyline: ${r.unmatched}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
