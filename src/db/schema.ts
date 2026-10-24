import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(CURRENT_TIMESTAMP)`;

// ---------- Projects ----------

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status", { enum: ["active", "paused", "done", "archived"] })
    .notNull()
    .default("active"),
  color: text("color"),
  targetDate: text("target_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const todos = sqliteTable(
  "todos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    priority: integer("priority").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    carriedFrom: text("carried_from"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("todos_date_done").on(t.date, t.done),
    index("todos_project").on(t.projectId),
  ],
);

export const MILESTONE_STATUSES = ["todo", "doing", "done"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const milestones = sqliteTable(
  "milestones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: text("due_date"),
    /** todo → doing → done. `done` is kept in sync for the progress counters. */
    status: text("status", { enum: MILESTONE_STATUSES }).notNull().default("todo"),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("milestones_project").on(t.projectId)],
);

export const projectLogs = sqliteTable(
  "project_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    title: text("title"),
    bodyMd: text("body_md").notNull(),
    kind: text("kind", { enum: ["note", "experiment", "milestone", "blocker"] })
      .notNull()
      .default("note"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("project_logs_project_date").on(t.projectId, t.date)],
);

export type Todo = typeof todos.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type ProjectLog = typeof projectLogs.$inferSelect;
