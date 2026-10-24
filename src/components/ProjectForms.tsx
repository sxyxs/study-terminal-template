"use client";

import { useState, useTransition } from "react";
import { createProject, deleteProject, updateProjectForm } from "@/actions/projects";
import type { Project } from "@/db/schema";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#64748b"];

function Fields({ project }: { project?: Project }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label className="block text-xs text-muted">
        名称
        <input name="name" defaultValue={project?.name ?? ""} className="input mt-0.5 text-sm" required />
      </label>
      <div className="flex gap-2">
        <label className="block flex-1 text-xs text-muted">
          状态
          <select name="status" defaultValue={project?.status ?? "active"} className="input mt-0.5 text-sm">
            <option value="active">进行中</option>
            <option value="paused">暂停</option>
            <option value="done">完成</option>
            <option value="archived">归档</option>
          </select>
        </label>
        <label className="block flex-1 text-xs text-muted">
          目标日期
          <input name="targetDate" type="date" defaultValue={project?.targetDate ?? ""} className="input mt-0.5 text-sm" />
        </label>
      </div>
      <label className="block text-xs text-muted md:col-span-2">
        描述
        <textarea name="description" defaultValue={project?.description ?? ""} className="input mt-0.5 min-h-16 text-sm" />
      </label>
      <div className="text-xs text-muted md:col-span-2">
        颜色
        <div className="mt-1 flex gap-1.5">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={(project?.color ?? COLORS[0]) === c} className="peer sr-only" />
              <span className="block h-5 w-5 rounded-full ring-offset-2 ring-offset-panel peer-checked:ring-2" style={{ background: c, ["--tw-ring-color" as string]: c }} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + 新建项目
      </button>
    );
  return (
    <form className="card w-full space-y-2 p-3" action={(fd) => start(() => createProject(fd))}>
      <Fields />
      <div className="flex justify-end gap-1.5">
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
          取消
        </button>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          创建
        </button>
      </div>
    </form>
  );
}

export function EditProjectPanel({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <div className="flex gap-1.5">
        <button className="btn btn-sm" onClick={() => setOpen(true)}>
          编辑项目
        </button>
        <button
          className="btn btn-sm btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`删除项目「${project.name}」及其所有里程碑和日志？`)) start(() => deleteProject(project.id));
          }}
        >
          删除
        </button>
      </div>
    );
  return (
    <form
      className="card w-full space-y-2 p-3"
      action={(fd) =>
        start(async () => {
          await updateProjectForm(fd);
          setOpen(false);
        })
      }
    >
      <input type="hidden" name="id" value={project.id} />
      <Fields project={project} />
      <div className="flex justify-end gap-1.5">
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
          取消
        </button>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          保存
        </button>
      </div>
    </form>
  );
}
