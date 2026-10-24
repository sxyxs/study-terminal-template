import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { folderLabel, listArticles, type KbMeta } from "@/lib/kb";

export const metadata = { title: "知识库" };
export const dynamic = "force-dynamic";

function ArticleCard({ a }: { a: KbMeta }) {
  return (
    <Link href={`/kb/${a.slug}`} className="card block p-4 transition hover:border-accent">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">{a.title}</span>
        {a.date ? <span className="font-mono text-[11px] text-muted">{a.date}</span> : null}
      </div>
      {a.summary ? <p className="mt-1 text-xs leading-relaxed text-muted">{a.summary}</p> : null}
      {a.tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {a.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export default async function KbPage() {
  const articles = await listArticles();
  // Group by the top-level folder; "" collects articles sitting directly in content/kb/.
  const groups = new Map<string, KbMeta[]>();
  for (const a of articles) {
    const key = a.folder.split("/")[0] ?? "";
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }
  const folderKeys = [...groups.keys()].filter((k) => k !== "").sort();
  const rootArticles = groups.get("") ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="知识库" subtitle={`${articles.length} 篇 · 文章是 content/kb/**/*.md，子文件夹即分组，新增文件即可，无需重启`} />
      {articles.length === 0 ? <Empty>还没有文章。在 content/kb/ 下新建一个带 frontmatter 的 .md 文件。</Empty> : null}
      {folderKeys.map((key) => (
        <section key={key} className="space-y-3">
          <h2 className="flex items-baseline gap-2 border-b pb-1 text-sm font-semibold">
            ▸ {folderLabel(key)}
            <span className="font-mono text-[11px] font-normal text-muted">{groups.get(key)!.length} 篇</span>
          </h2>
          <div className="space-y-3">
            {groups.get(key)!.map((a) => (
              <ArticleCard key={a.slug} a={a} />
            ))}
          </div>
        </section>
      ))}
      {rootArticles.length > 0 ? (
        <section className="space-y-3">
          {folderKeys.length > 0 ? (
            <h2 className="flex items-baseline gap-2 border-b pb-1 text-sm font-semibold">
              ▸ 未分类
              <span className="font-mono text-[11px] font-normal text-muted">{rootArticles.length} 篇</span>
            </h2>
          ) : null}
          <div className="space-y-3">
            {rootArticles.map((a) => (
              <ArticleCard key={a.slug} a={a} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
