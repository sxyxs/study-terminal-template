import path from "node:path";

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env var ${name}`);
}

export const env = {
  get dbPath(): string {
    return path.resolve(process.cwd(), str("DB_PATH", "./data/study.db"));
  },
  /**
   * IANA timezone that decides what "today" is (e.g. "Asia/Shanghai", "Europe/Berlin").
   * Server-side only: client bundles never see process.env.TZ and would fall back to UTC.
   */
  get timeZone(): string {
    return str("TZ", "UTC");
  },
};
