"use client";

import Link from "next/link";
import { StickerPreview, type StickerColor, type StickerMaterial, type StickerShape } from "../sticker-preview";
import { StarIcon } from "../icons";
import type { Product } from "@/db/schema";
import { materialToPreview, formatPriceCents } from "@/lib/product-utils";

// UI display metadata per material
const MATERIAL_UI: Record<
  string,
  { tag: string; rating: string; shape: StickerShape; color: StickerColor; rot: number; bg: string }
> = {
  vinyl:        { tag: "POPULAIRE", rating: "4.9", shape: "die-cut", color: "red",   rot: -6, bg: "#F0F4FF" },
  holographic:  { tag: "NOUVEAU",   rating: "5.0", shape: "die-cut", color: "white", rot: 4,  bg: "#FFF4F0" },
  transparent:  { tag: "PROMO",     rating: "4.8", shape: "circle",  color: "blue",  rot: 0,  bg: "#F4F0FF" },
  glitter:      { tag: "EXCLUSIF",  rating: "4.9", shape: "circle",  color: "red",   rot: 3,  bg: "#FFF8F0" },
  kraft:        { tag: "ÉCO",       rating: "4.7", shape: "square",  color: "blue",  rot: -3, bg: "#F5F0E8" },
};

const FALLBACK_UI = MATERIAL_UI["vinyl"]!;

interface BestsellerCard {
  id: string;
  name: string;
  desc: string;
  price: string;
  tag: string;
  rating: string;
  shape: StickerShape;
  color: StickerColor;
  rot: number;
  bg: string;
  material: StickerMaterial;
  slug?: string;
}

function productToCard(p: Product, index: number): BestsellerCard {
  const ui = MATERIAL_UI[p.material] ?? FALLBACK_UI;
  return {
    id: p.id,
    name: p.name,
    desc: p.description?.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? "",
    price: formatPriceCents(p.basePriceCents),
    tag: ui.tag,
    rating: ui.rating,
    shape: ui.shape,
    color: ui.color,
    rot: index % 2 === 0 ? ui.rot : -ui.rot,
    bg: ui.bg,
    material: materialToPreview(p.material),
    slug: p.slug,
  };
}

export function BestSellersSection({ products }: { products?: Product[] }) {
  const cards: BestsellerCard[] = (products && products.length > 0)
    ? products.slice(0, 3).map((p, i) => productToCard(p, i))
    : [];

  if (cards.length === 0) return null;

  return (
    <section style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--red)",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            ◆ 02 / BEST-SELLERS
          </div>
          <h2
            style={{
              fontSize: 48,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 800,
            }}
          >
            Les favoris du moment
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {cards.map((b) => (
            <div
              key={b.id}
              style={{
                background: "var(--white)",
                border: "2px solid var(--ink)",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
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
              {/* Sticker display area */}
              <div
                style={{
                  background: b.bg,
                  padding: 32,
                  position: "relative",
                  borderBottom: "2px solid var(--ink)",
                  height: 280,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {/* Tag chip */}
                <div style={{ position: "absolute", top: 16, left: 16 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      background: b.tag === "POPULAIRE" ? "var(--red)" : "var(--blue)",
                      color: "var(--white)",
                      borderRadius: 999,
                      padding: "6px 12px",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {b.tag}
                  </span>
                </div>

                {/* Rating */}
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    fontSize: 11,
                    fontWeight: 700,
                    background: "var(--white)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1.5px solid var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--ink)",
                  }}
                >
                  <StarIcon size={11} /> {b.rating}
                </div>

                <div style={{ width: 180, height: 180, transform: `rotate(${b.rot}deg)` }}>
                  <StickerPreview
                    shape={b.shape}
                    color={b.color}
                    label="MS"
                    material={b.material}
                  />
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: 20 }}>
                <div
                  style={{
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {b.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--grey-600)", marginTop: 4 }}>{b.desc}</div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.15em",
                        color: "var(--grey-400)",
                        textTransform: "uppercase",
                      }}
                    >
                      À partir de
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-archivo), system-ui, sans-serif",
                        fontSize: 22,
                        fontWeight: 800,
                      }}
                    >
                      {b.price} €
                    </div>
                  </div>
                  <Link
                    href={b.slug ? `/products/${b.slug}` : "/products"}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 24px",
                      background: "var(--blue)",
                      color: "var(--white)",
                      border: "2px solid var(--ink)",
                      borderRadius: "var(--r)",
                      fontFamily: "var(--font-archivo), monospace",
                      fontWeight: 600,
                      fontSize: 13,
                      textDecoration: "none",
                    }}
                  >
                    Configurer
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
