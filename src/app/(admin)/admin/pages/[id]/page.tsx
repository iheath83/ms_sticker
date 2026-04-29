import { notFound } from "next/navigation";
import { getPageAdmin } from "@/lib/pages-actions";
import { PageEditorClient } from "./page-editor-client";

export const dynamic = "force-dynamic";

export default async function PageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") {
    return <PageEditorClient page={null} />;
  }
  const page = await getPageAdmin(id);
  if (!page) notFound();
  return <PageEditorClient page={page} />;
}
