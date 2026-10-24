"use client";

import { useRef, useState, useTransition } from "react";
import { createLog, deleteLog, updateLogForm } from "@/actions/projects";
import type { ProjectLog } from "@/db/schema";
import { Markdown } from "./Markdown";

const KIND_LABEL: Record<string, string> = { note: "笔记", experiment: "实验", milestone: "里程碑", blocker: "阻塞" };
const KIND_COLOR: Record<string, string> = { note: "var(--muted)", experiment: "var(--accent)", milestone: "var(--ok)", blocker: "var(--danger)" };

function LogForm({
  projectId,
  today,
  log,
  onDone,
}: {
  projectId: number;
  today: string;
  log?: ProjectLog;
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(false);
  const [text, setText] = useState(log?.bodyMd ?? "");
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className="rounded-lg border bg-panel-2 p-3"
      action={(fd) =>
        start(async () => {
          if (log) await updateLogForm(fd);
          else await createLog(fd);
          ref.current?.reset();
          setText("");
          setPreview(false);
          onDone?.();
        })
      }
    >
      {log ? <input type="hidden" name="id" value={log.id} /> : <input type="hidden" name="projectId" value={projectId} />}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <input name="date" type="date" defaultValue={log?.date ?? today} className="input !w-36 text-xs" />
        <select name="kind" defaultValue={log?.kind ?? "note"} className="input !w-28 text-xs">
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input name="title" defaultValue={log?.title ?? ""} placeholder="标题（可选）" className="input flex-1 text-sm" />
        <button type="button" className="btn btn-sm" onClick={() => setPreview((p) => !p)}>
          {preview ? "编辑" : "预览"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-24 rounded-md border bg-panel p-3">
          <Markdown>{text || "_（空）_"}</Markdown>
        </div>
      ) : null}
      <textarea
        name="bodyMd"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="今天做了什么 / 实验结果 / 想法……支持 Markdown（表格、代码块）"
        className={`input min-h-24 font-mono text-[13px] ${preview ? "hidden" : ""}`}
        required
      />
      <div className="mt-2 flex justify-end gap-1.5">
        {onDone ? (
          <button type="button" className="btn btn-sm" onClick={onDone}>
            取消
          </button>
        ) : null}
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {log ? "保存" : "记一条"}
        </button>
      </div>
    </form>
  );
}

export function LogTimeline({ projectId, logs, today }: { projectId: number; logs: ProjectLog[]; today: string }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);

  const groups = new Map<string, ProjectLog[]>();
  for (const l of logs) (groups.get(l.date) ?? groups.set(l.date, []).get(l.date)!).push(l);

  return (
    <div className="space-y-4">
      <LogForm projectId={projectId} today={today} />
      {[...groups.entries()].map(([date, items]) => (
        <div key={date} className="relative pl-5">
          <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-accent" />
          <div className="absolute bottom-0 left-[3px] top-4 w-px bg-border" />
          <div className="mb-1.5 font-mono text-xs text-muted">{date}</div>
          <div className="space-y-2">
            {items.map((l) =>
              editing === l.id ? (
                <LogForm key={l.id} projectId={projectId} today={today} log={l} onDone={() => setEditing(null)} />
              ) : (
                <article key={l.id} className="group card p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="chip" style={{ color: KIND_COLOR[l.kind] }}>
                      {KIND_LABEL[l.kind]}
                    </span>
                    {l.title ? <span className="text-sm font-semibold">{l.title}</span> : null}
                    <div className="ml-auto flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(l.id)}>
                        ✎
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-danger"
                        disabled={pending}
                        onClick={() => {
                          if (confirm("删除这条日志？")) start(() => deleteLog(l.id));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <Markdown>{l.bodyMd}</Markdown>
                </article>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
