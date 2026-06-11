import { runImportSchedule } from "../lib/jobs/importSchedule";

runImportSchedule()
  .then((r) => {
    console.log(`Imported ${r.teams} teams, ${r.matches} matches.`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
