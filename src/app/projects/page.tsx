import Link from "next/link";
import { NewProjectButton } from "@/components/ProjectForms";
import { ProjectOrderButtons } from "@/components/ProjectOrderButtons";
import { Dot, Empty, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { getProjectsOverview } from "@/db/queries/projects";
import { today as todayFn } from "@/lib/dates";

export const metadata = { title: "项目" };

export default async function ProjectsPage() {
  const projects = await getProjectsOverview();
  const today = todayFn();
  return (
    <div className="space-y-4">
      <PageHeader title="项目" subtitle={`${projects.filter((p) => p.status === "active").length} 个进行中 · 共 ${projects.length} 个 · 用 ▲▼ 调整顺序，首页和任务页同步`} actions={<NewProjectButton />} />
      {projects.length === 0 ? <Empty>还没有项目，点右上角新建。</Empty> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((p, i) => (
          <div key={p.id} className={`card relative p-4 transition hover:border-accent ${p.status === "archived" ? "opacity-60" : ""}`}>
            <div className="mb-1 flex items-center gap-2">
              <ProjectOrderButtons id={p.id} first={i === 0} last={i === projects.length - 1} />
              <Dot color={p.color} />
              <Link href={`/projects/${p.id}`} className="truncate text-sm font-semibold hover:text-accent">
                {p.name}
              </Link>
              <span className="ml-auto">
                <StatusBadge status={p.status} />
              </span>
            </div>
            {p.description ? <p className="mb-2 line-clamp-2 text-xs text-muted">{p.description}</p> : null}
            <ProgressBar value={p.done} total={p.total} color={p.color} />
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
              {p.nextDue ? <span className={p.nextDue < today ? "text-danger" : ""}>下个截止 {p.nextDue}</span> : <span>无截止</span>}
              <span>{p.lastLog ? `最近日志 ${p.lastLog}` : "暂无日志"}</span>
              {p.openTodos ? <span>{p.openTodos} 条待办</span> : null}
              {p.targetDate ? <span>目标 {p.targetDate}</span> : null}
            </div>
            <Link href={`/projects/${p.id}`} className="mt-2 inline-block text-[11px] text-muted hover:text-fg">
              打开 →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
