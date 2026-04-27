import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — MS Adhésif",
};

export default function CgvPage() {
  return (
    <main style={{ maxWidth: 800, margin: "60px auto", padding: "0 32px 80px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
        Conditions Générales de Vente
      </h1>
      <p style={{ color: "#6B7280", marginBottom: 48 }}>Dernière mise à jour : avril 2026</p>

      <Section title="1. Préambule">
        <p>
          Les présentes Conditions Générales de Vente (CGV) régissent les relations
          contractuelles entre MS Adhésif (ci-après « le Vendeur ») et tout client
          (ci-après « le Client ») passant commande sur le site msadhesif.fr.
        </p>
        <p>
          Toute commande implique l&apos;acceptation pleine et entière des présentes CGV.
          Le Vendeur se réserve le droit de modifier ses CGV à tout moment ; les CGV
          applicables sont celles en vigueur au moment de la commande.
        </p>
      </Section>

      <Section title="2. Produits">
        <p>
          MS Adhésif propose des autocollants et adhésifs personnalisés sur mesure (die-cut,
          kiss-cut, ronds, carrés, holographiques, pailletés, transparents, etc.).
          Les caractéristiques essentielles des produits sont présentées sur le site.
          Les visuels sont donnés à titre indicatif.
        </p>
        <p>
          La commande minimum est de 25 pièces par référence, sauf mention contraire.
        </p>
      </Section>

      <Section title="3. Prix">
        <p>
          Les prix sont affichés en euros TTC (TVA 20% incluse) pour les commandes en France
          métropolitaine. Pour les professionnels européens disposant d&apos;un numéro TVA
          valide, la TVA peut être exonérée par autoliquidation conformément à l&apos;article
          283-2 du CGI.
        </p>
        <p>
          Les frais de livraison sont calculés et affichés lors de la commande. La livraison
          est offerte pour toute commande supérieure à 50 € HT.
        </p>
        <p>
          MS Adhésif se réserve le droit de modifier ses prix à tout moment. Les commandes
          sont facturées aux prix en vigueur au moment de la validation.
        </p>
      </Section>

      <Section title="4. Workflow BAT (Bon À Tirer)">
        <p>
          <strong>4.1 Upload du fichier client.</strong> Le Client transmet son fichier
          (PNG, JPG, SVG, PDF, AI — max. 50 Mo) lors de la commande. Il garantit disposer
          de tous les droits nécessaires sur ce fichier.
        </p>
        <p>
          <strong>4.2 Préparation du BAT.</strong> Dans un délai de 24 heures ouvrées,
          MS Adhésif prépare un Bon À Tirer et le transmet au Client par email.
        </p>
        <p>
          <strong>4.3 Validation.</strong> Le Client dispose de 72 heures pour approuver
          le BAT ou demander des corrections. Sans réponse sous 72h, le BAT est réputé
          approuvé. La validation du BAT déclenche le paiement.
        </p>
        <p>
          <strong>4.4 Production.</strong> Le lancement en production n&apos;intervient
          qu&apos;après paiement confirmé. Aucune modification n&apos;est possible après
          validation du BAT.
        </p>
      </Section>

      <Section title="5. Commande et paiement">
        <p>
          Le paiement s&apos;effectue en ligne par carte bancaire (Visa, Mastercard,
          American Express) ou par virement SEPA via notre prestataire Stripe.
          Le paiement est sécurisé (TLS + 3D Secure).
        </p>
        <p>
          La commande est définitive après réception du paiement. Une facture est émise
          automatiquement et transmise par email.
        </p>
      </Section>

      <Section title="6. Délais de livraison">
        <p>
          <strong>Standard :</strong> 5 à 7 jours ouvrés après validation BAT + paiement.
          <br />
          <strong>Express :</strong> 2 à 3 jours ouvrés.
        </p>
        <p>
          Ces délais sont indicatifs et peuvent varier en cas de force majeure, de volume
          de commandes exceptionnel ou de jours fériés.
        </p>
      </Section>

      <Section title="7. Droit de rétractation">
        <p>
          Conformément à l&apos;article L221-28 du Code de la Consommation, le droit de
          rétractation ne peut être exercé pour les biens confectionnés selon les
          spécifications du consommateur (produits personnalisés). Une fois le BAT validé
          et le paiement effectué, la commande ne peut être ni annulée ni remboursée,
          sauf défaut avéré d&apos;impression imputable à MS Adhésif.
        </p>
      </Section>

      <Section title="8. Réclamations et garanties">
        <p>
          En cas de défaut constaté (erreur d&apos;impression, défaut de découpe non lié
          au fichier fourni), le Client dispose de 14 jours à compter de la réception
          pour adresser une réclamation à <a href="mailto:contact@msadhesif.fr" style={{ color: "#DC2626" }}>contact@msadhesif.fr</a> avec photos à l&apos;appui.
          MS Adhésif s&apos;engage à réimprimer ou rembourser selon le cas.
        </p>
        <p>
          MS Adhésif n&apos;est pas responsable des défauts liés à la qualité du fichier
          transmis par le Client (basse résolution, couleurs non conformes au profil ICC
          demandé, etc.).
        </p>
      </Section>

      <Section title="9. Responsabilité du Client sur les fichiers">
        <p>
          Le Client garantit être titulaire ou disposer des droits nécessaires sur
          les visuels transmis. MS Adhésif ne saurait être tenu responsable en cas
          de contrefaçon ou d&apos;atteinte aux droits d&apos;un tiers.
        </p>
      </Section>

      <Section title="10. Données personnelles">
        <p>
          Les données collectées lors de la commande sont traitées conformément à notre{" "}
          <a href="/politique-confidentialite" style={{ color: "#DC2626" }}>
            politique de confidentialité
          </a>.
        </p>
      </Section>

      <Section title="11. Droit applicable et juridiction compétente">
        <p>
          Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut
          de règlement amiable, les tribunaux du ressort de Nice seront seuls compétents.
        </p>
        <p>
          Pour tout litige de consommation, vous pouvez saisir le médiateur de la
          consommation : <a href="https://www.mediateur-conso.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#DC2626" }}>www.mediateur-conso.fr</a>
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
