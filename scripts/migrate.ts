import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { db, sqlite } from "../src/db/client";

migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
const mode = sqlite.pragma("journal_mode", { simple: true });
const tables = sqlite
  .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name")
  .all()
  .map((r) => (r as { name: string }).name);
console.log(`migrated ok (journal_mode=${mode}) tables: ${tables.join(", ")}`);
sqlite.close();
