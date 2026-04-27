import { notFound } from "next/navigation";
import { getEmailTemplate } from "@/lib/email-template-actions";
import { EMAIL_TEMPLATE_TYPES } from "@/db/schema";
import type { EmailTemplateType } from "@/db/schema";
import EmailEditorClient from "@/components/admin/email-editor-client";

interface Props {
  params: Promise<{ type: string }>;
}

export async function generateStaticParams() {
  return EMAIL_TEMPLATE_TYPES.map((type) => ({ type }));
}

export default async function AdminEmailEditPage({ params }: Props) {
  const { type } = await params;

  if (!EMAIL_TEMPLATE_TYPES.includes(type as EmailTemplateType)) {
    notFound();
  }

  const template = await getEmailTemplate(type as EmailTemplateType);
  if (!template) notFound();

  const serialized = {
    type: template.type as EmailTemplateType,
    name: template.name,
    subject: template.subject,
    blocks: template.blocks,
    designJson: template.designJson ?? null,
  };

  return <EmailEditorClient template={serialized} />;
}
