import type { EmailBlock } from "@/lib/email-blocks";
import type { EmailTemplateType } from "@/db/schema";

// ─── Brand colors ─────────────────────────────────────────────────────────────
const ink = "#0A0E27";
const red = "#DC2626";
const white = "#FFFFFF";
const grey = "#E5E7EB";

// ─── Shared blocks ─────────────────────────────────────────────────────────────
const header: EmailBlock = { type: "header", bgColor: ink, textColor: white };
const divider: EmailBlock = { type: "divider", color: grey };
const spacerSm: EmailBlock = { type: "spacer", height: 16 };
const footer: EmailBlock = {
  type: "footer",
  legalText: "© {{year}} MS Adhésif — 123 rue de l'Imprimerie, 75001 Paris\nCet email est automatique, merci de ne pas y répondre directement.",
};

// ─── Templates ─────────────────────────────────────────────────────────────────

interface SeedTemplate {
  type: EmailTemplateType;
  name: string;
  subject: string;
  blocks: EmailBlock[];
}

export const DEFAULT_TEMPLATES: SeedTemplate[] = [
  {
    type: "order-received",
    name: "Commande reçue",
    subject: "✅ Commande #{{orderNumber}} confirmée — MS Adhésif",
    blocks: [
      header,
      {
        type: "hero",
        title: "Commande confirmée !",
        subtitle: "Merci {{customerName}}, nous avons bien reçu votre commande.",
        bgColor: "#F0FDF4",
        textColor: ink,
      },
      spacerSm,
      { type: "order_info", note: "Votre commande est en cours de préparation. Vous recevrez votre BAT très bientôt." },
      spacerSm,
      {
        type: "text",
        content: "Nous allons préparer votre maquette (BAT) et vous l'envoyer pour validation avant impression.\n\nVous pouvez suivre votre commande en cliquant ci-dessous.",
        align: "center",
      },
      { type: "button", label: "Suivre ma commande", url: "{{orderUrl}}", bgColor: red, textColor: white },
      spacerSm,
      divider,
      footer,
    ],
  },

  {
    type: "proof-ready",
    name: "BAT prêt",
    subject: "🎨 Votre BAT est prêt — Commande #{{orderNumber}}",
    blocks: [
      header,
      {
        type: "hero",
        title: "Votre BAT est prêt !",
        subtitle: "Votre maquette est disponible pour validation.",
        bgColor: "#EFF6FF",
        textColor: ink,
      },
      spacerSm,
      {
        type: "text",
        content: "Bonjour {{customerName}},\n\nNous avons préparé votre Bon À Tirer (BAT). Veuillez le consulter et nous indiquer si vous souhaitez aller en impression ou demander des modifications.\n\n⚠️ L'impression ne démarre qu'après votre validation.",
        align: "left",
      },
      { type: "button", label: "Voir et valider mon BAT", url: "{{orderUrl}}", bgColor: red, textColor: white },
      spacerSm,
      { type: "order_info", note: "" },
      spacerSm,
      divider,
      footer,
    ],
  },

  {
    type: "proof-revision-acknowledged",
    name: "Révision BAT reçue",
    subject: "🔄 Révision reçue — Commande #{{orderNumber}}",
    blocks: [
      header,
      {
        type: "hero",
        title: "Révision bien reçue",
        subtitle: "Nous avons pris en compte vos modifications.",
        bgColor: "#FFFBEB",
        textColor: ink,
      },
      spacerSm,
      {
        type: "text",
        content: "Bonjour {{customerName}},\n\nNous avons bien reçu votre demande de révision :",
        align: "left",
      },
      {
        type: "text",
        content: "« {{revisionMessage}} »",
        align: "center",
      },
      {
        type: "text",
        content: "Notre équipe va traiter votre demande dans les plus brefs délais et vous envoyer un nouveau BAT.",
        align: "left",
      },
      { type: "button", label: "Voir ma commande", url: "{{orderUrl}}", bgColor: ink, textColor: white },
      spacerSm,
      divider,
      footer,
    ],
  },

  {
    type: "payment-received",
    name: "Paiement confirmé",
    subject: "💳 Paiement reçu — Commande #{{orderNumber}}",
    blocks: [
      header,
      {
        type: "hero",
        title: "Paiement confirmé",
        subtitle: "Votre paiement a bien été enregistré.",
        bgColor: "#F0FDF4",
        textColor: ink,
      },
      spacerSm,
      { type: "order_info", note: "" },
      spacerSm,
      {
        type: "text",
        content: "Bonjour {{customerName}},\n\nVotre paiement a bien été traité. Une facture sera disponible dans votre espace client.",
        align: "left",
      },
      { type: "button", label: "Voir ma commande", url: "{{orderUrl}}", bgColor: red, textColor: white },
      spacerSm,
      divider,
      footer,
    ],
  },

  {
    type: "order-shipped",
    name: "Commande expédiée",
    subject: "📦 Votre commande #{{orderNumber}} est en route !",
    blocks: [
      header,
      {
        type: "hero",
        title: "C'est parti ! 📦",
        subtitle: "Votre commande a été expédiée.",
        bgColor: "#EEF2FF",
        textColor: ink,
      },
      spacerSm,
      { type: "order_info", note: "" },
      spacerSm,
      {
        type: "text",
        content: "Bonjour {{customerName}},\n\nVotre commande est en route ! Vous pouvez suivre votre colis avec le numéro de suivi ci-dessous.",
        align: "left",
      },
      { type: "button", label: "Suivre mon colis", url: "{{orderUrl}}", bgColor: red, textColor: white },
      spacerSm,
      divider,
      footer,
    ],
  },

  {
    type: "admin-new-order",
    name: "Nouvelle commande (admin)",
    subject: "🛒 Nouvelle commande #{{orderNumber}} — {{orderTotal}}",
    blocks: [
      { type: "header", bgColor: red, textColor: white },
      {
        type: "hero",
        title: "Nouvelle commande !",
        subtitle: "#{{orderNumber}} — {{orderTotal}}",
        bgColor: ink,
        textColor: white,
      },
      spacerSm,
      {
        type: "text",
        content: "Client : {{customerName}} ({{customerEmail}})",
        align: "left",
      },
      { type: "order_info", note: "" },
      spacerSm,
      { type: "button", label: "Voir dans le back-office", url: "{{orderUrl}}", bgColor: red, textColor: white },
      spacerSm,
      divider,
      footer,
    ],
  },

  {
    type: "bat-reply",
    name: "Réponse BAT (admin → client)",
    subject: "📩 Réponse à votre révision — Commande #{{orderNumber}}",
    blocks: [
      header,
      {
        type: "hero",
        title: "Réponse à votre révision",
        subtitle: "Commande #{{orderNumber}}",
        bgColor: "#F0F9FF",
        textColor: ink,
      },
      spacerSm,
      {
        type: "text",
        content: "Bonjour {{customerName}},\n\nNotre équipe a répondu à votre demande de révision :",
        align: "left",
      },
      {
        type: "text",
        content: "« {{replyMessage}} »",
        align: "center",
      },
      { type: "button", label: "Voir mon BAT mis à jour", url: "{{orderUrl}}", bgColor: red, textColor: white },
      spacerSm,
      divider,
      footer,
    ],
  },
];
