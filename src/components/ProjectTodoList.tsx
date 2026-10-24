"use client";

import { useRef, useState, useTransition } from "react";
import { clearDoneTodos, createTodo, deleteTodo, toggleTodo, updateTodo } from "@/actions/todos";
import type { TodoRow } from "@/db/queries/todos";
import { Dot } from "./ui";

type ProjectLite = { id: number; name: string; color: string | null };

/**
 * Todo list scoped to one project (or the unassigned bucket when projectId is null).
 * Open items first; finished ones collapse under a toggle.
 */
export function ProjectTodoList({
  projectId,
  todos,
  projects,
  showProjectChip = false,
  compact = false,
}: {
  projectId: number | null;
  todos: TodoRow[];
  projects: ProjectLite[];
  showProjectChip?: boolean;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  const renderItem = (t: TodoRow) => (
    <li key={t.id} className="group flex items-start gap-2 py-1.5">
      <button
        type="button"
        aria-label="toggle"
        disabled={pending}
        onClick={() => start(() => toggleTodo(t.id))}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
          t.done ? "border-accent bg-accent text-accent-fg" : "hover:border-accent"
        }`}
      >
        {t.done ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        {editing === t.id ? (
          <form
            className="flex flex-wrap gap-1"
            action={(fd) => {
              const title = String(fd.get("title") ?? "");
              const pid = fd.get("projectId");
              const priority = fd.get("priority") ? 1 : 0;
              start(async () => {
                await updateTodo(t.id, { title, projectId: pid ? Number(pid) : null, priority });
                setEditing(null);
              });
            }}
          >
            <input name="title" defaultValue={t.title} className="input !py-0.5 text-sm" autoFocus />
            <select name="projectId" defaultValue={t.projectId ?? ""} className="input !w-36 !py-0.5 text-xs">
              <option value="">无项目</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted" title="高优先级">
              <input type="checkbox" name="priority" value="1" defaultChecked={t.priority > 0} /> !
            </label>
            <button className="btn btn-sm btn-primary">保存</button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
              取消
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={`text-sm ${t.done ? "text-muted line-through" : ""} ${t.priority > 0 && !t.done ? "font-semibold" : ""}`}
              onDoubleClick={() => setEditing(t.id)}
            >
              {t.priority > 0 && !t.done ? <span className="mr-1 text-danger">!</span> : null}
              {t.title}
            </span>
            {showProjectChip && t.projectName ? (
              <span className="chip">
                <Dot color={t.projectColor} />
                {t.projectName}
              </span>
            ) : null}
            <span className="font-mono text-[11px] text-muted" title={t.done && t.doneAt ? `完成于 ${t.doneAt.slice(0, 10)}` : `添加于 ${t.date}`}>
              {t.done && t.doneAt ? `✓ ${t.doneAt.slice(5, 10)}` : t.date.slice(5)}
            </span>
          </div>
        )}
      </div>
      {!compact && editing !== t.id && (
        <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button className="btn btn-ghost btn-sm" title="编辑" onClick={() => setEditing(t.id)}>
            ✎
          </button>
          <button
            className="btn btn-ghost btn-sm btn-danger"
            title="删除"
            onClick={() => {
              if (confirm(`删除「${t.title}」？`)) start(() => deleteTodo(t.id));
            }}
          >
            ×
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div>
      {open.length === 0 && done.length === 0 ? <div className="py-1 text-xs text-muted">还没有待办</div> : null}
      <ul className="divide-y">{open.map(renderItem)}</ul>

      {done.length > 0 && (
        <div className="mt-1">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <button type="button" className="hover:text-fg" onClick={() => setShowDone((s) => !s)}>
              {showDone ? "▾" : "▸"} 已完成 {done.length}
            </button>
            {!compact && showDone ? (
              <button
                type="button"
                className="hover:text-danger"
                onClick={() => {
                  if (confirm(`清除这 ${done.length} 条已完成的待办？`)) start(() => clearDoneTodos(projectId));
                }}
              >
                清除
              </button>
            ) : null}
          </div>
          {showDone ? <ul className="divide-y opacity-80">{done.map(renderItem)}</ul> : null}
        </div>
      )}

      {!compact && (
        <form
          ref={formRef}
          action={(fd) => {
            start(async () => {
              await createTodo(fd);
              formRef.current?.reset();
            });
          }}
          className="mt-2 flex gap-1.5"
        >
          {projectId != null ? <input type="hidden" name="projectId" value={projectId} /> : null}
          <input name="title" placeholder="添加待办，回车提交" className="input text-sm" required autoComplete="off" />
          {projectId == null ? (
            <select name="projectId" className="input !w-36 text-xs" defaultValue="">
              <option value="">无项目</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <label className="flex items-center gap-1 text-xs text-muted" title="高优先级">
            <input type="checkbox" name="priority" value="1" /> !
          </label>
          <button className="btn btn-primary" disabled={pending}>
            添加
          </button>
        </form>
      )}
    </div>
  );
}
