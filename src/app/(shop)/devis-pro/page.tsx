import { getPageBySlug } from "@/lib/pages-actions";
import { PageRenderer } from "@/components/shop/page-renderer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug("devis-pro");
  return {
    title: page?.metaTitle ?? page?.title ?? "Devis Pro — MS Adhésif",
    description: page?.metaDescription ?? "Obtenez un devis personnalisé pour vos stickers en grandes quantités.",
  };
}

export default async function DevisProPage() {
  const page = await getPageBySlug("devis-pro");

  if (!page) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center", fontFamily: "var(--font-archivo)" }}>
        <h1 style={{ fontWeight: 900, fontSize: 32, color: "#0A0E27" }}>Page en cours de construction</h1>
        <p style={{ color: "#4B5563", marginTop: 12 }}>Revenez bientôt !</p>
      </div>
    );
  }

  return <PageRenderer sections={page.sections} />;
}
