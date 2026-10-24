"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { TOP_ITEMS, type NavNode } from "./nav-items";

function isActive(node: NavNode, pathname: string, search: string): boolean {
  const q = node.href.indexOf("?");
  if (q !== -1) return node.href.slice(0, q) === pathname && node.href.slice(q + 1) === search;
  if (node.href === "/") return pathname === "/";
  return pathname === node.href || pathname.startsWith(`${node.href}/`);
}

/** Ids of the deepest active node plus all of its ancestors, for auto-expanding. */
function activeTrail(nodes: NavNode[], pathname: string, search: string): string[] {
  let best: string[] = [];
  const walk = (list: NavNode[], trail: string[]) => {
    for (const n of list) {
      const t = [...trail, n.id];
      if (t.length > best.length && isActive(n, pathname, search)) best = t;
      if (n.children?.length) walk(n.children, t);
    }
  };
  walk(nodes, []);
  return best;
}

function TreeItem({
  node,
  depth,
  open,
  trail,
  onToggle,
  pathname,
  search,
}: {
  node: NavNode;
  depth: number;
  open: Record<string, boolean>;
  trail: string[];
  onToggle: (id: string, expanded: boolean) => void;
  pathname: string;
  search: string;
}) {
  const hasChildren = !!node.children?.length;
  // A branch the user has never toggled follows the current route: the branch
  // containing the active page starts out expanded.
  const expanded = open[node.id] ?? trail.includes(node.id);
  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "收起" : "展开"} ${node.label}`}
            onClick={() => onToggle(node.id, expanded)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] text-muted hover:bg-panel-2 hover:text-fg"
          >
            <span className={`transition-transform duration-100 ${expanded ? "rotate-90" : ""}`}>▸</span>
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}
        <Link
          href={node.href}
          data-active={isActive(node, pathname, search)}
          title={node.label}
          className={`nav-link min-w-0 flex-1 !px-1.5 ${depth === 0 ? "!py-1.5" : "!py-1 !gap-1.5 text-xs"} ${node.dim ? "opacity-60" : ""}`}
        >
          {node.icon ? <span className="w-4 shrink-0 text-center font-mono text-xs opacity-70">{node.icon}</span> : null}
          <span className="truncate">{node.label}</span>
          {typeof node.count === "number" ? (
            <span className="ml-auto shrink-0 pl-1 font-mono text-[10px] opacity-60">{node.count}</span>
          ) : null}
        </Link>
      </div>
      {hasChildren && expanded ? (
        <div className="flex flex-col gap-0.5">
          {node.children!.map((c) => (
            <TreeItem key={c.id} node={c} depth={depth + 1} open={open} trail={trail} onToggle={onToggle} pathname={pathname} search={search} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Nav({ tree, compact = false }: { tree?: NavNode[]; compact?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const items = tree ?? TOP_ITEMS;
  // Explicit user toggles; anything not in here follows the active-route trail.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const trail = useMemo(() => activeTrail(items, pathname, search), [items, pathname, search]);

  const toggle = (id: string, expanded: boolean) => setOpen((prev) => ({ ...prev, [id]: !expanded }));

  if (compact) {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {TOP_ITEMS.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            data-active={isActive(it, pathname, search)}
            className="nav-link !px-2 !py-1 text-xs"
          >
            {it.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
      {items.map((n) => (
        <TreeItem key={n.id} node={n} depth={0} open={open} trail={trail} onToggle={toggle} pathname={pathname} search={search} />
      ))}
    </nav>
  );
}
