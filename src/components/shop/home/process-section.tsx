import Link from "next/link";
import { ArrowIcon } from "../icons";

const STEPS = [
  { title: "Configurer", desc: "Forme, taille, finition et quantité en quelques clics." },
  { title: "Uploader", desc: "Déposez votre design. On vérifie avec vous." },
  { title: "Valider", desc: "On vous envoie une épreuve avant impression." },
  { title: "Recevoir", desc: "Expédition en 48h, livraison 2-3 jours." },
];

export function ProcessSection() {
  return (
    <section
      style={{
        background: "var(--red)",
        color: "var(--white)",
        padding: "80px 0",
        borderTop: "2px solid var(--ink)",
        borderBottom: "2px solid var(--ink)",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 700,
            marginBottom: 8,
            opacity: 0.8,
          }}
        >
          ◆ 03 / PROCESSUS
        </div>
        <h2
          style={{
            fontSize: 56,
            marginBottom: 48,
            maxWidth: 700,
            fontFamily: "var(--font-archivo), system-ui, sans-serif",
            fontWeight: 800,
          }}
        >
          Votre commande,{" "}
          <em style={{ fontStyle: "italic" }}>simple</em> comme un clic.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 2,
            background: "var(--white)",
            border: "2px solid var(--white)",
          }}
        >
          {STEPS.map((s, i) => (
            <div
              key={i}
              style={{ background: "var(--red)", padding: 32, position: "relative" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontSize: 72,
                  fontWeight: 900,
                  opacity: 0.2,
                  lineHeight: 1,
                }}
              >
                0{i + 1}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontSize: 22,
                  fontWeight: 800,
                  marginTop: 12,
                  marginBottom: 8,
                }}
              >
                {s.title}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, textAlign: "center" }}>
          <Link
            href="/custom-stickers"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "18px 28px",
              background: "var(--white)",
              color: "var(--ink)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--r)",
              fontFamily: "var(--font-archivo), monospace",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Démarrer ma commande <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
