/* Fill a throwaway database with fictional data, for screenshots / demos.
   Never touches the real DB: refuses to run unless DB_PATH points at a *demo* file.

   Usage:
     npm run seed:demo            # migrates + seeds ./data/demo.db
     npm run dev:demo             # the above, then `next dev` against it
*/
import { db, sqlite } from "../src/db/client";
import { env } from "../src/lib/env";
import { addDays, today as todayFn, weekRange } from "../src/lib/dates";
import { milestones, projectLogs, projects, todos } from "../src/db/schema";

const file = env.dbPath;
if (!/demo/i.test(file)) {
  throw new Error(`refusing to seed ${file}: DB_PATH must point at a demo database (name must contain "demo")`);
}

const today = todayFn();
const { start: weekStart } = weekRange(today);
/** ISO timestamp for a local date, at a fixed hour, so the UI shows stable times. */
const at = (date: string, hhmm = "09:20") => `${date}T${hhmm}:00Z`;

// Wipe the demo DB so re-running gives the exact same screenshot.
sqlite.pragma("foreign_keys = OFF");
for (const t of ["project_logs", "milestones", "todos", "projects"]) {
  sqlite.prepare(`delete from ${t}`).run();
}
sqlite.prepare("delete from sqlite_sequence").run();
sqlite.pragma("foreign_keys = ON");

// ---------- Projects ----------

type DemoMilestone = { title: string; status: "todo" | "doing" | "done"; dueDate: string | null; doneAt?: string };

const PROJECTS: Array<{
  name: string;
  slug: string;
  description: string;
  color: string;
  status: "active" | "paused";
  targetDate: string | null;
  milestones: DemoMilestone[];
}> = [
  {
    name: "Demo · 机器学习课程",
    slug: "demo-ml-course",
    description: "示例项目：跟一门公开的机器学习课程，每章做笔记和编程作业。",
    color: "#6366f1",
    status: "active",
    targetDate: addDays(today, 45),
    milestones: [
      { title: "第 1–3 章：线性模型", status: "done", dueDate: addDays(today, -6), doneAt: addDays(today, -2) },
      { title: "第 4 章：神经网络与反向传播", status: "doing", dueDate: addDays(today, 4) },
      { title: "第 5 章：卷积网络", status: "todo", dueDate: addDays(today, 17) },
      { title: "期末小项目", status: "todo", dueDate: addDays(today, 30) },
    ],
  },
  {
    name: "Demo · 个人网站",
    slug: "demo-website",
    description: "示例项目：用 Next.js 搭一个本地运行的学习看板，就是你正在看的这个。",
    color: "#0ea5e9",
    status: "active",
    targetDate: addDays(today, 60),
    milestones: [
      { title: "数据层与迁移", status: "done", dueDate: addDays(today, -3), doneAt: addDays(today, -1) },
      { title: "项目页与任务页", status: "doing", dueDate: addDays(today, -2) },
      { title: "systemd 部署与备份", status: "todo", dueDate: null },
    ],
  },
  {
    name: "Demo · 数据分析练习",
    slug: "demo-data-practice",
    description: "示例项目：拿一个公开数据集练习清洗、可视化和写分析报告。",
    color: "#10b981",
    status: "active",
    targetDate: null,
    milestones: [
      { title: "数据清洗脚本", status: "done", dueDate: addDays(today, -4), doneAt: addDays(today, -1) },
      { title: "写分析报告", status: "todo", dueDate: addDays(today, 21) },
    ],
  },
  {
    name: "Demo · 读书计划",
    slug: "demo-reading",
    description: "示例项目：每月读一本技术书并写读书笔记，暂停中。",
    color: "#f59e0b",
    status: "paused",
    targetDate: null,
    milestones: [{ title: "第一本书的读书笔记", status: "todo", dueDate: null }],
  },
];

const projectIds: number[] = [];
PROJECTS.forEach((p, i) => {
  const row = db
    .insert(projects)
    .values({
      name: p.name,
      slug: p.slug,
      description: p.description,
      status: p.status,
      color: p.color,
      targetDate: p.targetDate,
      sortOrder: i,
    })
    .returning({ id: projects.id })
    .get();
  projectIds.push(row.id);
  p.milestones.forEach((m, j) => {
    const done = m.status === "done";
    db.insert(milestones)
      .values({
        projectId: row.id,
        title: m.title,
        dueDate: m.dueDate,
        status: m.status,
        done,
        doneAt: done && m.doneAt ? at(m.doneAt, "17:05") : null,
        sortOrder: j,
      })
      .run();
  });
});

// ---------- Project logs ----------

const LOGS: Array<{ p: number; date: string; title: string; kind: "note" | "experiment" | "blocker"; body: string }> = [
  {
    p: 0,
    date: addDays(today, -1),
    title: "反向传播作业",
    kind: "experiment",
    body: "两层网络在作业数据集上的结果：\n\n| 学习率 | 训练准确率 | 验证准确率 |\n|---|---|---|\n| 0.1 | 0.97 | 0.91 |\n| 0.01 | 0.93 | 0.90 |\n\n学习率 0.1 时后期有轻微过拟合，下一步加 weight decay。",
  },
  { p: 0, date: addDays(today, -5), title: "线性模型章节完成", kind: "note", body: "手推了一遍正规方程，和梯度下降的结果对上了。" },
  { p: 1, date: addDays(today, -2), title: "SQLite 偶发锁表", kind: "blocker", body: "开发服务器和迁移脚本同时打开数据库时偶发 `SQLITE_BUSY`，打开 WAL 并设置 `busy_timeout` 后解决。" },
  { p: 2, date: addDays(today, -4), title: "缺失值处理", kind: "note", body: "约 3% 的行缺少日期字段，先按前一条记录填充，并在报告里注明。" },
];
for (const l of LOGS) {
  db.insert(projectLogs).values({ projectId: projectIds[l.p], date: l.date, title: l.title, bodyMd: l.body, kind: l.kind }).run();
}

// ---------- Todos ----------

const TODOS: Array<{ p: number | null; title: string; date: string; done: boolean; priority?: number }> = [
  { p: 0, title: "完成第 4 章编程作业", date: today, done: false, priority: 1 },
  { p: 0, title: "整理反向传播推导笔记", date: today, done: false },
  { p: 1, title: "给任务列表加截止日期提示", date: today, done: false, priority: 1 },
  { p: 1, title: "写 README 的部署章节", date: addDays(today, -1), done: false },
  { p: 2, title: "画三张探索性分析图", date: today, done: false },
  { p: 0, title: "复习第 3 章习题", date: addDays(today, -1), done: true },
  { p: 2, title: "导出清洗后的数据", date: addDays(today, -2), done: true },
  { p: null, title: "整理下周学习计划", date: addDays(today, -2), done: true },
];
TODOS.forEach((t, i) => {
  db.insert(todos)
    .values({
      date: t.date,
      title: t.title,
      done: t.done,
      doneAt: t.done ? at(t.date >= weekStart ? t.date : weekStart, "18:30") : null,
      projectId: t.p === null ? null : projectIds[t.p],
      priority: t.priority ?? 0,
      sortOrder: i,
    })
    .run();
});

console.log(`demo seed ok → ${file}`);
sqlite.close();
