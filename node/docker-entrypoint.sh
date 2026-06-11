#!/bin/sh
set -e

# Apply migrations (idempotent) into the mounted data volume.
npm run db:migrate

# First boot: seed the schedule + odds if the DB has no matches yet.
MATCH_COUNT=$(node -e "try{const D=require('better-sqlite3');const d=new D(process.env.DB_PATH);console.log(d.prepare('SELECT COUNT(*) c FROM matches').get().c)}catch(e){console.log(0)}")
if [ "$MATCH_COUNT" = "0" ]; then
  echo "Empty database — importing schedule and fetching odds…"
  npm run import:schedule
  npm run fetch:odds || echo "Odds fetch failed (will retry on demand)."
fi

exec "$@"
