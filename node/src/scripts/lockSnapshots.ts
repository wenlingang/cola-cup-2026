import { lockDueMatches } from "../lib/settlement";

const locked = lockDueMatches(Date.now());
console.log(`Locked snapshots for ${locked} match(es) past kickoff.`);
