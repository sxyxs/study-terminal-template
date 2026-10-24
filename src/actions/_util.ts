import { revalidatePath } from "next/cache";

/** The app is fully dynamic; revalidating the root layout refreshes whatever page called the action. */
export function bump() {
  revalidatePath("/", "layout");
}

export function num(v: FormDataEntryValue | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

export function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `p-${Date.now().toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
