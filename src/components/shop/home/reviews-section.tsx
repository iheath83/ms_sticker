"use client";

import { StarIcon } from "../icons";

const REVIEWS = [
  {
    initials: "LM",
    name: "Léa M.",
    role: "Brasserie La Croix-Rousse",
    text: "Qualité incroyable, les stickers tiennent super bien même sous la pluie. On recommande pour les pros !",
  },
  {
    initials: "JT",
    name: "Julien T.",
    role: "Créateur indépendant",
    text: "Le configurateur est ultra simple, épreuve reçue dans l'heure. Livraison en 48h pile, comme promis.",
  },
  {
    initials: "SK",
    name: "Sarah K.",
    role: "Agence Pixel & Co.",
    text: "Nos clients sont ravis. Les finitions holographiques rendent vraiment bien, et le prix au-dessus du volume baisse vite.",
  },
];

export function ReviewsSection() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {REVIEWS.map((r) => (
            <div
              key={r.name}
              style={{
                background: "var(--white)",
                border: "2px solid var(--ink)",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                padding: 28,
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translate(-3px, -3px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 0 var(--ink)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "";
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              <div
                style={{ display: "flex", gap: 2, color: "var(--red)", marginBottom: 16 }}
              >
                {Array.from({ length: 5 }, (_, j) => (
                  <StarIcon key={j} />
                ))}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0, marginBottom: 20 }}>
                &ldquo;{r.text}&rdquo;
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingTop: 16,
                  borderTop: "1px dashed var(--grey-200)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: "var(--blue)",
                    color: "var(--white)",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {r.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--grey-600)" }}>{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
