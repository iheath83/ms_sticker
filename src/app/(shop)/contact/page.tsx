import { getPageBySlug } from "@/lib/pages-actions";
import { PageRenderer } from "@/components/shop/page-renderer";
import type { Metadata } from "next";
import type { PageSection } from "@/lib/page-sections";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("contact");
  return {
    title: page?.metaTitle ?? "Contact — MS Adhésif",
    description: page?.metaDescription ?? "Contactez l'équipe MS Adhésif pour toute question ou demande de devis.",
  };
}

// Fallback sections si la page CMS n'est pas encore créée
const FALLBACK_SECTIONS: PageSection[] = [
  {
    id: "hero",
    type: "hero",
    title: "Contactez-nous",
    subtitle: "Une question, un projet, un devis ? Notre équipe vous répond sous 24h.",
    ctaLabel: "",
    ctaHref: "",
    bgColor: "ink",
  },
  {
    id: "features",
    type: "features",
    title: "Comment nous joindre",
    columns: 3,
    items: [
      { id: "c1", icon: "📧", title: "Email", description: "hello@msadhesif.fr\nRéponse sous 24h ouvrées" },
      { id: "c2", icon: "📞", title: "Téléphone", description: "+33 1 00 00 00 00\nLun – Ven, 9h – 18h" },
      { id: "c3", icon: "📍", title: "Adresse", description: "Paris, France\nLivraison partout en Europe" },
    ],
  },
  {
    id: "form",
    type: "contact_form",
    title: "Envoyez-nous un message",
    subtitle: "Remplissez le formulaire ci-dessous et nous reviendrons vers vous rapidement.",
  },
];

export default async function ContactPage() {
  const page = await getPageBySlug("contact");
  return <PageRenderer sections={page?.sections ?? FALLBACK_SECTIONS} />;
}
