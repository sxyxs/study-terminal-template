import Link from "next/link";
import { notFound } from "next/navigation";
import { LogTimeline } from "@/components/LogTimeline";
import { TaskList } from "@/components/TaskList";
import { EditProjectPanel } from "@/components/ProjectForms";
import { BackLink, Card, Dot, PageHeader, ProgressBar, StatusBadge } from "@/components/ui";
import { getProjectDetail } from "@/db/queries/projects";
import { getMilestoneTasks, getProjectsLite } from "@/db/queries/todos";
import { today as todayFn } from "@/lib/dates";
import { groupProjectDocs, listProjectDocs } from "@/lib/kb";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getProjectDetail(Number(id));
  return { title: d?.project.name ?? "项目" };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, allTasks, projectsLite] = await Promise.all([getProjectDetail(Number(id)), getMilestoneTasks(), getProjectsLite()]);
  if (!detail) notFound();
  const { project, milestones, logs, openTodos } = detail;
  const docGroups = groupProjectDocs(await listProjectDocs(project.slug), "文档");
  const tasks = allTasks.filter((t) => t.projectId === project.id);
  const done = milestones.filter((m) => m.done).length;
  const today = todayFn();

  return (
    <div className="space-y-4">
      <BackLink href="/projects">项目列表</BackLink>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Dot color={project.color} />
            {project.name}
            <StatusBadge status={project.status} />
          </span>
        }
        subtitle={project.description}
        actions={<EditProjectPanel project={project} />}
      />
      <Card>
        <ProgressBar value={done} total={milestones.length} color={project.color} />
        <div className="mt-1 flex gap-3 text-[11px] text-muted">
          {project.targetDate ? <span>目标日期 {project.targetDate}</span> : null}
          <span>最后更新 {project.updatedAt.slice(0, 10)}</span>
        </div>
      </Card>

      {docGroups.map((g) => (
        <Card key={g.folder || "root"} title={`${g.label}（${g.docs.length}）`}>
          <div className="space-y-2">
            {g.docs.map((d) => (
              <Link
                key={d.slug}
                href={`/projects/${project.id}/docs/${d.slug}`}
                className="block rounded-lg border p-3 transition hover:border-accent"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold">{d.title}</span>
                  {d.date ? <span className="font-mono text-[11px] text-muted">{d.date}</span> : null}
                </div>
                {d.summary ? <p className="mt-1 text-xs leading-relaxed text-muted">{d.summary}</p> : null}
                {d.tags.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {d.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        </Card>
      ))}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`任务 / 里程碑（${tasks.filter((t) => t.status !== "done").length} 条未完成）`}>
            <TaskList tasks={tasks} projects={projectsLite} today={today} projectId={project.id} showProjectChip={false} />
          </Card>
          <Card
            title={`关联待办（${openTodos.length} 条未完成）`}
            actions={
              <Link href="/todos" className="text-xs text-muted hover:text-fg">
                管理 →
              </Link>
            }
          >
            {openTodos.length === 0 ? (
              <div className="text-xs text-muted">
                去 <Link href="/todos" className="text-accent">待办</Link> 页在此项目下添加。
              </div>
            ) : (
              <ul className="space-y-1 text-sm">
                {openTodos.map((t) => (
                  <li key={t.id} className="flex gap-2">
                    <span className="font-mono text-[11px] text-muted">{t.date}</span>
                    <span>{t.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="lg:col-span-3">
          <Card title={`日志（${logs.length}）`}>
            <LogTimeline projectId={project.id} logs={logs} today={today} />
          </Card>
        </div>
      </div>
    </div>
  );
}
