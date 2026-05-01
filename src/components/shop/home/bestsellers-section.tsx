"use client";

import Link from "next/link";
import type { Product } from "@/db/schema";

const CARD_COLORS = ["#EEF2FF", "#FFF4F0", "#F0FFF4"];

export function BestSellersSection({ products }: { products?: Product[] }) {
  const cards = (products ?? []).slice(0, 3);
  if (cards.length === 0) return null;

  return (
    <section style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>
            ◆ 02 / BEST-SELLERS
          </div>
          <h2 style={{ fontSize: 48, fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 800 }}>
            Les favoris du moment
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {cards.map((product, i) => {
            const bg = CARD_COLORS[i % CARD_COLORS.length] ?? CARD_COLORS[0]!;
            const desc = product.description
              ?.split("\n")
              .find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? "";

            return (
              <div
                key={product.id}
                style={{ background: "var(--white)", border: "2px solid var(--ink)", borderRadius: "var(--r-lg)", overflow: "hidden", transition: "transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translate(-3px, -3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 0 var(--ink)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
              >
                <div style={{ background: bg, padding: 32, position: "relative", borderBottom: "2px solid var(--ink)", height: 240, display: "grid", placeItems: "center" }}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <div style={{ fontSize: 72 }}>🏷️</div>
                  )}
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--grey-600)", marginTop: 4 }}>{product.tagline ?? desc}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 16 }}>
                    <Link
                      href={`/products/${product.slug}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 24px", background: "var(--blue)", color: "var(--white)", border: "2px solid var(--ink)", borderRadius: "var(--r)", fontFamily: "var(--font-archivo), monospace", fontWeight: 600, fontSize: 12, textDecoration: "none" }}
                    >
                      Configurer →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
