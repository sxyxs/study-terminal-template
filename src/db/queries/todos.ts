import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/client";
import { milestones, projects, todos } from "@/db/schema";

export async function getProjectsLite() {
  await connection();
  return db
    .select({ id: projects.id, name: projects.name, color: projects.color, status: projects.status })
    .from(projects)
    .where(eq(projects.status, "active"))
    .orderBy(asc(projects.sortOrder), asc(projects.id))
    .all();
}

const todoCols = {
  id: todos.id,
  date: todos.date,
  title: todos.title,
  done: todos.done,
  doneAt: todos.doneAt,
  projectId: todos.projectId,
  projectName: projects.name,
  projectColor: projects.color,
  priority: todos.priority,
  sortOrder: todos.sortOrder,
  carriedFrom: todos.carriedFrom,
};

/** Every todo, undone first (priority, then oldest), done ones newest-first. */
export async function getAllTodos() {
  await connection();
  return db
    .select(todoCols)
    .from(todos)
    .leftJoin(projects, eq(todos.projectId, projects.id))
    .orderBy(asc(todos.done), desc(todos.priority), asc(todos.date), asc(todos.sortOrder), asc(todos.id))
    .all();
}

export type TodoRow = Awaited<ReturnType<typeof getAllTodos>>[number];

/** Projects with milestone progress + all their todos, plus a bucket for unassigned todos. */
export async function getTodosByProject() {
  await connection();
  const ps = db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      color: projects.color,
      targetDate: projects.targetDate,
      sortOrder: projects.sortOrder,
      msTotal: sql<number>`(select count(*) from milestones m where m.project_id = projects.id)`,
      msDone: sql<number>`(select count(*) from milestones m where m.project_id = projects.id and m.done = 1)`,
      nextMilestone: sql<string | null>`(select m.title from milestones m where m.project_id = projects.id and m.done = 0 order by m.due_date is null, m.due_date, m.sort_order, m.id limit 1)`,
      nextDue: sql<string | null>`(select min(m.due_date) from milestones m where m.project_id = projects.id and m.done = 0 and m.due_date is not null)`,
      lastLog: sql<string | null>`(select max(l.date) from project_logs l where l.project_id = projects.id)`,
    })
    .from(projects)
    .orderBy(asc(projects.sortOrder), asc(projects.id))
    .all();
  const all = await getAllTodos();
  const byProject = new Map<number | null, TodoRow[]>();
  for (const t of all) {
    const k = t.projectId ?? null;
    if (!byProject.has(k)) byProject.set(k, []);
    byProject.get(k)!.push(t);
  }
  const order = { active: 0, paused: 1, done: 2, archived: 3 } as const;
  const groups = ps
    .map((p) => ({ project: p, todos: byProject.get(p.id) ?? [] }))
    .sort((a, b) => order[a.project.status] - order[b.project.status] || a.project.sortOrder - b.project.sortOrder);
  return { groups, unassigned: byProject.get(null) ?? [] };
}

export async function getOpenTodoStats() {
  await connection();
  const row = db
    .select({
      open: sql<number>`sum(case when ${todos.done} = 0 then 1 else 0 end)`,
      urgent: sql<number>`sum(case when ${todos.done} = 0 and ${todos.priority} > 0 then 1 else 0 end)`,
      total: sql<number>`count(*)`,
    })
    .from(todos)
    .get();
  return { open: row?.open ?? 0, urgent: row?.urgent ?? 0, total: row?.total ?? 0 };
}

/** Every milestone as a task row with its project label. Doing first, then todo (by due date), then done. */
export async function getMilestoneTasks(opts: { activeOnly?: boolean } = {}) {
  await connection();
  const rows = db
    .select({
      id: milestones.id,
      title: milestones.title,
      dueDate: milestones.dueDate,
      status: milestones.status,
      doneAt: milestones.doneAt,
      sortOrder: milestones.sortOrder,
      projectId: milestones.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      projectStatus: projects.status,
      projectSort: projects.sortOrder,
    })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .all()
    .filter((r) => !opts.activeOnly || r.projectStatus === "active" || r.projectStatus === "paused");
  const rank = { doing: 0, todo: 1, done: 2 } as const;
  return rows.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "done" ? (b.doneAt ?? "").localeCompare(a.doneAt ?? "") : (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")) ||
      a.projectSort - b.projectSort ||
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );
}

export type MilestoneTask = Awaited<ReturnType<typeof getMilestoneTasks>>[number];
