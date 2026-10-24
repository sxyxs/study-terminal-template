// Shared between the client Nav and the server SidebarNav. Must stay a plain
// module (no "use client"): values exported from a client module turn into
// client references when imported by a server component and are unusable there.

export type NavNode = {
  /** Stable unique id across the whole tree; used as the expansion-state key. */
  id: string;
  label: string;
  /** Link target; may include a query string (matched exactly against the current URL). */
  href: string;
  icon?: string;
  /** Small numeric badge shown at the right edge. */
  count?: number;
  /** Render dimmed (paused or finished projects). */
  dim?: boolean;
  children?: NavNode[];
};

export const TOP_ITEMS: NavNode[] = [
  { id: "home", href: "/", label: "首页", icon: "⌂" },
  { id: "projects", href: "/projects", label: "项目", icon: "▤" },
  { id: "todos", href: "/todos", label: "任务", icon: "✓" },
  { id: "kb", href: "/kb", label: "知识库", icon: "≡" },
];
