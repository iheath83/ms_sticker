import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique en matière de cookies — MS Adhésif",
};

export default function PolitiqueCookiesPage() {
  return (
    <main style={{ maxWidth: 800, margin: "60px auto", padding: "0 32px 80px" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
        Politique en matière de cookies
      </h1>
      <p style={{ color: "#6B7280", marginBottom: 48 }}>Dernière mise à jour : avril 2026</p>

      <Section title="Qu'est-ce qu'un cookie ?">
        <p>
          Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur,
          tablette, mobile) lors de votre navigation sur un site web. Il permet au site
          de mémoriser des informations sur votre visite.
        </p>
      </Section>

      <Section title="Cookies que nous utilisons">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              <th style={{ border: "1px solid #E5E7EB", padding: "8px 12px", textAlign: "left" }}>Nom</th>
              <th style={{ border: "1px solid #E5E7EB", padding: "8px 12px", textAlign: "left" }}>Finalité</th>
              <th style={{ border: "1px solid #E5E7EB", padding: "8px 12px", textAlign: "left" }}>Durée</th>
              <th style={{ border: "1px solid #E5E7EB", padding: "8px 12px", textAlign: "left" }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["better-auth.session_token", "Authentification — maintient votre session connectée", "Session", "Essentiel"],
              ["ms_draft_order", "Panier — identifiant de votre commande en cours", "7 jours", "Essentiel"],
              ["ms_cookie_consent", "Mémorise votre choix de consentement cookies", "12 mois", "Essentiel"],
              ["_ga, _gid", "Analytics Google (opt-in uniquement)", "2 ans / 24h", "Analytics"],
            ].map(([name, purpose, duration, type]) => (
              <tr key={name}>
                <td style={{ border: "1px solid #E5E7EB", padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>{name}</td>
                <td style={{ border: "1px solid #E5E7EB", padding: "8px 12px" }}>{purpose}</td>
                <td style={{ border: "1px solid #E5E7EB", padding: "8px 12px" }}>{duration}</td>
                <td style={{ border: "1px solid #E5E7EB", padding: "8px 12px" }}>
                  <span style={{
                    background: type === "Essentiel" ? "#DCFCE7" : "#FEF9C3",
                    color: type === "Essentiel" ? "#166534" : "#854D0E",
                    padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600
                  }}>
                    {type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Cookies essentiels">
        <p>
          Les cookies essentiels sont indispensables au fonctionnement du site
          (authentification, panier). Ils ne peuvent pas être désactivés. Aucun
          consentement n&apos;est requis pour ces cookies (base légale : intérêt légitime).
        </p>
      </Section>

      <Section title="Cookies analytics (opt-in)">
        <p>
          Les cookies analytics (ex. Google Analytics) ne sont déposés qu&apos;avec votre
          consentement explicite. Vous pouvez modifier votre choix à tout moment via
          le bouton ci-dessous ou depuis le bandeau affiché en bas de page.
        </p>
        <p style={{ marginTop: 16 }}>
          <button
            id="open-cookie-settings"
            style={{
              background: "#DC2626", color: "#fff", border: "none",
              padding: "10px 24px", borderRadius: 6, fontSize: 14,
              fontWeight: 700, cursor: "pointer"
            }}
          >
            Gérer mes préférences cookies
          </button>
        </p>
      </Section>

      <Section title="Comment refuser les cookies ?">
        <p>
          Vous pouvez configurer votre navigateur pour refuser tout ou partie des cookies.
          Attention : désactiver certains cookies peut dégrader l&apos;expérience du site.
        </p>
        <ul style={{ paddingLeft: 24 }}>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: "#DC2626" }}>Chrome</a></li>
          <li><a href="https://support.mozilla.org/fr/kb/cookies-informations-sites-enregistrent" target="_blank" rel="noopener noreferrer" style={{ color: "#DC2626" }}>Firefox</a></li>
          <li><a href="https://support.apple.com/fr-fr/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: "#DC2626" }}>Safari</a></li>
        </ul>
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
