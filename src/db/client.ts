import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

declare global {
  var __studyDb: { sqlite: Database.Database; db: DB } | undefined;
}

function open() {
  const file = env.dbPath;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

const conn = globalThis.__studyDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__studyDb = conn;

export const db: DB = conn.db;
export const sqlite = conn.sqlite;
