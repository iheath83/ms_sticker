import { Logo } from "./logo";
import { ArrowIcon } from "./icons";

export function Footer() {
  return (
    <footer
      style={{
        background: "var(--ink)",
        color: "var(--grey-200)",
        padding: "60px 0 24px",
        marginTop: 80,
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            gap: 40,
          }}
        >
          {/* Brand */}
          <div>
            <Logo inverted />
            <p
              style={{
                fontSize: 13,
                marginTop: 16,
                maxWidth: 280,
                color: "var(--grey-400)",
                lineHeight: 1.5,
              }}
            >
              Imprimerie d&apos;autocollants sur-mesure. Vinyle pro, commandes dès 25 pièces,
              expédition sous 48h depuis Lyon.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              {["ISO 9001", "FSC", "FAIT EN FR"].map((badge) => (
                <div
                  key={badge}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid var(--grey-600)",
                    borderRadius: 4,
                    fontSize: 10,
                    letterSpacing: "0.15em",
                  }}
                >
                  {badge}
                </div>
              ))}
            </div>
          </div>

          {/* Produits */}
          <div>
            <h4
              style={{
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontFamily: "var(--font-archivo), monospace",
                color: "var(--white)",
                marginBottom: 16,
              }}
            >
              Produits
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {["Die Cut", "Ronds & carrés", "Holographiques", "Pailletés", "Transparents", "Magnets"].map(
                (item) => (
                  <li key={item} style={{ marginBottom: 10, fontSize: 13 }}>
                    <a href="#" style={{ color: "inherit" }}>
                      {item}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Infos */}
          <div>
            <h4
              style={{
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontFamily: "var(--font-archivo), monospace",
                color: "var(--white)",
                marginBottom: 16,
              }}
            >
              Infos
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {["Livraison", "Paiement", "Retours", "Blog"].map((item) => (
                <li key={item} style={{ marginBottom: 10, fontSize: 13 }}>
                  <a href="#" style={{ color: "inherit" }}>
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Aide */}
          <div>
            <h4
              style={{
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontFamily: "var(--font-archivo), monospace",
                color: "var(--white)",
                marginBottom: 16,
              }}
            >
              Aide
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {["Fichiers acceptés", "Nuancier", "Contact", "Devis gros volume"].map((item) => (
                <li key={item} style={{ marginBottom: 10, fontSize: 13 }}>
                  <a href="#" style={{ color: "inherit" }}>
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4
              style={{
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontFamily: "var(--font-archivo), monospace",
                color: "var(--white)",
                marginBottom: 16,
              }}
            >
              Newsletter
            </h4>
            <p style={{ fontSize: 12, color: "var(--grey-400)", marginBottom: 12 }}>
              −10% sur votre 1ère commande.
            </p>
            <div style={{ display: "flex" }}>
              <input
                type="email"
                placeholder="email@exemple.fr"
                style={{
                  flex: 1,
                  padding: 10,
                  fontSize: 12,
                  fontFamily: "var(--font-archivo), monospace",
                  background: "transparent",
                  color: "var(--white)",
                  border: "1px solid var(--grey-600)",
                  borderRadius: "6px 0 0 6px",
                  outline: "none",
                }}
              />
              <button
                style={{
                  background: "var(--red)",
                  color: "var(--white)",
                  border: "none",
                  padding: "0 12px",
                  borderRadius: "0 6px 6px 0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ArrowIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            marginTop: 40,
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--grey-400)",
            letterSpacing: "0.05em",
          }}
        >
          <span>© 2026 MS ADHÉSIF · TOUS DROITS RÉSERVÉS</span>
          <span>
            <a href="/mentions-legales" style={{ color: "inherit" }}>
              MENTIONS LÉGALES
            </a>{" "}
            ·{" "}
            <a href="/cgv" style={{ color: "inherit" }}>
              CGV
            </a>{" "}
            ·{" "}
            <a href="/politique-confidentialite" style={{ color: "inherit" }}>
              CONFIDENTIALITÉ
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
