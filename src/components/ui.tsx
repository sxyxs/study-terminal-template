import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <div className="mt-0.5 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`card p-4 ${className}`}>
      {title || actions ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? <h2 className="text-sm font-semibold text-muted">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ProgressBar({ value, total, color }: { value: number; total: number; color?: string | null }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color ?? "var(--accent)" }} />
      </div>
      <span className="w-20 text-right font-mono text-[11px] text-muted">
        {value}/{total} · {pct}%
      </span>
    </div>
  );
}

export function Dot({ color }: { color?: string | null }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color ?? "var(--muted)" }} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted">{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "进行中", cls: "text-ok" },
    paused: { label: "暂停", cls: "text-warn" },
    done: { label: "完成", cls: "text-accent" },
    archived: { label: "归档", cls: "text-muted" },
    todo: { label: "待办", cls: "text-muted" },
    doing: { label: "进行中", cls: "text-accent" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <span className={`chip ${m.cls}`}>{m.label}</span>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs text-muted hover:text-fg">
      ← {children}
    </Link>
  );
}

export const MILESTONE_STATUS_LABEL: Record<string, string> = { todo: "待办", doing: "进行中", done: "完成" };
