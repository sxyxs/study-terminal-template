import Link from "next/link";
import { ProjectTodoList } from "@/components/ProjectTodoList";
import { TaskList } from "@/components/TaskList";
import { Dot, Empty, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { getMilestoneTasks, getProjectsLite, getTodosByProject } from "@/db/queries/todos";
import { today as todayFn } from "@/lib/dates";

export const metadata = { title: "任务" };

export default async function TodosPage() {
  const [{ groups, unassigned }, tasks, projectsLite] = await Promise.all([getTodosByProject(), getMilestoneTasks(), getProjectsLite()]);
  const today = todayFn();
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const visible = groups.filter((g) => g.project.status !== "archived");

  return (
    <div className="space-y-4">
      <PageHeader title="任务" subtitle={`${openTasks} 条未完成 · 按项目分组：每个项目的任务（待办 / 进行中 / 完成）和零散待办`} />

      {visible.length === 0 ? (
        <Empty>
          还没有项目。先去 <Link href="/projects" className="text-accent">项目</Link> 页新建一个。
        </Empty>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map(({ project: p, todos }) => {
          const mine = tasks.filter((t) => t.projectId === p.id);
          const open = mine.filter((t) => t.status !== "done").length;
          return (
            <section key={p.id} className={`card p-4 ${p.status === "done" ? "opacity-70" : ""}`}>
              <div className="mb-1 flex items-center gap-2">
                <Dot color={p.color} />
                <Link href={`/projects/${p.id}`} className="truncate text-sm font-semibold hover:text-accent">
                  {p.name}
                </Link>
                <StatusBadge status={p.status} />
                <span className="ml-auto font-mono text-[11px] text-muted">{open ? `${open} 条未完成` : mine.length ? "全部完成" : ""}</span>
              </div>
              <ProgressBar value={p.msDone} total={p.msTotal} color={p.color} />
              <div className="mt-1 mb-2 text-[11px] text-muted">{p.lastLog ? `最近日志 ${p.lastLog}` : "暂无日志"}</div>

              <TaskList tasks={mine} projects={projectsLite} today={today} projectId={p.id} showProjectChip={false} />

              {todos.length > 0 ? (
                <details className="mt-3 border-t pt-2" open>
                  <summary className="cursor-pointer text-[11px] text-muted">零散待办 {todos.filter((t) => !t.done).length}</summary>
                  <ProjectTodoList projectId={p.id} todos={todos} projects={projectsLite} />
                </details>
              ) : (
                <details className="mt-3 border-t pt-2">
                  <summary className="cursor-pointer text-[11px] text-muted">零散待办（不算里程碑的小事）</summary>
                  <ProjectTodoList projectId={p.id} todos={todos} projects={projectsLite} />
                </details>
              )}
            </section>
          );
        })}

        <section className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Dot color={null} />
            <span className="text-sm font-semibold">未归属项目的待办</span>
            <span className="ml-auto font-mono text-[11px] text-muted">{unassigned.filter((t) => !t.done).length ? `${unassigned.filter((t) => !t.done).length} 条未完成` : "杂项"}</span>
          </div>
          <ProjectTodoList projectId={null} todos={unassigned} projects={projectsLite} showProjectChip />
        </section>
      </div>
    </div>
  );
}
