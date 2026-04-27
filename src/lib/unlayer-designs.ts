/**
 * Unlayer design JSON builder for MS Adhésif email templates.
 * Generates valid Unlayer schemaVersion 16 designs.
 */

// ─── Brand ────────────────────────────────────────────────────────────────────
const INK = "#0A0E27";
const RED = "#DC2626";
const WHITE = "#FFFFFF";
const GREY_BG = "#F3F4F6";
const GREY_BORDER = "#E5E7EB";
const GREY_TEXT = "#6B7280";
const FONT = { label: "Helvetica", value: "'Helvetica Neue',Helvetica,Arial,sans-serif" };

// ─── ID generator ─────────────────────────────────────────────────────────────
let _id = 1;
const uid = () => `u_${_id++}`;

// ─── Cell/column/row helpers ──────────────────────────────────────────────────

function makeColumn(contents: object[], bgColor = WHITE): object {
  return {
    id: uid(),
    contents,
    values: {
      backgroundColor: bgColor,
      padding: "0px",
      border: {},
      borderRadius: "0px",
      _meta: { htmlID: uid(), htmlClassNames: "u_column" },
    },
  };
}

function makeRow(columns: object[], bgColor = WHITE, paddingV = "0px"): object {
  return {
    id: uid(),
    cells: columns.map(() => 1),
    columns,
    values: {
      displayCondition: null,
      columns: false,
      backgroundColor: bgColor,
      columnsBackgroundColor: "",
      backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "top_center", customPosition: ["50%", "0%"] },
      padding: `${paddingV} 0px`,
      anchor: "",
      hideDesktop: false,
      _meta: { htmlID: uid(), htmlClassNames: "u_row" },
    },
  };
}

// ─── Content block helpers ────────────────────────────────────────────────────

function logoBlock(): object {
  return {
    id: uid(),
    type: "text",
    values: {
      containerPadding: "24px 32px",
      anchor: "",
      fontFamily: FONT,
      fontSize: "22px",
      fontWeight: 900,
      color: WHITE,
      textAlign: "center",
      lineHeight: "120%",
      letterSpacing: "0px",
      text: `<span style="letter-spacing:-0.5px">MS ADHÉSIF</span><span style="color:${RED};font-size:10px;vertical-align:super;margin-left:2px">◆</span>`,
      hideDesktop: false,
      displayCondition: null,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_text" },
    },
  };
}

function heroBlock(title: string, subtitle: string): object {
  return {
    id: uid(),
    type: "text",
    values: {
      containerPadding: "40px 32px 32px",
      anchor: "",
      fontFamily: FONT,
      fontSize: "28px",
      fontWeight: 800,
      color: INK,
      textAlign: "center",
      lineHeight: "130%",
      letterSpacing: "0px",
      text: `<strong>${title}</strong>${subtitle ? `<br><span style="font-size:16px;font-weight:400;opacity:0.7">${subtitle}</span>` : ""}`,
      hideDesktop: false,
      displayCondition: null,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_text" },
    },
  };
}

function textBlock(content: string, align: "left" | "center" = "left"): object {
  return {
    id: uid(),
    type: "text",
    values: {
      containerPadding: "12px 32px",
      anchor: "",
      fontFamily: FONT,
      fontSize: "15px",
      color: GREY_TEXT,
      textAlign: align,
      lineHeight: "170%",
      letterSpacing: "0px",
      text: content.replace(/\n/g, "<br>"),
      hideDesktop: false,
      displayCondition: null,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_text" },
    },
  };
}

function buttonBlock(label: string, url: string, bgColor = RED): object {
  return {
    id: uid(),
    type: "button",
    values: {
      containerPadding: "16px 32px 24px",
      anchor: "",
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: "15px",
      textColor: WHITE,
      backgroundColor: bgColor,
      buttonColors: { color: WHITE, backgroundColor: bgColor, hoverColor: WHITE, hoverBackgroundColor: "#B91C1C" },
      size: { autoWidth: true, width: "100%" },
      textAlign: "center",
      lineHeight: "120%",
      padding: "14px 32px",
      border: {},
      borderRadius: "8px",
      hideDesktop: false,
      displayCondition: null,
      href: { name: "web", values: { href: url, target: "_blank" } },
      text: `${label} →`,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_button" },
    },
  };
}

function dividerBlock(): object {
  return {
    id: uid(),
    type: "divider",
    values: {
      containerPadding: "8px 32px",
      anchor: "",
      width: "100%",
      border: { borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: GREY_BORDER },
      textAlign: "center",
      hideDesktop: false,
      displayCondition: null,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_divider" },
    },
  };
}

function spacerBlock(height = 16): object {
  return {
    id: uid(),
    type: "html",
    values: {
      containerPadding: "0px",
      anchor: "",
      html: `<div style="height:${height}px"></div>`,
      hideDesktop: false,
      displayCondition: null,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_html" },
    },
  };
}

function orderInfoBlock(note = ""): object {
  const noteHtml = note
    ? `<tr><td colspan="2" style="padding:10px 0 0;font-size:12px;color:#9CA3AF">${note}</td></tr>`
    : "";
  return {
    id: uid(),
    type: "html",
    values: {
      containerPadding: "8px 32px",
      anchor: "",
      html: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:8px">
  <tr><td style="padding:16px 20px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#6B7280;border-bottom:1px solid #E5E7EB">N° commande</td>
        <td style="padding:8px 0;font-size:13px;font-weight:700;color:#0A0E27;text-align:right;border-bottom:1px solid #E5E7EB">{{orderNumber}}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#6B7280">Total TTC</td>
        <td style="padding:8px 0;font-size:13px;font-weight:700;color:#DC2626;text-align:right">{{orderTotal}}</td>
      </tr>
      ${noteHtml}
    </table>
  </td></tr>
</table>`,
      hideDesktop: false,
      displayCondition: null,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_html" },
    },
  };
}

function footerBlock(): object {
  return {
    id: uid(),
    type: "text",
    values: {
      containerPadding: "24px 32px",
      anchor: "",
      fontFamily: FONT,
      fontSize: "11px",
      color: "#9CA3AF",
      textAlign: "center",
      lineHeight: "160%",
      letterSpacing: "0px",
      text: `<strong style="color:${WHITE}">MS ADHÉSIF</strong><br>© {{year}} — msadhesif.fr<br><a href="{{orderUrl}}" style="color:#6B7280">Voir ma commande</a> &nbsp;·&nbsp; <a href="https://msadhesif.fr/cgv" style="color:#6B7280">CGV</a> &nbsp;·&nbsp; <a href="https://msadhesif.fr/politique-confidentialite" style="color:#6B7280">Confidentialité</a>`,
      hideDesktop: false,
      displayCondition: null,
      _meta: { htmlID: uid(), htmlClassNames: "u_content_text" },
    },
  };
}

// ─── Body wrapper ─────────────────────────────────────────────────────────────

function makeBody(rows: object[]): object {
  return {
    id: uid(),
    rows,
    headers: [],
    footers: [],
    values: {
      popupPosition: "center",
      popupWidth: "600px",
      popupHeight: "auto",
      borderRadius: "0px",
      contentAlign: "center",
      contentVerticalAlign: "center",
      contentWidth: 600,
      fontFamily: FONT,
      textColor: INK,
      popupBackgroundColor: WHITE,
      popupBackgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "cover", position: "center" },
      popupOverlay_backgroundColor: "rgba(0,0,0,0.1)",
      popupCloseButton_margin: "0px",
      popupCloseButton_position: "top-right",
      popupCloseButton_backgroundColor: "#DDDDDD",
      popupCloseButton_iconColor: "#000000",
      popupCloseButton_borderRadius: "0px",
      backgroundColor: GREY_BG,
      backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "top_center" },
      preheaderText: "",
      linkStyle: { body: false, linkColor: RED, linkHoverColor: INK, linkUnderline: true, linkHoverUnderline: true, inherit: false },
      _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
    },
  };
}

function makeDesign(rows: object[]): Record<string, unknown> {
  _id = 1; // reset IDs for each design
  return {
    schemaVersion: 16,
    counters: { u_row: 10, u_column: 10, u_content_text: 10, u_content_button: 5, u_content_divider: 5, u_content_html: 10 },
    body: makeBody(rows),
  };
}

// ─── Template designs ─────────────────────────────────────────────────────────

export const UNLAYER_DESIGNS: Record<string, Record<string, unknown>> = {

  "order-received": makeDesign([
    makeRow([makeColumn([logoBlock()])], INK),
    makeRow([makeColumn([heroBlock("Commande confirmée ! ✅", "Merci {{customerName}}, nous avons bien reçu votre commande.")])], "#F0FDF4"),
    makeRow([makeColumn([
      spacerBlock(16),
      orderInfoBlock("Votre commande est en cours de préparation. Vous recevrez votre BAT très bientôt."),
      spacerBlock(16),
      textBlock("Nous allons préparer votre maquette (BAT) et vous l'envoyer pour validation avant impression.\n\nVous pouvez suivre votre commande en cliquant ci-dessous.", "center"),
      buttonBlock("Suivre ma commande", "{{orderUrl}}"),
      spacerBlock(8),
    ])]),
    makeRow([makeColumn([dividerBlock(), footerBlock()])], INK),
  ]),

  "proof-ready": makeDesign([
    makeRow([makeColumn([logoBlock()])], INK),
    makeRow([makeColumn([heroBlock("Votre BAT est prêt ! 🎨", "Votre maquette est disponible pour validation.")])], "#EFF6FF"),
    makeRow([makeColumn([
      spacerBlock(16),
      textBlock("Bonjour {{customerName}},\n\nNous avons préparé votre Bon À Tirer (BAT). Veuillez le consulter et nous indiquer si vous souhaitez aller en impression ou demander des modifications.\n\n⚠️ L'impression ne démarre qu'après votre validation."),
      spacerBlock(8),
      buttonBlock("Voir et valider mon BAT", "{{orderUrl}}"),
      spacerBlock(8),
      orderInfoBlock(""),
      spacerBlock(16),
    ])]),
    makeRow([makeColumn([dividerBlock(), footerBlock()])], INK),
  ]),

  "proof-revision-acknowledged": makeDesign([
    makeRow([makeColumn([logoBlock()])], INK),
    makeRow([makeColumn([heroBlock("Révision bien reçue 🔄", "Nous avons pris en compte vos modifications.")])], "#FFFBEB"),
    makeRow([makeColumn([
      spacerBlock(16),
      textBlock("Bonjour {{customerName}},\n\nNous avons bien reçu votre demande de révision :"),
      textBlock("« {{revisionMessage}} »", "center"),
      textBlock("Notre équipe va traiter votre demande dans les plus brefs délais et vous envoyer un nouveau BAT."),
      buttonBlock("Voir ma commande", "{{orderUrl}}", INK),
      spacerBlock(16),
    ])]),
    makeRow([makeColumn([dividerBlock(), footerBlock()])], INK),
  ]),

  "payment-received": makeDesign([
    makeRow([makeColumn([logoBlock()])], INK),
    makeRow([makeColumn([heroBlock("Paiement confirmé 💳", "Votre paiement a bien été enregistré.")])], "#F0FDF4"),
    makeRow([makeColumn([
      spacerBlock(16),
      orderInfoBlock(""),
      spacerBlock(16),
      textBlock("Bonjour {{customerName}},\n\nVotre paiement a bien été traité. Une facture sera disponible dans votre espace client sous peu."),
      buttonBlock("Voir ma commande", "{{orderUrl}}"),
      spacerBlock(16),
    ])]),
    makeRow([makeColumn([dividerBlock(), footerBlock()])], INK),
  ]),

  "order-shipped": makeDesign([
    makeRow([makeColumn([logoBlock()])], INK),
    makeRow([makeColumn([heroBlock("C'est parti ! 📦", "Votre commande a été expédiée.")])], "#EEF2FF"),
    makeRow([makeColumn([
      spacerBlock(16),
      orderInfoBlock(""),
      spacerBlock(16),
      textBlock("Bonjour {{customerName}},\n\nVotre commande est en route ! Transporteur : {{trackingCarrier}} — N° de suivi : {{trackingNumber}}"),
      buttonBlock("Suivre mon colis", "{{orderUrl}}"),
      spacerBlock(16),
    ])]),
    makeRow([makeColumn([dividerBlock(), footerBlock()])], INK),
  ]),

  "admin-new-order": makeDesign([
    makeRow([makeColumn([logoBlock()])], RED),
    makeRow([makeColumn([heroBlock("Nouvelle commande ! 🛒", "#{{orderNumber}} — {{orderTotal}}")])], INK),
    makeRow([makeColumn([
      spacerBlock(16),
      textBlock("Client : {{customerName}} ({{customerEmail}})"),
      spacerBlock(8),
      orderInfoBlock(""),
      spacerBlock(16),
      buttonBlock("Voir dans le back-office", "{{orderUrl}}", RED),
      spacerBlock(16),
    ])]),
    makeRow([makeColumn([dividerBlock(), footerBlock()])], INK),
  ]),

  "bat-reply": makeDesign([
    makeRow([makeColumn([logoBlock()])], INK),
    makeRow([makeColumn([heroBlock("Réponse à votre révision 📩", "Commande #{{orderNumber}}")])], "#F0F9FF"),
    makeRow([makeColumn([
      spacerBlock(16),
      textBlock("Bonjour {{customerName}},\n\nNotre équipe a répondu à votre demande de révision :"),
      textBlock("« {{replyMessage}} »", "center"),
      buttonBlock("Voir mon BAT mis à jour", "{{orderUrl}}"),
      spacerBlock(16),
    ])]),
    makeRow([makeColumn([dividerBlock(), footerBlock()])], INK),
  ]),
};
