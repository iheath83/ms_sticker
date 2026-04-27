// ─── Email block types ────────────────────────────────────────────────────────
// Stored as JSONB in email_templates.blocks

export type EmailBlock =
  | { type: "header"; bgColor: string; textColor: string }
  | { type: "hero"; title: string; subtitle: string; bgColor: string; textColor: string }
  | { type: "text"; content: string; align: "left" | "center" }
  | { type: "button"; label: string; url: string; bgColor: string; textColor: string }
  | { type: "order_info"; note: string }
  | { type: "divider"; color: string }
  | { type: "spacer"; height: number }
  | { type: "footer"; legalText: string };

// ─── Template variables ───────────────────────────────────────────────────────

export interface TemplateVars {
  customerName?: string;
  customerEmail?: string;
  orderNumber?: string;
  orderTotal?: string;
  orderUrl?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  batPreviewUrl?: string;
  revisionMessage?: string;
  replyMessage?: string;
  companyName?: string;
  year?: string;
  [key: string]: string | undefined;
}

export const TEMPLATE_VAR_TOKENS: Record<string, string> = {
  "{{customerName}}": "Prénom client",
  "{{customerEmail}}": "Email client",
  "{{orderNumber}}": "N° commande",
  "{{orderTotal}}": "Total commande",
  "{{orderUrl}}": "Lien commande",
  "{{trackingNumber}}": "N° suivi",
  "{{trackingCarrier}}": "Transporteur",
  "{{batPreviewUrl}}": "Lien BAT",
  "{{revisionMessage}}": "Message révision",
  "{{replyMessage}}": "Réponse admin",
  "{{companyName}}": "Nom entreprise",
  "{{year}}": "Année",
};

// ─── Variable interpolation ───────────────────────────────────────────────────

export function interpolate(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
  }
  return result;
}
