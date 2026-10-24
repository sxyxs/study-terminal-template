import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { BackLink, PageHeader } from "@/components/ui";
import { getProjectDetail } from "@/db/queries/projects";
import { folderLabel, getProjectDoc } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string; slug: string[] }> }) {
  const { id, slug } = await params;
  const detail = await getProjectDetail(Number(id));
  if (!detail) return { title: "项目文档" };
  const doc = await getProjectDoc(detail.project.slug, slug.join("/"));
  return { title: doc?.title ?? detail.project.name };
}

export default async function ProjectDocPage({ params }: { params: Promise<{ id: string; slug: string[] }> }) {
  const { id, slug } = await params;
  const detail = await getProjectDetail(Number(id));
  if (!detail) notFound();
  const doc = await getProjectDoc(detail.project.slug, slug.join("/"));
  if (!doc) notFound();
  return (
    <div className="space-y-4">
      <BackLink href={`/projects/${id}`}>{detail.project.name}</BackLink>
      <PageHeader
        title={doc.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {doc.folder ? <span>{folderLabel(doc.folder)}</span> : null}
            {doc.date ? <span className="font-mono">{doc.date}</span> : null}
            {doc.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </span>
        }
      />
      <article className="card p-5 md:p-7">
        <Markdown className="prose-article max-w-3xl">{doc.body}</Markdown>
      </article>
    </div>
  );
}
