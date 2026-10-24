import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/client";
import { milestones, projectLogs, projects, todos } from "@/db/schema";

export async function getProjectsOverview() {
  await connection();
  const rows = db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      color: projects.color,
      targetDate: projects.targetDate,
      sortOrder: projects.sortOrder,
      updatedAt: projects.updatedAt,
      total: sql<number>`(select count(*) from milestones m where m.project_id = projects.id)`,
      done: sql<number>`(select count(*) from milestones m where m.project_id = projects.id and m.done = 1)`,
      nextDue: sql<string | null>`(select min(m.due_date) from milestones m where m.project_id = projects.id and m.done = 0 and m.due_date is not null)`,
      lastLog: sql<string | null>`(select max(l.date) from project_logs l where l.project_id = projects.id)`,
      openTodos: sql<number>`(select count(*) from todos t where t.project_id = projects.id and t.done = 0)`,
    })
    .from(projects)
    .orderBy(asc(projects.sortOrder), asc(projects.id))
    .all();
  const order = { active: 0, paused: 1, done: 2, archived: 3 } as const;
  return rows.sort((a, b) => order[a.status] - order[b.status] || a.sortOrder - b.sortOrder);
}

export type ProjectOverview = Awaited<ReturnType<typeof getProjectsOverview>>[number];

export async function getProjectDetail(id: number) {
  await connection();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return null;
  const ms = db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, id))
    .orderBy(asc(milestones.done), asc(milestones.sortOrder), asc(milestones.id))
    .all();
  const logs = db
    .select()
    .from(projectLogs)
    .where(eq(projectLogs.projectId, id))
    .orderBy(desc(projectLogs.date), desc(projectLogs.id))
    .all();
  const openTodos = db
    .select({ id: todos.id, title: todos.title, date: todos.date })
    .from(todos)
    .where(sql`${todos.projectId} = ${id} and ${todos.done} = 0`)
    .orderBy(asc(todos.date))
    .all();
  return { project, milestones: ms, logs, openTodos };
}
