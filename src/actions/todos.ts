"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { todos } from "@/db/schema";
import { isValidDate, today } from "@/lib/dates";
import { bump, nowIso, num, str } from "./_util";

/** Create a todo. `date` is the day it was added (defaults to today); it is only shown as context. */
export async function createTodo(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) return;
  const rawDate = str(formData.get("date"));
  const date = isValidDate(rawDate) ? rawDate : today();
  const max = db
    .select({ m: sql<number>`coalesce(max(${todos.sortOrder}), 0)` })
    .from(todos)
    .where(eq(todos.date, date))
    .get();
  db.insert(todos)
    .values({
      title,
      date,
      projectId: num(formData.get("projectId")),
      priority: num(formData.get("priority")) ?? 0,
      sortOrder: (max?.m ?? 0) + 1,
    })
    .run();
  bump();
}

export async function toggleTodo(id: number) {
  const row = db.select().from(todos).where(eq(todos.id, id)).get();
  if (!row) return;
  db.update(todos)
    .set({ done: !row.done, doneAt: row.done ? null : nowIso() })
    .where(eq(todos.id, id))
    .run();
  bump();
}

export async function updateTodo(
  id: number,
  patch: { title?: string; projectId?: number | null; priority?: number; date?: string },
) {
  const set: Partial<typeof todos.$inferInsert> = {};
  if (patch.title !== undefined && patch.title.trim()) set.title = patch.title.trim();
  if (patch.projectId !== undefined) set.projectId = patch.projectId;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.date !== undefined && isValidDate(patch.date)) set.date = patch.date;
  if (Object.keys(set).length === 0) return;
  db.update(todos).set(set).where(eq(todos.id, id)).run();
  bump();
}

export async function deleteTodo(id: number) {
  db.delete(todos).where(eq(todos.id, id)).run();
  bump();
}

/** Remove every finished todo of one project (or of the unassigned bucket when projectId is null). */
export async function clearDoneTodos(projectId: number | null) {
  db.delete(todos)
    .where(projectId == null ? sql`${todos.done} = 1 and ${todos.projectId} is null` : sql`${todos.done} = 1 and ${todos.projectId} = ${projectId}`)
    .run();
  bump();
}
