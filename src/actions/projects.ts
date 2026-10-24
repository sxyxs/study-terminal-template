"use server";

import { asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { MILESTONE_STATUSES, type MilestoneStatus, milestones, projectLogs, projects } from "@/db/schema";
import { isValidDate, today } from "@/lib/dates";
import { bump, nowIso, num, slugify, str } from "./_util";

type ProjectStatus = "active" | "paused" | "done" | "archived";
const STATUSES: ProjectStatus[] = ["active", "paused", "done", "archived"];

export async function createProject(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) return;
  let slug = slugify(str(formData.get("slug")) || name);
  if (db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get()) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  const max = db.select({ m: sql<number>`coalesce(max(${projects.sortOrder}), 0)` }).from(projects).get();
  const row = db
    .insert(projects)
    .values({
      name,
      slug,
      description: str(formData.get("description")) || null,
      color: str(formData.get("color")) || null,
      targetDate: isValidDate(str(formData.get("targetDate"))) ? str(formData.get("targetDate")) : null,
      sortOrder: (max?.m ?? 0) + 1,
    })
    .returning({ id: projects.id })
    .get();
  bump();
  redirect(`/projects/${row.id}`);
}

export async function updateProject(
  id: number,
  patch: { name?: string; description?: string | null; status?: string; color?: string | null; targetDate?: string | null },
) {
  const set: Partial<typeof projects.$inferInsert> = { updatedAt: nowIso() };
  if (patch.name !== undefined && patch.name.trim()) set.name = patch.name.trim();
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.status !== undefined && STATUSES.includes(patch.status as ProjectStatus)) set.status = patch.status as ProjectStatus;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.targetDate !== undefined) set.targetDate = patch.targetDate && isValidDate(patch.targetDate) ? patch.targetDate : null;
  db.update(projects).set(set).where(eq(projects.id, id)).run();
  bump();
}

export async function updateProjectForm(formData: FormData) {
  const id = num(formData.get("id"));
  if (!id) return;
  await updateProject(id, {
    name: str(formData.get("name")),
    description: str(formData.get("description")) || null,
    status: str(formData.get("status")),
    color: str(formData.get("color")) || null,
    targetDate: str(formData.get("targetDate")) || null,
  });
}

/** Move a project one step up or down in the global order (swap sort_order with its neighbour). */
export async function moveProject(id: number, dir: "up" | "down") {
  const rows = db.select({ id: projects.id }).from(projects).orderBy(asc(projects.sortOrder), asc(projects.id)).all();
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  db.transaction((tx) => {
    rows.forEach((r, k) => tx.update(projects).set({ sortOrder: k }).where(eq(projects.id, r.id)).run());
  });
  bump();
}

export async function deleteProject(id: number) {
  db.delete(projects).where(eq(projects.id, id)).run();
  bump();
  redirect("/projects");
}

// ---- milestones ----

export async function createMilestone(formData: FormData) {
  const projectId = num(formData.get("projectId"));
  const title = str(formData.get("title"));
  if (!projectId || !title) return;
  const max = db
    .select({ m: sql<number>`coalesce(max(${milestones.sortOrder}), 0)` })
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .get();
  const due = str(formData.get("dueDate"));
  db.insert(milestones)
    .values({ projectId, title, dueDate: isValidDate(due) ? due : null, sortOrder: (max?.m ?? 0) + 1 })
    .run();
  touch(projectId);
  bump();
}

export async function toggleMilestone(id: number) {
  const row = db.select().from(milestones).where(eq(milestones.id, id)).get();
  if (!row) return;
  await setMilestoneStatus(id, row.status === "done" ? "todo" : "done");
}

/** todo → doing → done; `done`/`doneAt` follow the status so progress counters stay right. */
export async function setMilestoneStatus(id: number, status: MilestoneStatus) {
  if (!MILESTONE_STATUSES.includes(status)) return;
  const row = db.select().from(milestones).where(eq(milestones.id, id)).get();
  if (!row || row.status === status) return;
  const done = status === "done";
  db.update(milestones)
    .set({ status, done, doneAt: done ? (row.doneAt ?? nowIso()) : null })
    .where(eq(milestones.id, id))
    .run();
  touch(row.projectId);
  bump();
}

export async function updateMilestone(id: number, patch: { title?: string; dueDate?: string | null }) {
  const set: Partial<typeof milestones.$inferInsert> = {};
  if (patch.title !== undefined && patch.title.trim()) set.title = patch.title.trim();
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate && isValidDate(patch.dueDate) ? patch.dueDate : null;
  if (Object.keys(set).length === 0) return;
  db.update(milestones).set(set).where(eq(milestones.id, id)).run();
  bump();
}

export async function deleteMilestone(id: number) {
  db.delete(milestones).where(eq(milestones.id, id)).run();
  bump();
}

// ---- logs ----

export async function createLog(formData: FormData) {
  const projectId = num(formData.get("projectId"));
  const bodyMd = str(formData.get("bodyMd"));
  if (!projectId || !bodyMd) return;
  const date = str(formData.get("date"));
  const kindRaw = str(formData.get("kind"));
  const kind = (["note", "experiment", "milestone", "blocker"] as const).find((k) => k === kindRaw) ?? "note";
  db.insert(projectLogs)
    .values({
      projectId,
      date: isValidDate(date) ? date : today(),
      title: str(formData.get("title")) || null,
      bodyMd,
      kind,
    })
    .run();
  touch(projectId);
  bump();
}

export async function updateLog(id: number, patch: { title?: string | null; bodyMd?: string; date?: string; kind?: string }) {
  const set: Partial<typeof projectLogs.$inferInsert> = { updatedAt: nowIso() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.bodyMd !== undefined && patch.bodyMd.trim()) set.bodyMd = patch.bodyMd;
  if (patch.date !== undefined && isValidDate(patch.date)) set.date = patch.date;
  if (patch.kind !== undefined) {
    const k = (["note", "experiment", "milestone", "blocker"] as const).find((x) => x === patch.kind);
    if (k) set.kind = k;
  }
  db.update(projectLogs).set(set).where(eq(projectLogs.id, id)).run();
  bump();
}

export async function updateLogForm(formData: FormData) {
  const id = num(formData.get("id"));
  if (!id) return;
  await updateLog(id, {
    title: str(formData.get("title")) || null,
    bodyMd: str(formData.get("bodyMd")),
    date: str(formData.get("date")),
    kind: str(formData.get("kind")),
  });
}

export async function deleteLog(id: number) {
  db.delete(projectLogs).where(eq(projectLogs.id, id)).run();
  bump();
}

function touch(projectId: number) {
  db.update(projects).set({ updatedAt: nowIso() }).where(eq(projects.id, projectId)).run();
}
