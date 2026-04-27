/**
 * Brevo (ex-Sendinblue) email client.
 * Uses the transactional email REST API — no SDK to keep the bundle minimal.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailContact {
  email: string;
  name?: string;
}

interface SendEmailOptions {
  to: EmailContact[];
  subject: string;
  htmlContent: string;
  replyTo?: EmailContact;
}

type SendResult = { ok: true } | { ok: false; error: string };

// ─── Client ───────────────────────────────────────────────────────────────────

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const apiKey = process.env["BREVO_API_KEY"];
  if (!apiKey) {
    console.warn("[brevo] BREVO_API_KEY not set — email skipped");
    return { ok: true }; // Fail silently in dev if not configured
  }

  const from: EmailContact = {
    email: process.env["BREVO_FROM_EMAIL"] ?? "hello@msadhesif.fr",
    name: process.env["BREVO_FROM_NAME"] ?? "MS Adhésif",
  };

  const body = {
    sender: from,
    to: opts.to,
    subject: opts.subject,
    htmlContent: opts.htmlContent,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  };

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[brevo] API error", res.status, text);
      return { ok: false, error: `Brevo error ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error("[brevo] fetch error", err);
    return { ok: false, error: "Network error sending email" };
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

const BRAND_COLOR = "#DC2626";
const INK = "#0A0E27";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MS Adhésif</title>
</head>
<body style="margin:0;padding:0;background:#F5F2EC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:2px solid ${INK};border-radius:12px;overflow:hidden;max-width:600px;">
        <!-- Header -->
        <tr>
          <td style="background:${INK};padding:24px 32px;text-align:center;">
            <span style="font-family:Georgia,serif;font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.02em;">
              MS<span style="color:${BRAND_COLOR};">◆</span>ADHÉSIF
            </span>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F5F2EC;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6b7280;font-family:monospace;">
              MS Adhésif · Lyon, France · 
              <a href="${process.env["APP_URL"] ?? "https://msadhesif.fr"}" style="color:${BRAND_COLOR};text-decoration:none;">msadhesif.fr</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:${BRAND_COLOR};color:#fff;text-decoration:none;font-family:monospace;font-weight:700;font-size:14px;border-radius:8px;border:2px solid ${INK};margin-top:24px;">${label} →</a>`;
}

// ─── Template: order confirmation (client) ────────────────────────────────────

export interface OrderConfirmationData {
  customerName: string;
  orderNumber: string;
  itemCount: number;
  totalEuros: string;
  orderUrl: string;
}

export function buildOrderConfirmationEmail(data: OrderConfirmationData): string {
  return baseLayout(`
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND_COLOR};font-weight:700;letter-spacing:0.15em;font-family:monospace;">◆ COMMANDE CONFIRMÉE</p>
    <h1 style="margin:0 0 24px;font-size:28px;font-weight:900;color:${INK};">Bonjour ${data.customerName} !</h1>

    <p style="font-size:15px;color:#374151;line-height:1.6;">
      Votre commande <strong>#${data.orderNumber}</strong> a bien été reçue.<br/>
      Notre équipe prépare votre <strong>épreuve numérique (BAT)</strong> — vous la recevrez par email sous <strong>24h ouvrées</strong>.
    </p>

    <table width="100%" cellpadding="12" style="border:1.5px solid #e5e7eb;border-radius:8px;margin:24px 0;font-size:14px;">
      <tr style="background:#F5F2EC;">
        <td style="font-weight:700;color:${INK};">Commande</td>
        <td style="color:#6b7280;font-family:monospace;">#${data.orderNumber}</td>
      </tr>
      <tr>
        <td style="font-weight:700;color:${INK};">Articles</td>
        <td style="color:#374151;">${data.itemCount} article${data.itemCount > 1 ? "s" : ""}</td>
      </tr>
      <tr style="background:#F5F2EC;">
        <td style="font-weight:700;color:${INK};">Total TTC</td>
        <td style="color:${BRAND_COLOR};font-weight:700;font-size:16px;">${data.totalEuros} €</td>
      </tr>
    </table>

    <p style="font-size:14px;color:#374151;line-height:1.6;">
      Vous <strong>ne serez débité que si vous approuvez</strong> l'épreuve numérique.<br/>
      Aucun paiement maintenant.
    </p>

    ${btn(data.orderUrl, "Suivre ma commande")}

    <hr style="border:none;border-top:1px dashed #e5e7eb;margin:32px 0;" />

    <p style="font-size:12px;color:#9ca3af;line-height:1.5;">
      Des questions ? Répondez directement à cet email ou contactez-nous sur
      <a href="mailto:hello@msadhesif.fr" style="color:${BRAND_COLOR};">hello@msadhesif.fr</a>
    </p>
  `);
}

// ─── Template: new order notification (admin) ─────────────────────────────────

export interface AdminOrderNotificationData {
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  itemCount: number;
  totalEuros: string;
  adminOrderUrl: string;
  items: Array<{ name: string; quantity: number; widthMm: number; heightMm: number; shape: string; material: string; lineTotalEuros: string }>;
}

export function buildAdminOrderNotificationEmail(data: AdminOrderNotificationData): string {
  const itemRows = data.items
    .map(
      (i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;">${i.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace;">${i.quantity} × ${i.widthMm}×${i.heightMm}mm · ${i.shape}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;">${i.lineTotalEuros} €</td>
    </tr>`,
    )
    .join("");

  return baseLayout(`
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND_COLOR};font-weight:700;letter-spacing:0.15em;font-family:monospace;">◆ NOUVELLE COMMANDE — ACTION REQUISE</p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:${INK};">#${data.orderNumber}</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">${data.customerName} · ${data.customerEmail}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
      <thead>
        <tr style="background:#F5F2EC;">
          <th style="padding:10px 12px;text-align:left;color:${INK};">Article</th>
          <th style="padding:10px 12px;text-align:left;color:${INK};">Détails</th>
          <th style="padding:10px 12px;text-align:right;color:${INK};">Montant</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background:#F5F2EC;">
          <td colspan="2" style="padding:12px;font-weight:700;color:${INK};">Total TTC</td>
          <td style="padding:12px;text-align:right;font-weight:900;font-size:16px;color:${BRAND_COLOR};">${data.totalEuros} €</td>
        </tr>
      </tfoot>
    </table>

    <p style="font-size:14px;color:#374151;margin:24px 0 0;line-height:1.6;">
      Le client attend son <strong>BAT sous 24h ouvrées</strong>.<br/>
      Accédez au back-office pour uploader l'épreuve.
    </p>

    ${btn(data.adminOrderUrl, "Traiter cette commande")}
  `);
}
