import { sendEmail } from "@/lib/mail";
import type { ReviewRequestRow } from "./review-types";

const APP_URL = process.env.APP_URL ?? "https://msadhesif.fr";

function buildReviewLink(tokenHash: string): string {
  return `${APP_URL}/reviews/request/${tokenHash}`;
}

export async function sendReviewRequestEmail(
  request: ReviewRequestRow,
  _rawToken: string,
  customerName?: string,
): Promise<void> {
  const link = buildReviewLink(request.tokenHash);
  const name = customerName ?? request.customerEmail;

  await sendEmail({
    to: request.customerEmail,
    toName: customerName,
    subject: "Partagez votre avis sur votre commande",
    html: buildRequestEmailHtml(name, link),
  });
}

export async function sendReminderEmail(
  request: ReviewRequestRow,
  _rawToken: string,
  customerName?: string,
): Promise<void> {
  const link = buildReviewLink(request.tokenHash);
  const name = customerName ?? request.customerEmail;

  await sendEmail({
    to: request.customerEmail,
    toName: customerName,
    subject: "Un petit rappel — partagez votre avis",
    html: buildReminderEmailHtml(name, link),
  });
}

export async function sendThankYouEmail(email: string, customerName?: string): Promise<void> {
  await sendEmail({
    to: email,
    toName: customerName,
    subject: "Merci pour votre avis !",
    html: buildThankYouEmailHtml(customerName ?? email),
  });
}

function buildRequestEmailHtml(name: string, link: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">MS Adhésif</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#333;font-size:16px;line-height:1.6;">Bonjour ${escapeHtml(name)},</p>
          <p style="color:#333;font-size:16px;line-height:1.6;">
            Merci pour votre commande ! Nous espérons que vous êtes satisfait(e) de vos stickers.<br>
            Votre avis nous aide à améliorer nos produits et à aider d'autres clients.
          </p>
          <p style="text-align:center;margin:32px 0;">
            <a href="${link}" style="background:#1a1a2e;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;">
              ⭐ Laisser mon avis
            </a>
          </p>
          <p style="color:#666;font-size:13px;line-height:1.5;">
            Ce lien est valable 60 jours.<br>
            <a href="${APP_URL}/reviews/unsubscribe/${encodeURIComponent(link)}" style="color:#999;">Se désabonner des emails d'avis</a>
          </p>
        </td></tr>
        <tr><td style="background:#f0f0f0;padding:16px 32px;text-align:center;">
          <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} MS Adhésif — Tous droits réservés</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildReminderEmailHtml(name: string, link: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">MS Adhésif</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#333;font-size:16px;line-height:1.6;">Bonjour ${escapeHtml(name)},</p>
          <p style="color:#333;font-size:16px;line-height:1.6;">
            Nous voulions vous rappeler qu'il reste quelques jours pour partager votre expérience.<br>
            Votre avis compte vraiment pour nous et pour la communauté.
          </p>
          <p style="text-align:center;margin:32px 0;">
            <a href="${link}" style="background:#1a1a2e;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;">
              ⭐ Laisser mon avis
            </a>
          </p>
          <p style="color:#666;font-size:13px;line-height:1.5;">
            <a href="${APP_URL}/reviews/unsubscribe/${encodeURIComponent(link)}" style="color:#999;">Se désabonner des emails d'avis</a>
          </p>
        </td></tr>
        <tr><td style="background:#f0f0f0;padding:16px 32px;text-align:center;">
          <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} MS Adhésif — Tous droits réservés</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildThankYouEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f9f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">MS Adhésif</h1>
        </td></tr>
        <tr><td style="padding:32px;text-align:center;">
          <p style="font-size:48px;margin:0;">🎉</p>
          <h2 style="color:#1a1a2e;font-size:24px;">Merci pour votre avis !</h2>
          <p style="color:#333;font-size:16px;line-height:1.6;">
            Bonjour ${escapeHtml(name)},<br><br>
            Votre avis a bien été pris en compte. Merci de contribuer à la communauté MS Adhésif !
          </p>
          <p style="margin:32px 0;">
            <a href="${APP_URL}" style="background:#1a1a2e;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:16px;">
              Retour à la boutique
            </a>
          </p>
        </td></tr>
        <tr><td style="background:#f0f0f0;padding:16px 32px;text-align:center;">
          <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} MS Adhésif — Tous droits réservés</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
