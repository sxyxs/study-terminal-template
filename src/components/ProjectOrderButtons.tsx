"use client";

import { useTransition } from "react";
import { moveProject } from "@/actions/projects";

/** Compact vertical ▲/▼ handle at the front of a project card; swaps the project with its neighbour. */
export function ProjectOrderButtons({ id, first, last }: { id: number; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const cls = "flex h-3 w-4 items-center justify-center text-[9px] leading-none text-muted hover:text-fg disabled:opacity-25 disabled:hover:text-muted";
  return (
    <span className="mr-1 flex shrink-0 flex-col" title="调整顺序">
      <button type="button" className={cls} aria-label="上移" disabled={pending || first} onClick={() => start(() => moveProject(id, "up"))}>
        ▲
      </button>
      <button type="button" className={cls} aria-label="下移" disabled={pending || last} onClick={() => start(() => moveProject(id, "down"))}>
        ▼
      </button>
    </span>
  );
}
