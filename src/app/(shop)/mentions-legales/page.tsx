import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — MS Adhésif",
};

export default function MentionsLegalesPage() {
  return (
    <main style={{ maxWidth: 800, margin: "60px auto", padding: "0 32px 80px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Mentions légales</h1>
      <p style={{ color: "#6B7280", marginBottom: 48 }}>Dernière mise à jour : avril 2026</p>

      <Section title="Éditeur du site">
        <p><strong>MS Adhésif</strong></p>
        <p>Chemin des plaines, 201 — 06370 Mouans-Sartoux, France</p>
        <p>Email : <a href="mailto:contact@msadhesif.fr">contact@msadhesif.fr</a></p>
        <p>Téléphone : +33 6 83 42 75 99</p>
        <p>SIRET : 940 859 689 00019</p>
        <p>N° TVA intracommunautaire : FR38940859689</p>
        <p>Directeur de la publication : Morgane Cocq</p>
      </Section>

      <Section title="Hébergement">
        <p>Le site est hébergé sur un serveur dédié (VPS) situé en France.</p>
        <p>Hébergeur : OVHcloud — 2 rue Kellermann, 59100 Roubaix, France.</p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des contenus présents sur ce site (textes, images, logos, graphismes)
          sont la propriété exclusive de MS Adhésif ou de leurs auteurs respectifs et sont
          protégés par les lois françaises et internationales relatives à la propriété
          intellectuelle. Toute reproduction, diffusion ou utilisation sans autorisation
          préalable écrite est strictement interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          MS Adhésif s&apos;efforce de maintenir les informations de ce site à jour et exactes.
          Toutefois, aucune garantie n&apos;est donnée quant à l&apos;exactitude, l&apos;exhaustivité
          ou la mise à jour des informations. MS Adhésif ne saurait être tenu responsable
          des dommages directs ou indirects résultant de l&apos;utilisation de ce site.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          Ce site utilise des cookies strictement nécessaires à son fonctionnement. Pour
          en savoir plus, consultez notre{" "}
          <a href="/politique-cookies" style={{ color: "#DC2626" }}>
            politique en matière de cookies
          </a>.
        </p>
      </Section>

      <Section title="Droit applicable">
        <p>
          Les présentes mentions légales sont soumises au droit français. En cas de litige,
          les tribunaux français seront seuls compétents.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #E5E7EB" }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "#374151" }}>{children}</div>
    </section>
  );
}
