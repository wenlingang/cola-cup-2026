import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(process.cwd(), "data", "cup.db");

function createDb(): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return database;
}

const globalForDb = globalThis as unknown as { __cupDb?: Database.Database };

export const db = globalForDb.__cupDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__cupDb = db;
}
