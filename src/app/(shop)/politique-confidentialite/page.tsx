import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — MS Adhésif",
};

export default function PolitiqueConfidentialitePage() {
  return (
    <main style={{ maxWidth: 800, margin: "60px auto", padding: "0 32px 80px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
        Politique de confidentialité
      </h1>
      <p style={{ color: "#6B7280", marginBottom: 48 }}>Dernière mise à jour : avril 2026</p>

      <Section title="1. Responsable du traitement">
        <p>
          <strong>MS Adhésif</strong> — Chemin des plaines, 201 — 06370 Mouans-Sartoux<br />
          Email DPO : <a href="mailto:contact@msadhesif.fr" style={{ color: "#DC2626" }}>contact@msadhesif.fr</a>
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Lors de votre utilisation du site, nous collectons :</p>
        <ul style={{ paddingLeft: 24 }}>
          <li><strong>Données d&apos;identification :</strong> nom, prénom, email, téléphone</li>
          <li><strong>Données de commande :</strong> adresse de livraison/facturation, historique de commandes, fichiers transmis</li>
          <li><strong>Données de paiement :</strong> traitement sécurisé via Stripe — MS Adhésif ne stocke jamais vos coordonnées bancaires complètes</li>
          <li><strong>Données de navigation :</strong> adresse IP, logs de connexion (durée de conservation : 12 mois)</li>
        </ul>
      </Section>

      <Section title="3. Finalités et bases légales">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              <th style={{ border: "1px solid #E5E7EB", padding: "8px 12px", textAlign: "left" }}>Finalité</th>
              <th style={{ border: "1px solid #E5E7EB", padding: "8px 12px", textAlign: "left" }}>Base légale</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Exécution de la commande (BAT, production, livraison)", "Exécution du contrat"],
              ["Facturation et obligations comptables (10 ans)", "Obligation légale"],
              ["Gestion du compte client", "Exécution du contrat"],
              ["Envoi d'emails transactionnels (confirmation, BAT, expédition)", "Exécution du contrat"],
              ["Newsletter (opt-in)", "Consentement"],
              ["Lutte contre la fraude", "Intérêt légitime"],
            ].map(([f, b]) => (
              <tr key={f}>
                <td style={{ border: "1px solid #E5E7EB", padding: "8px 12px" }}>{f}</td>
                <td style={{ border: "1px solid #E5E7EB", padding: "8px 12px" }}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="4. Destinataires des données">
        <p>Vos données peuvent être transmises aux prestataires suivants :</p>
        <ul style={{ paddingLeft: 24 }}>
          <li><strong>Stripe</strong> — traitement des paiements (UE + USA, Privacy Shield)</li>
          <li><strong>Pennylane</strong> — facturation électronique (France)</li>
          <li><strong>Brevo</strong> — envoi d&apos;emails transactionnels (UE)</li>
          <li><strong>SendCloud</strong> — logistique et expédition (Pays-Bas)</li>
          <li><strong>OVHcloud</strong> — hébergement (France)</li>
        </ul>
        <p>Aucune donnée n&apos;est vendue à des tiers.</p>
      </Section>

      <Section title="5. Durées de conservation">
        <ul style={{ paddingLeft: 24 }}>
          <li>Données de compte : durée de vie du compte + 3 ans après dernière activité</li>
          <li>Données de commande et factures : 10 ans (obligation comptable)</li>
          <li>Fichiers transmis (logos) : 1 an après la commande</li>
          <li>Logs de connexion : 12 mois</li>
        </ul>
      </Section>

      <Section title="6. Vos droits (RGPD)">
        <p>Conformément au RGPD (Règlement UE 2016/679) et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
        <ul style={{ paddingLeft: 24 }}>
          <li><strong>Droit d&apos;accès</strong> — obtenir une copie de vos données</li>
          <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
          <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de votre compte</li>
          <li><strong>Droit à la portabilité</strong> — exporter vos données en JSON</li>
          <li><strong>Droit d&apos;opposition</strong> — vous opposer au traitement pour intérêt légitime</li>
          <li><strong>Droit de retrait du consentement</strong> — à tout moment pour la newsletter</li>
        </ul>
        <p>
          Pour exercer ces droits, rendez-vous dans votre{" "}
          <a href="/account/profile" style={{ color: "#DC2626" }}>espace compte</a> ou
          écrivez à <a href="mailto:contact@msadhesif.fr" style={{ color: "#DC2626" }}>contact@msadhesif.fr</a>.
          Réponse sous 30 jours.
        </p>
        <p>
          En cas de non-réponse satisfaisante, vous pouvez saisir la{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#DC2626" }}>
            CNIL
          </a>.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          Voir notre{" "}
          <a href="/politique-cookies" style={{ color: "#DC2626" }}>
            politique en matière de cookies
          </a>.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Vos données sont transmises via HTTPS (TLS 1.3). Les mots de passe sont stockés
          hashés avec bcrypt (rounds=12). Les clés API et secrets ne sont jamais exposés côté client.
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
