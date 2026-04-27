"use server";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { EmailBlock, TemplateVars } from "@/lib/email-blocks";
import { renderEmailHtml, renderSubject } from "@/lib/email-renderer";
import { DEFAULT_TEMPLATES } from "@/lib/email-defaults";
import type { EmailTemplateType } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// ─── List all templates ───────────────────────────────────────────────────────

export async function listEmailTemplates() {
  const rows = await db.select().from(emailTemplates).orderBy(emailTemplates.type);
  return rows;
}

// ─── Get one template ─────────────────────────────────────────────────────────

export async function getEmailTemplate(type: EmailTemplateType) {
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.type, type))
    .limit(1);
  if (row) return row;

  // Return default if not yet saved to DB
  const def = DEFAULT_TEMPLATES.find((t) => t.type === type);
  if (!def) return null;
  return { ...def, id: "", updatedAt: new Date(), designJson: null, renderedHtml: null };
}

// ─── Save template ────────────────────────────────────────────────────────────

export async function saveEmailTemplate(
  type: EmailTemplateType,
  subject: string,
  blocks: EmailBlock[],
  designJson?: Record<string, unknown>,
  renderedHtml?: string,
) {
  await requireAdmin();

  const existing = await db
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(eq(emailTemplates.type, type))
    .limit(1);

  const updateData: {
    subject: string;
    blocks: EmailBlock[];
    updatedAt: Date;
    designJson?: Record<string, unknown>;
    renderedHtml?: string;
  } = { subject, blocks, updatedAt: new Date() };
  if (designJson) updateData.designJson = designJson;
  if (renderedHtml) updateData.renderedHtml = renderedHtml;

  if (existing.length > 0) {
    await db
      .update(emailTemplates)
      .set(updateData)
      .where(eq(emailTemplates.type, type));
  } else {
    const def = DEFAULT_TEMPLATES.find((t) => t.type === type);
    await db.insert(emailTemplates).values({
      type,
      name: def?.name ?? type,
      subject,
      blocks,
      designJson: designJson ?? undefined,
      renderedHtml: renderedHtml ?? undefined,
    });
  }

  revalidatePath("/admin/emails");
  return { ok: true };
}

// ─── Reset to default ─────────────────────────────────────────────────────────

export async function resetEmailTemplate(type: EmailTemplateType) {
  await requireAdmin();

  const def = DEFAULT_TEMPLATES.find((t) => t.type === type);
  if (!def) return { ok: false, error: "Template introuvable" };

  await db
    .delete(emailTemplates)
    .where(eq(emailTemplates.type, type));

  revalidatePath("/admin/emails");
  return { ok: true };
}

// ─── Seed all defaults ────────────────────────────────────────────────────────

export async function seedEmailTemplates() {
  await requireAdmin();

  const { UNLAYER_DESIGNS } = await import("@/lib/unlayer-designs");
  const { renderEmailHtml } = await import("@/lib/email-renderer");

  for (const tpl of DEFAULT_TEMPLATES) {
    const existing = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.type, tpl.type))
      .limit(1);

    const designJson = UNLAYER_DESIGNS[tpl.type] ?? undefined;

    if (existing.length === 0) {
      await db.insert(emailTemplates).values({
        ...tpl,
        designJson: designJson ?? undefined,
      });
    } else {
      // Update with Unlayer design if not already set
      if (designJson) {
        await db
          .update(emailTemplates)
          .set({ designJson, updatedAt: new Date() })
          .where(eq(emailTemplates.type, tpl.type));
      }
    }
  }

  revalidatePath("/admin/emails");
  return { ok: true };
}

// ─── Seed/force-reset Unlayer designs ────────────────────────────────────────

export async function seedUnlayerDesigns() {
  await requireAdmin();

  const { UNLAYER_DESIGNS } = await import("@/lib/unlayer-designs");

  for (const tpl of DEFAULT_TEMPLATES) {
    const designJson = UNLAYER_DESIGNS[tpl.type];
    if (!designJson) continue;

    const existing = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.type, tpl.type))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(emailTemplates)
        .set({ designJson, updatedAt: new Date() })
        .where(eq(emailTemplates.type, tpl.type));
    } else {
      await db.insert(emailTemplates).values({ ...tpl, designJson });
    }
  }

  revalidatePath("/admin/emails");
  return { ok: true };
}

// ─── Render preview ───────────────────────────────────────────────────────────

export async function previewEmailTemplate(
  blocks: EmailBlock[],
  subject: string,
  vars?: Partial<TemplateVars>,
): Promise<{ html: string; subject: string }> {
  const sampleVars: TemplateVars = {
    customerName: "Jean Dupont",
    customerEmail: "jean@exemple.fr",
    orderNumber: "MSA-2026-0042",
    orderTotal: "47,90 €",
    orderUrl: "https://msadhesif.fr/account/orders/preview",
    trackingNumber: "6A12345678901",
    trackingCarrier: "Colissimo",
    batPreviewUrl: "https://msadhesif.fr/bat/preview",
    revisionMessage: "Pouvez-vous décaler le logo vers la droite ?",
    replyMessage: "Le logo a été ajusté, voici le nouveau BAT.",
    companyName: "MS Adhésif",
    year: String(new Date().getFullYear()),
    ...vars,
  };

  return {
    html: renderEmailHtml(blocks, sampleVars),
    subject: renderSubject(subject, sampleVars),
  };
}
