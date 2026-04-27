/**
 * Thin wrapper around brevo.ts with a simplified API.
 * Supports DB-driven templates or inline HTML.
 */
import { sendEmail as brevoSend } from "@/lib/brevo";
import type { EmailTemplateType } from "@/db/schema";
import type { TemplateVars } from "@/lib/email-blocks";

export interface MailOptions {
  to: string;
  toName?: string | undefined;
  subject: string;
  html: string;
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  const contact: { email: string; name?: string } = { email: opts.to };
  if (opts.toName) contact.name = opts.toName;
  await brevoSend({
    to: [contact],
    subject: opts.subject,
    htmlContent: opts.html,
  });
}

// ─── Template-based sending ───────────────────────────────────────────────────

export async function sendTemplatedEmail(
  type: EmailTemplateType,
  to: string,
  vars: TemplateVars,
  toName?: string,
): Promise<void> {
  const { db } = await import("@/db");
  const { emailTemplates } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { renderEmailHtml, renderSubject } = await import("@/lib/email-renderer");
  const { interpolate } = await import("@/lib/email-blocks");
  const { DEFAULT_TEMPLATES } = await import("@/lib/email-defaults");

  const fullVars: TemplateVars = {
    companyName: "MS Adhésif",
    year: String(new Date().getFullYear()),
    ...vars,
  };

  // Try DB first, fall back to default
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.type, type))
    .limit(1);

  let subject: string;
  let html: string;

  if (row) {
    subject = renderSubject(row.subject, fullVars);
    // Use pre-rendered Unlayer HTML if available, otherwise re-render from blocks
    if (row.renderedHtml) {
      subject = renderSubject(row.subject, fullVars);
      // Substitute variables in the pre-rendered HTML
      html = row.renderedHtml;
      for (const [key, value] of Object.entries(fullVars)) {
        if (value !== undefined) {
          html = html.replaceAll(`{{${key}}}`, value);
        }
      }
    } else {
      html = renderEmailHtml(row.blocks, fullVars);
    }
  } else {
    const def = DEFAULT_TEMPLATES.find((t) => t.type === type);
    if (!def) throw new Error(`No email template for type: ${type}`);
    subject = interpolate(def.subject, fullVars);
    html = renderEmailHtml(def.blocks, fullVars);
  }

  const opts: MailOptions = { to, subject, html };
  if (toName) opts.toName = toName;
  await sendEmail(opts);
}
