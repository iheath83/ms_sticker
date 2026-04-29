"use server";

import { db } from "@/db";
import { pages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Page } from "@/db/schema";
import type { PageSection } from "@/lib/page-sections";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") throw new Error("Non autorisé");
}

// ── Public reads ──────────────────────────────────────────────────────────────

export async function getPageBySlug(slug: string): Promise<(Page & { sections: PageSection[] }) | null> {
  try {
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    if (!page || !page.published) return null;
    return { ...page, sections: (page.sections as PageSection[]) ?? [] };
  } catch {
    return null;
  }
}

// ── Admin reads ───────────────────────────────────────────────────────────────

export async function getAllPagesAdmin(): Promise<Page[]> {
  await requireAdmin();
  return db.select().from(pages).orderBy(pages.title);
}

export async function getPageAdmin(id: string): Promise<(Page & { sections: PageSection[] }) | null> {
  await requireAdmin();
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) return null;
  return { ...page, sections: (page.sections as PageSection[]) ?? [] };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createPage(data: {
  slug: string;
  title: string;
  metaTitle?: string | undefined;
  metaDescription?: string | undefined;
}): Promise<Page> {
  await requireAdmin();
  const [page] = await db.insert(pages).values({
    slug: data.slug,
    title: data.title,
    metaTitle: data.metaTitle ?? null,
    metaDescription: data.metaDescription ?? null,
    sections: [],
  }).returning();
  if (!page) throw new Error("Erreur lors de la création");
  revalidatePath("/admin/pages");
  return page;
}

export async function updatePage(id: string, data: {
  title?: string | undefined;
  metaTitle?: string | null | undefined;
  metaDescription?: string | null | undefined;
  sections?: PageSection[] | undefined;
  published?: boolean | undefined;
}): Promise<void> {
  await requireAdmin();
  await db.update(pages).set({ ...data, updatedAt: new Date() }).where(eq(pages.id, id));
  revalidatePath("/admin/pages");
  revalidatePath("/admin/pages/" + id);
  const [slugRow] = await db.select({ slug: pages.slug }).from(pages).where(eq(pages.id, id)).limit(1);
  revalidatePath("/" + (slugRow?.slug ?? ""));
}

export async function getPagesForNavPicker(): Promise<{ slug: string; title: string }[]> {
  try {
    return db.select({ slug: pages.slug, title: pages.title }).from(pages).orderBy(pages.title);
  } catch {
    return [];
  }
}

export async function deletePage(id: string): Promise<void> {
  await requireAdmin();
  await db.delete(pages).where(eq(pages.id, id));
  revalidatePath("/admin/pages");
}

// ── Default page seeder ───────────────────────────────────────────────────────

export async function seedDefaultPages(): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  const existing = await db.select({ slug: pages.slug }).from(pages);
  const existingSlugs = new Set(existing.map((p) => p.slug));

  const toCreate: { slug: string; title: string; sections: PageSection[] }[] = [];

  if (!existingSlugs.has("devis-pro")) {
    toCreate.push({
      slug: "devis-pro",
      title: "Devis Pro",
      sections: [
        {
          id: "hero-devis",
          type: "hero",
          title: "Demande de devis personnalisé",
          subtitle: "Vous êtes une entreprise, une association ou un revendeur ? Obtenez un devis sur-mesure adapté à vos volumes.",
          ctaLabel: "Faire une demande",
          ctaHref: "#contact",
          bgColor: "ink",
        },
        {
          id: "features-devis",
          type: "features",
          title: "Pourquoi nous choisir ?",
          columns: 3,
          items: [
            { id: "f1", icon: "📦", title: "Grandes quantités", description: "Tarifs dégressifs à partir de 50 pièces" },
            { id: "f2", icon: "🎨", title: "Finitions pro", description: "Vernis, dorure, découpe complexe disponibles" },
            { id: "f3", icon: "🤝", title: "Accompagnement dédié", description: "Un interlocuteur unique pour votre projet" },
            { id: "f4", icon: "⚡", title: "Délais express", description: "Production rapide avec suivi en temps réel" },
            { id: "f5", icon: "✅", title: "Validation BAT", description: "Bon à tirer gratuit avant impression" },
            { id: "f6", icon: "🚚", title: "Livraison France & Europe", description: "Partout en France et en Europe" },
          ],
        },
        {
          id: "faq-devis",
          type: "faq",
          title: "Questions fréquentes",
          items: [
            { id: "q1", question: "Quel est le volume minimum pour un devis pro ?", answer: "Nous proposons des tarifs dégressifs à partir de 50 pièces. Pour des commandes inférieures, vous pouvez utiliser notre configurateur en ligne directement." },
            { id: "q2", question: "Quels formats de fichiers acceptez-vous ?", answer: "Nous acceptons les fichiers PDF, AI, EPS et SVG en haute résolution (300 dpi minimum). N'hésitez pas à nous contacter si vous avez un autre format." },
            { id: "q3", question: "Quel est le délai de réponse pour un devis ?", answer: "Nous nous engageons à vous répondre sous 24h ouvrées avec un devis détaillé." },
            { id: "q4", question: "Proposez-vous des échantillons ?", answer: "Oui, nous pouvons envoyer des échantillons de nos matériaux avant votre commande. Contactez-nous pour en faire la demande." },
          ],
        },
        {
          id: "contact-devis",
          type: "contact_form",
          title: "Demander un devis",
          subtitle: "Décrivez votre projet et nous vous répondons sous 24h",
        },
      ],
    });
  }

  if (!existingSlugs.has("faq")) {
    toCreate.push({
      slug: "faq",
      title: "FAQ — Questions fréquentes",
      sections: [
        {
          id: "hero-faq",
          type: "hero",
          title: "Centre d'aide",
          subtitle: "Toutes les réponses à vos questions sur nos stickers et notre service.",
          ctaLabel: "Nous contacter",
          ctaHref: "/devis-pro#contact",
          bgColor: "white",
        },
        {
          id: "faq-commande",
          type: "faq",
          title: "Commande & Paiement",
          items: [
            { id: "c1", question: "Comment passer une commande ?", answer: "Sélectionnez votre produit, configurez votre sticker (taille, quantité, fichier), ajoutez-le au panier et suivez les étapes de paiement sécurisé." },
            { id: "c2", question: "Quels modes de paiement acceptez-vous ?", answer: "Nous acceptons les cartes bancaires (Visa, Mastercard), Apple Pay, Google Pay et les virements bancaires pour les commandes pro." },
            { id: "c3", question: "Puis-je modifier ou annuler ma commande ?", answer: "Vous pouvez annuler votre commande dans les 2 heures suivant la validation. Passé ce délai, la production est lancée et l'annulation n'est plus possible." },
          ],
        },
        {
          id: "faq-fichier",
          type: "faq",
          title: "Fichiers & Impression",
          items: [
            { id: "f1", question: "Quelles sont les spécifications techniques de mes fichiers ?", answer: "Fichiers PDF, AI, EPS ou SVG vectoriels de préférence. Pour les images raster : 300 dpi minimum, format PNG ou TIFF. La zone de sécurité doit être de 3mm autour du format final." },
            { id: "f2", question: "Puis-je voir un aperçu avant impression ?", answer: "Oui, notre configurateur génère un aperçu en temps réel. Pour les commandes pro, un BAT (Bon À Tirer) gratuit est envoyé pour validation avant impression." },
            { id: "f3", question: "Les couleurs seront-elles exactement les mêmes que sur mon écran ?", answer: "Nous travaillons en CMJN pour une fidélité maximale. De légères variations peuvent exister selon les moniteurs. N'hésitez pas à demander un BAT physique pour les projets critiques." },
          ],
        },
        {
          id: "faq-livraison",
          type: "faq",
          title: "Livraison & Retours",
          items: [
            { id: "l1", question: "Quels sont les délais de livraison ?", answer: "La production prend 3 à 5 jours ouvrés. La livraison standard prend 2 à 3 jours supplémentaires. Une option express 24h est disponible." },
            { id: "l2", question: "Livrez-vous à l'international ?", answer: "Oui, nous livrons dans toute l'Europe. Les délais et tarifs varient selon la destination." },
            { id: "l3", question: "Que faire si ma commande est endommagée ?", answer: "Prenez des photos à la réception et contactez-nous dans les 48h. Nous procédons à un remplacement ou un remboursement intégral." },
          ],
        },
        {
          id: "cta-faq",
          type: "cta_banner",
          title: "Vous n'avez pas trouvé votre réponse ?",
          subtitle: "Notre équipe est disponible du lundi au vendredi de 9h à 18h",
          buttonLabel: "Nous contacter",
          buttonHref: "/devis-pro#contact",
          variant: "light",
        },
      ],
    });
  }

  if (!existingSlugs.has("contact")) {
    toCreate.push({
      slug: "contact",
      title: "Contact",
      sections: [
        {
          id: "hero-contact",
          type: "hero",
          title: "Contactez-nous",
          subtitle: "Une question, un projet, un devis ? Notre équipe vous répond sous 24h.",
          ctaLabel: "",
          ctaHref: "",
          bgColor: "ink",
        },
        {
          id: "features-contact",
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
          id: "form-contact",
          type: "contact_form",
          title: "Envoyez-nous un message",
          subtitle: "Remplissez le formulaire ci-dessous et nous reviendrons vers vous rapidement.",
        },
      ],
    });
  }

  if (toCreate.length === 0) return { ok: false, message: "Pages déjà créées" };

  for (const p of toCreate) {
    await db.insert(pages).values({ slug: p.slug, title: p.title, sections: p.sections });
  }

  revalidatePath("/admin/pages");
  return { ok: true };
}
