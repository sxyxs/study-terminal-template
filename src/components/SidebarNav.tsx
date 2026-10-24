import { connection } from "next/server";
import { getProjectsOverview } from "@/db/queries/projects";
import { folderLabel, groupProjectDocs, listArticles, listProjectDocs, type KbMeta } from "@/lib/kb";
import { Nav } from "./Nav";
import { TOP_ITEMS, type NavNode } from "./nav-items";

/** Turn flat kb articles into a nested tree: folder nodes (sorted, first) then root articles. */
function buildKbTree(articles: KbMeta[]): NavNode[] {
  const root: NavNode[] = [];
  const folders = new Map<string, NavNode>();
  const folderNode = (fpath: string): NavNode => {
    let n = folders.get(fpath);
    if (!n) {
      const cut = fpath.lastIndexOf("/");
      const parent = cut === -1 ? "" : fpath.slice(0, cut);
      n = { id: `kb-folder-${fpath}`, label: folderLabel(fpath.slice(cut + 1)), href: "/kb", children: [] };
      folders.set(fpath, n);
      (parent ? folderNode(parent).children! : root).push(n);
    }
    return n;
  };
  for (const a of articles) {
    const leaf: NavNode = { id: `kb-${a.slug}`, label: a.title, href: `/kb/${a.slug}` };
    (a.folder ? folderNode(a.folder).children! : root).push(leaf);
  }
  for (const n of folders.values()) n.count = n.children!.length;
  const isFolder = (n: NavNode) => n.id.startsWith("kb-folder-");
  return root.sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || (isFolder(a) && isFolder(b) ? a.label.localeCompare(b.label) : 0));
}

/**
 * Server component: builds the sidebar tree (projects with their docs, knowledge-base
 * folders and articles) and renders the client Nav.
 * Query strings in hrefs follow the same key order the pages generate, so exact-match
 * active highlighting keeps working.
 */
export async function SidebarNav() {
  await connection();
  const [projects, articles] = await Promise.all([getProjectsOverview(), listArticles()]);

  const visibleProjects = projects.filter((p) => p.status !== "archived");
  const projectChildren: NavNode[] = await Promise.all(
    visibleProjects.map(async (p): Promise<NavNode> => {
      const docs = await listProjectDocs(p.slug);
      const docLeaf = (d: KbMeta): NavNode => ({
        id: `project-${p.id}-doc-${d.slug}`,
        label: d.title,
        href: `/projects/${p.id}/docs/${d.slug}`,
      });
      // Root docs sit directly under the project; each doc folder becomes a collapsible node after them.
      const docChildren = groupProjectDocs(docs, "").flatMap((g): NavNode[] =>
        g.folder
          ? [
              {
                id: `project-${p.id}-folder-${g.folder}`,
                label: g.label,
                href: `/projects/${p.id}`,
                count: g.docs.length,
                children: g.docs.map(docLeaf),
              },
            ]
          : g.docs.map(docLeaf),
      );
      return {
        id: `project-${p.id}`,
        label: p.name,
        href: `/projects/${p.id}`,
        count: p.openTodos > 0 ? p.openTodos : undefined,
        dim: p.status !== "active",
        children: docChildren.length ? docChildren : undefined,
      };
    }),
  );

  const kbChildren = buildKbTree(articles);

  const byId: Record<string, { children: NavNode[]; count: number }> = {
    projects: { children: projectChildren, count: visibleProjects.length },
    kb: { children: kbChildren, count: articles.length },
  };
  const tree = TOP_ITEMS.map((it) => {
    const extra = byId[it.id];
    return extra && extra.children.length > 0 ? { ...it, children: extra.children, count: extra.count } : it;
  });

  return <Nav tree={tree} />;
}
