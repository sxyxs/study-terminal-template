import fs from "node:fs/promises";
import path from "node:path";

/** Knowledge-base articles live as Markdown files with YAML-ish frontmatter in content/kb/.
 *  Subdirectories act as folders: the slug is the path relative to content/kb (no .md).
 *  Project docs live in content/projects/<project-slug>/ and are shown on the project's
 *  detail page instead of the knowledge base; one level of subdirectories groups them
 *  into folders there (e.g. analysis/results.md), labelled through FOLDER_LABELS. */
const KB_DIR = path.resolve(process.cwd(), "content/kb");
const PROJECT_DOCS_DIR = path.resolve(process.cwd(), "content/projects");
/** Project doc slugs are "<doc>" or "<folder>/<doc>". */
const PROJECT_DOC_MAX_DEPTH = 2;

/** Display names for folder path segments; unlisted folders show their raw name. */
export const FOLDER_LABELS: Record<string, string> = {
  notes: "学习笔记",
  tools: "工具",
  analysis: "实验结果分析",
};

export function folderLabel(segment: string): string {
  return FOLDER_LABELS[segment] ?? segment;
}

export type KbMeta = {
  /** Path-style slug relative to content/kb, e.g. "notes/what-is-rsc". */
  slug: string;
  /** Folder part of the slug ("" for root articles). */
  folder: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
};

export type KbArticle = KbMeta & { body: string };

/** Minimal frontmatter parser: `key: value` lines between two `---` fences; tags as `[a, b]`. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

function parseTags(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

async function readMdFile(absPath: string, slug: string): Promise<KbArticle> {
  const raw = await fs.readFile(absPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const name = slug.split("/").pop()!;
  const folder = slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : "";
  return {
    slug,
    folder,
    title: meta.title || name,
    date: meta.date || "",
    summary: meta.summary || "",
    tags: parseTags(meta.tags),
    body,
  };
}

async function walk(dir: string, prefix: string): Promise<KbArticle[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: KbArticle[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(abs, prefix ? `${prefix}/${e.name}` : e.name)));
    } else if (e.isFile() && e.name.endsWith(".md")) {
      const slug = (prefix ? `${prefix}/` : "") + e.name.slice(0, -3);
      out.push(await readMdFile(abs, slug));
    }
  }
  return out;
}

function stripBody({ slug, folder, title, date, summary, tags }: KbArticle): KbMeta {
  return { slug, folder, title, date, summary, tags };
}

function byDateDesc(a: KbMeta, b: KbMeta): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title);
}

export async function listArticles(): Promise<KbMeta[]> {
  const articles = await walk(KB_DIR, "");
  return articles.map(stripBody).sort(byDateDesc);
}

/** True when every path segment is a plain file name (no traversal, no hidden files). */
function isSafeSlugPath(slug: string, maxDepth: number): boolean {
  const parts = slug.split("/");
  if (parts.length === 0 || parts.length > maxDepth) return false;
  return parts.every((p) => /^[\w.-]+$/.test(p) && p !== "." && p !== ".." && !p.startsWith("."));
}

export async function getArticle(slug: string): Promise<KbArticle | null> {
  if (!isSafeSlugPath(slug, 6)) return null;
  try {
    return await readMdFile(path.join(KB_DIR, `${slug}.md`), slug);
  } catch {
    return null;
  }
}

export async function listProjectDocs(projectSlug: string): Promise<KbMeta[]> {
  if (!isSafeSlugPath(projectSlug, 1)) return [];
  const docs = await walk(path.join(PROJECT_DOCS_DIR, projectSlug), "");
  // Deeper nesting is not routable (getProjectDoc caps the slug depth), so leave it out of listings.
  return docs
    .filter((d) => isSafeSlugPath(d.slug, PROJECT_DOC_MAX_DEPTH))
    .map(stripBody)
    .sort(byDateDesc);
}

export type ProjectDocGroup = { folder: string; label: string; docs: KbMeta[] };

/** Split project docs into the root group (folder "") first, then one group per folder by label. */
export function groupProjectDocs(docs: KbMeta[], rootLabel: string): ProjectDocGroup[] {
  const byFolder = new Map<string, KbMeta[]>();
  for (const d of docs) {
    const list = byFolder.get(d.folder);
    if (list) list.push(d);
    else byFolder.set(d.folder, [d]);
  }
  const groups: ProjectDocGroup[] = [];
  for (const [folder, list] of byFolder) {
    groups.push({ folder, label: folder ? folderLabel(folder) : rootLabel, docs: list });
  }
  return groups.sort((a, b) => Number(a.folder !== "") - Number(b.folder !== "") || a.label.localeCompare(b.label));
}

export async function getProjectDoc(projectSlug: string, slug: string): Promise<KbArticle | null> {
  if (!isSafeSlugPath(projectSlug, 1) || !isSafeSlugPath(slug, PROJECT_DOC_MAX_DEPTH)) return null;
  try {
    return await readMdFile(path.join(PROJECT_DOCS_DIR, projectSlug, `${slug}.md`), slug);
  } catch {
    return null;
  }
}
