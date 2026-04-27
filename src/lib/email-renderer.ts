import type { EmailBlock, TemplateVars } from "./email-blocks";
import { interpolate } from "./email-blocks";

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const BRAND = {
  ink: "#0A0E27",
  red: "#DC2626",
  white: "#FFFFFF",
  grey50: "#F9FAFB",
  grey200: "#E5E7EB",
  grey400: "#9CA3AF",
  grey600: "#6B7280",
  fontSans: "'Helvetica Neue', Arial, sans-serif",
  fontMono: "'Courier New', Courier, monospace",
  maxWidth: "600px",
};

// ─── Block renderers ──────────────────────────────────────────────────────────

function renderHeader(block: Extract<EmailBlock, { type: "header" }>, _vars: TemplateVars): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${block.bgColor};">
      <tr><td style="padding:24px 32px;text-align:center;">
        <span style="font-family:${BRAND.fontSans};font-size:22px;font-weight:900;letter-spacing:-0.5px;color:${block.textColor};">
          MS ADHÉSIF
        </span>
        <span style="color:${BRAND.red};font-size:10px;vertical-align:super;margin-left:2px;">◆</span>
      </td></tr>
    </table>`;
}

function renderHero(block: Extract<EmailBlock, { type: "hero" }>, vars: TemplateVars): string {
  const title = interpolate(block.title, vars);
  const subtitle = interpolate(block.subtitle, vars);
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${block.bgColor};">
      <tr><td style="padding:40px 32px 36px;text-align:center;">
        <h1 style="margin:0 0 12px;font-family:${BRAND.fontSans};font-size:28px;font-weight:800;color:${block.textColor};line-height:1.2;">${title}</h1>
        ${subtitle ? `<p style="margin:0;font-family:${BRAND.fontSans};font-size:16px;color:${block.textColor};opacity:0.75;line-height:1.5;">${subtitle}</p>` : ""}
      </td></tr>
    </table>`;
}

function renderText(block: Extract<EmailBlock, { type: "text" }>, vars: TemplateVars): string {
  const content = interpolate(block.content, vars);
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:16px 32px;text-align:${block.align};">
        <div style="font-family:${BRAND.fontSans};font-size:15px;color:${BRAND.grey600};line-height:1.7;">${content.replace(/\n/g, "<br>")}</div>
      </td></tr>
    </table>`;
}

function renderButton(block: Extract<EmailBlock, { type: "button" }>, vars: TemplateVars): string {
  const label = interpolate(block.label, vars);
  const url = interpolate(block.url, vars);
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:16px 32px;text-align:center;">
        <a href="${url}" style="display:inline-block;padding:14px 32px;background:${block.bgColor};color:${block.textColor};font-family:${BRAND.fontSans};font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
          ${label} →
        </a>
      </td></tr>
    </table>`;
}

function renderOrderInfo(block: Extract<EmailBlock, { type: "order_info" }>, vars: TemplateVars): string {
  const note = interpolate(block.note, vars);
  const rows: string[] = [];
  if (vars.orderNumber) rows.push(`<tr><td style="padding:8px 0;font-size:13px;color:${BRAND.grey600};border-bottom:1px solid ${BRAND.grey200};">N° commande</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:${BRAND.ink};text-align:right;border-bottom:1px solid ${BRAND.grey200};">${vars.orderNumber}</td></tr>`);
  if (vars.orderTotal) rows.push(`<tr><td style="padding:8px 0;font-size:13px;color:${BRAND.grey600};">Total TTC</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:${BRAND.red};text-align:right;">${vars.orderTotal}</td></tr>`);
  if (vars.trackingNumber) rows.push(`<tr><td style="padding:8px 0;font-size:13px;color:${BRAND.grey600};border-top:1px solid ${BRAND.grey200};">Suivi</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:${BRAND.ink};text-align:right;">${vars.trackingNumber} (${vars.trackingCarrier ?? ""})</td></tr>`);
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:16px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.grey50};border:1.5px solid ${BRAND.grey200};border-radius:8px;">
          <tr><td style="padding:16px 20px;">
            ${rows.join("")}
            ${note ? `<tr><td colspan="2" style="padding:12px 0 0;font-size:12px;color:${BRAND.grey400};">${note}</td></tr>` : ""}
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

function renderDivider(block: Extract<EmailBlock, { type: "divider" }>, _vars: TemplateVars): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 32px;"><hr style="border:none;border-top:1px solid ${block.color};margin:0;"></td></tr>
    </table>`;
}

function renderSpacer(block: Extract<EmailBlock, { type: "spacer" }>, _vars: TemplateVars): string {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:${block.height}px;line-height:${block.height}px;">&nbsp;</td></tr></table>`;
}

function renderFooter(block: Extract<EmailBlock, { type: "footer" }>, vars: TemplateVars): string {
  const legal = interpolate(block.legalText, vars);
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.ink};margin-top:8px;">
      <tr><td style="padding:28px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-family:${BRAND.fontSans};font-size:13px;font-weight:800;color:${BRAND.white};">MS ADHÉSIF</p>
        <p style="margin:0 0 12px;font-family:${BRAND.fontSans};font-size:11px;color:${BRAND.grey400};line-height:1.6;">${legal.replace(/\n/g, "<br>")}</p>
        <p style="margin:0;font-family:${BRAND.fontSans};font-size:11px;color:${BRAND.grey600};">
          <a href="{{orderUrl}}" style="color:${BRAND.grey400};">Voir ma commande</a> &nbsp;·&nbsp;
          <a href="https://msadhesif.fr/cgv" style="color:${BRAND.grey400};">CGV</a> &nbsp;·&nbsp;
          <a href="https://msadhesif.fr/politique-confidentialite" style="color:${BRAND.grey400};">Confidentialité</a>
        </p>
      </td></tr>
    </table>`;
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function renderEmailHtml(blocks: EmailBlock[], vars: TemplateVars): string {
  const bodyParts = blocks.map((block) => {
    switch (block.type) {
      case "header":    return renderHeader(block, vars);
      case "hero":      return renderHero(block, vars);
      case "text":      return renderText(block, vars);
      case "button":    return renderButton(block, vars);
      case "order_info": return renderOrderInfo(block, vars);
      case "divider":   return renderDivider(block, vars);
      case "spacer":    return renderSpacer(block, vars);
      case "footer":    return renderFooter(block, vars);
      default:          return "";
    }
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>MS Adhésif</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Helvetica Neue,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:${BRAND.maxWidth};background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        ${bodyParts.join("")}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Render subject line ──────────────────────────────────────────────────────

export function renderSubject(subject: string, vars: TemplateVars): string {
  return interpolate(subject, vars);
}
