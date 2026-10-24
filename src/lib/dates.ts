import { env } from "./env";

/** Local calendar date (YYYY-MM-DD) in the configured timezone. */
export function toLocalDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: env.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function today(): string {
  return toLocalDate();
}

export function isValidDate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Add n days to a YYYY-MM-DD string (UTC arithmetic, safe for date-only). */
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/** Monday-start week range containing `date`. */
export function weekRange(date: string): { start: string; end: string } {
  const d = new Date(date + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  const start = addDays(date, -dow);
  return { start, end: addDays(start, 6) };
}

export function weekdayShort(date: string): string {
  return ["日", "一", "二", "三", "四", "五", "六"][new Date(date + "T00:00:00Z").getUTCDay()];
}

/** Format an ISO timestamp for display in local timezone. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.includes("T") || iso.endsWith("Z") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: env.timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
