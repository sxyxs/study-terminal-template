import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { BackLink, PageHeader } from "@/components/ui";
import { folderLabel, getArticle } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const a = await getArticle(slug.join("/"));
  return { title: a?.title ?? "知识库" };
}

export default async function KbArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const a = await getArticle(slug.join("/"));
  if (!a) notFound();
  return (
    <div className="space-y-4">
      <BackLink href="/kb">知识库</BackLink>
      <PageHeader
        title={a.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {a.folder ? (
              <span className="chip">{a.folder.split("/").map(folderLabel).join(" / ")}</span>
            ) : null}
            {a.date ? <span className="font-mono">{a.date}</span> : null}
            {a.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </span>
        }
      />
      <article className="card p-5 md:p-7">
        <Markdown className="prose-article max-w-3xl">{a.body}</Markdown>
      </article>
    </div>
  );
}
