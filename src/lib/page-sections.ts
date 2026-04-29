// ── Section type definitions ──────────────────────────────────────────────────
// Each section has a unique `id` (uuid), a `type`, and type-specific fields.

export type HeroSection = {
  id: string;
  type: "hero";
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  bgColor: "ink" | "white" | "red";
};

export type RichTextSection = {
  id: string;
  type: "richtext";
  title: string;
  content: string;
  align: "left" | "center";
};

export type FaqSection = {
  id: string;
  type: "faq";
  title: string;
  items: { id: string; question: string; answer: string }[];
};

export type FeaturesSection = {
  id: string;
  type: "features";
  title: string;
  columns: 2 | 3 | 4;
  items: { id: string; icon: string; title: string; description: string }[];
};

export type CtaBannerSection = {
  id: string;
  type: "cta_banner";
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonHref: string;
  variant: "dark" | "light" | "red";
};

export type ContactFormSection = {
  id: string;
  type: "contact_form";
  title: string;
  subtitle: string;
};

export type SeparatorSection = {
  id: string;
  type: "separator";
  spacing: "sm" | "md" | "lg";
};

export type PageSection =
  | HeroSection
  | RichTextSection
  | FaqSection
  | FeaturesSection
  | CtaBannerSection
  | ContactFormSection
  | SeparatorSection;

// ── Section metadata (label, icon, defaults) ──────────────────────────────────

export const SECTION_TYPES: {
  type: PageSection["type"];
  label: string;
  icon: string;
  create: () => PageSection;
}[] = [
  {
    type: "hero",
    label: "Bannière héro",
    icon: "🖼️",
    create: () => ({
      id: crypto.randomUUID(),
      type: "hero",
      title: "Titre principal",
      subtitle: "Sous-titre accrocheur",
      ctaLabel: "Commencer",
      ctaHref: "/products",
      bgColor: "ink",
    }),
  },
  {
    type: "richtext",
    label: "Bloc texte",
    icon: "📝",
    create: () => ({
      id: crypto.randomUUID(),
      type: "richtext",
      title: "Mon titre",
      content: "Votre contenu ici...",
      align: "left",
    }),
  },
  {
    type: "faq",
    label: "FAQ / Accordéon",
    icon: "❓",
    create: () => ({
      id: crypto.randomUUID(),
      type: "faq",
      title: "Questions fréquentes",
      items: [
        { id: crypto.randomUUID(), question: "Comment commander ?", answer: "Réponse ici..." },
        { id: crypto.randomUUID(), question: "Quel délai de livraison ?", answer: "Réponse ici..." },
      ],
    }),
  },
  {
    type: "features",
    label: "Grille avantages",
    icon: "✨",
    create: () => ({
      id: crypto.randomUUID(),
      type: "features",
      title: "Nos avantages",
      columns: 3,
      items: [
        { id: crypto.randomUUID(), icon: "🎨", title: "Qualité premium", description: "Impression haute définition" },
        { id: crypto.randomUUID(), icon: "⚡", title: "Livraison rapide", description: "Expédié en 48h" },
        { id: crypto.randomUUID(), icon: "✂️", title: "Découpe précise", description: "Sur-mesure au mm" },
      ],
    }),
  },
  {
    type: "cta_banner",
    label: "Bannière CTA",
    icon: "🎯",
    create: () => ({
      id: crypto.randomUUID(),
      type: "cta_banner",
      title: "Prêt à commander ?",
      subtitle: "Créez votre sticker sur-mesure en quelques clics",
      buttonLabel: "Configurer mon sticker",
      buttonHref: "/custom-stickers",
      variant: "dark",
    }),
  },
  {
    type: "contact_form",
    label: "Formulaire de contact",
    icon: "📬",
    create: () => ({
      id: crypto.randomUUID(),
      type: "contact_form",
      title: "Contactez-nous",
      subtitle: "Notre équipe vous répond sous 24h",
    }),
  },
  {
    type: "separator",
    label: "Séparateur",
    icon: "➖",
    create: () => ({
      id: crypto.randomUUID(),
      type: "separator",
      spacing: "md",
    }),
  },
];
