import Link from "next/link";
import { TaskList } from "@/components/TaskList";
import { Card, Dot, Empty, PageHeader } from "@/components/ui";
import { getMilestoneTasks, getOpenTodoStats, getProjectsLite } from "@/db/queries/todos";
import { today as todayFn, weekdayShort, weekRange } from "@/lib/dates";

export default async function HomePage() {
  const today = todayFn();
  const [tasks, projectsLite, todoStats] = await Promise.all([
    getMilestoneTasks({ activeOnly: true }),
    getProjectsLite(),
    getOpenTodoStats(),
  ]);
  const { start } = weekRange(today);
  const doing = tasks.filter((t) => t.status === "doing").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const doneThisWeek = tasks.filter((t) => t.status === "done" && t.doneAt && t.doneAt.slice(0, 10) >= start).length;
  const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            {today} <span className="text-muted">周{weekdayShort(today)}</span>
          </>
        }
        subtitle="每个项目里的任务"
        actions={
          <Link href="/todos" className="btn">
            按项目查看 →
          </Link>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="进行中" value={String(doing)} sub={overdue ? `${overdue} 条已过截止` : "任务"} accent={doing > 0 || overdue > 0} />
        <Stat label="待办" value={String(todo)} sub="任务" />
        <Stat label="本周完成" value={String(doneThisWeek)} sub={`自 ${start} 起`} />
        <Link href="/todos" className="block">
          <Stat label="零散待办" value={String(todoStats.open)} sub={todoStats.urgent ? `${todoStats.urgent} 条高优先级` : "未完成"} accent={todoStats.urgent > 0} />
        </Link>
      </div>

      <Card
        title="任务"
        actions={
          <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {projectsLite.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="chip hover:text-fg">
                <Dot color={p.color} />
                {p.name}
              </Link>
            ))}
          </span>
        }
      >
        {tasks.length === 0 ? (
          <Empty>
            还没有任务。在下方选择项目添加，或去 <Link href="/projects" className="text-accent">项目</Link> 页。
          </Empty>
        ) : null}
        <TaskList tasks={tasks} projects={projectsLite} today={today} />
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-3 ${accent ? "border-accent" : ""}`}>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-xl font-semibold">{value}</div>
      {sub ? <div className="text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}
