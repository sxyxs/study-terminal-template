"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { createMilestone, deleteMilestone, setMilestoneStatus, updateMilestone } from "@/actions/projects";
import type { MilestoneTask } from "@/db/queries/todos";
import type { MilestoneStatus } from "@/db/schema";
import { Dot, MILESTONE_STATUS_LABEL } from "./ui";

type ProjectLite = { id: number; name: string; color: string | null };
const STATES: MilestoneStatus[] = ["todo", "doing", "done"];

function StateSwitch({ id, status, pending, start }: { id: number; status: MilestoneStatus; pending: boolean; start: (fn: () => Promise<void>) => void }) {
  return (
    <div className="flex shrink-0 rounded-md border text-[11px]">
      {STATES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === status}
          onClick={() => start(() => setMilestoneStatus(id, s))}
          className={`px-1.5 py-0.5 first:rounded-l-md last:rounded-r-md ${
            s === status ? (s === "done" ? "bg-ok/20 text-ok" : s === "doing" ? "bg-accent text-accent-fg" : "bg-panel-2 text-fg") : "text-muted hover:text-fg"
          }`}
        >
          {MILESTONE_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

/**
 * Milestones rendered as tasks: each row has a todo / doing / done switch and (optionally) its project label.
 * Done tasks collapse under a toggle. `projectId` fixes the add-form to one project; otherwise a project picker is shown.
 */
export function TaskList({
  tasks,
  projects,
  today,
  projectId = null,
  showProjectChip = true,
  showAdd = true,
}: {
  tasks: MilestoneTask[];
  projects: ProjectLite[];
  today: string;
  projectId?: number | null;
  showProjectChip?: boolean;
  showAdd?: boolean;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  const row = (t: MilestoneTask) => {
    const overdue = t.status !== "done" && t.dueDate && t.dueDate < today;
    return (
      <li key={t.id} className="group flex items-start gap-2 py-1.5">
        <StateSwitch id={t.id} status={t.status} pending={pending} start={start} />
        <div className="min-w-0 flex-1">
          {editing === t.id ? (
            <form
              className="flex flex-wrap gap-1"
              action={(fd) =>
                start(async () => {
                  await updateMilestone(t.id, { title: String(fd.get("title")), dueDate: String(fd.get("dueDate") || "") || null });
                  setEditing(null);
                })
              }
            >
              <input name="title" defaultValue={t.title} className="input !py-0.5 text-sm" autoFocus />
              <input name="dueDate" type="date" defaultValue={t.dueDate ?? ""} className="input !w-36 !py-0.5 text-xs" />
              <button className="btn btn-sm btn-primary">保存</button>
              <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
                取消
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`text-sm ${t.status === "done" ? "text-muted line-through" : t.status === "doing" ? "font-medium" : ""}`} onDoubleClick={() => setEditing(t.id)}>
                {t.title}
              </span>
              {showProjectChip ? (
                <Link href={`/projects/${t.projectId}`} className="chip hover:text-fg">
                  <Dot color={t.projectColor} />
                  {t.projectName}
                </Link>
              ) : null}
              {t.dueDate ? <span className={`font-mono text-[11px] ${overdue ? "text-danger" : "text-muted"}`}>{t.dueDate}</span> : null}
              {t.status === "done" && t.doneAt ? <span className="font-mono text-[11px] text-muted">✓ {t.doneAt.slice(5, 10)}</span> : null}
            </div>
          )}
        </div>
        {editing !== t.id ? (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button className="btn btn-ghost btn-sm" title="编辑" onClick={() => setEditing(t.id)}>
              ✎
            </button>
            <button
              className="btn btn-ghost btn-sm btn-danger"
              title="删除"
              onClick={() => {
                if (confirm(`删除任务「${t.title}」？`)) start(() => deleteMilestone(t.id));
              }}
            >
              ×
            </button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div>
      {open.length === 0 && done.length === 0 ? <div className="py-1 text-xs text-muted">还没有任务</div> : null}
      <ul className="divide-y">{open.map(row)}</ul>
      {done.length > 0 ? (
        <div className="mt-1">
          <button type="button" className="text-[11px] text-muted hover:text-fg" onClick={() => setShowDone((s) => !s)}>
            {showDone ? "▾" : "▸"} 已完成 {done.length}
          </button>
          {showDone ? <ul className="divide-y opacity-80">{done.map(row)}</ul> : null}
        </div>
      ) : null}
      {showAdd ? (
        <form
          ref={formRef}
          className="mt-2 flex flex-wrap gap-1.5"
          action={(fd) =>
            start(async () => {
              await createMilestone(fd);
              formRef.current?.reset();
            })
          }
        >
          {projectId != null ? (
            <input type="hidden" name="projectId" value={projectId} />
          ) : (
            <select name="projectId" className="input !w-40 text-xs" required defaultValue="">
              <option value="" disabled>
                选择项目
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <input name="title" placeholder="新任务，回车提交" className="input min-w-40 flex-1 text-sm" required autoComplete="off" />
          <input name="dueDate" type="date" className="input !w-36 text-xs" title="截止日期（可选）" />
          <button className="btn btn-primary" disabled={pending}>
            添加
          </button>
        </form>
      ) : null}
    </div>
  );
}
