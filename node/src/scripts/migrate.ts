import fs from "node:fs";
import path from "node:path";
import { db } from "../db/client";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

function migrate(): void {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  // SQLite's recommended procedure for schema changes that rebuild a table other
  // tables reference (https://www.sqlite.org/lang_altertable.html): disable FK
  // enforcement around the migration, then verify integrity. foreign_keys can
  // only be toggled outside an active transaction, so flip it before applying.
  db.pragma("foreign_keys = OFF");

  const apply = db.transaction((sql: string, version: number) => {
    db.exec(sql);
    const violations = db.pragma("foreign_key_check") as unknown[];
    if (violations.length > 0) {
      throw new Error(
        `Migration ${version} left foreign key violations; rolling back: ` +
          JSON.stringify(violations),
      );
    }
    db.pragma(`user_version = ${version}`);
  });

  let appliedCount = 0;
  try {
    for (const file of files) {
      const version = Number(file.split("_")[0]);
      if (!Number.isFinite(version) || version <= currentVersion) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      apply(sql, version);
      console.log(`Applied migration: ${file}`);
      appliedCount += 1;
    }
  } finally {
    db.pragma("foreign_keys = ON");
  }

  console.log(
    appliedCount === 0
      ? "No new migrations to apply."
      : `Done. Applied ${appliedCount} migration(s).`,
  );
}

migrate();
