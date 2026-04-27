"use client";

import Link from "next/link";
import { StickerPreview } from "./sticker-preview";
import type { StickerColor, StickerMaterial, StickerShape } from "./sticker-preview";
import { formatPriceCents } from "@/lib/product-utils";
import type { Product } from "@/db/schema";

const MATERIAL_META: Record<string, { badge: string; bg: string; tagColor: string }> = {
  vinyl:        { badge: "Le plus populaire", bg: "#F0F4FF", tagColor: "var(--blue)" },
  holographic:  { badge: "Effet premium",     bg: "#FFF4F0", tagColor: "var(--red)" },
  transparent:  { badge: "No-label look",     bg: "#F4F0FF", tagColor: "var(--blue)" },
  glitter:      { badge: "Édition festive",   bg: "#FFF8F0", tagColor: "var(--red)" },
  kraft:        { badge: "Éco-responsable",   bg: "#F5F0E8", tagColor: "var(--blue)" },
};

const SHAPE_LABELS: Record<string, string> = {
  "die-cut":   "Die Cut",
  "circle":    "Rond",
  "square":    "Carré",
  "rectangle": "Rectangle",
};

const PREVIEW_COLORS: StickerColor[] = ["red", "blue", "white"];

interface ProductCardProps {
  product: Product;
  index: number;
}

export function ProductCard({ product, index }: ProductCardProps) {
  const meta = MATERIAL_META[product.material] ?? MATERIAL_META["vinyl"]!;
  const shapes = (product.shapes ?? ["die-cut"]) as StickerShape[];
  const previewShape: StickerShape = shapes[0] ?? "die-cut";
  const previewMaterial = product.material as StickerMaterial;
  const previewColor: StickerColor = PREVIEW_COLORS[index % PREVIEW_COLORS.length] ?? "red";
  const secondShape: StickerShape | undefined = shapes[1];

  const firstLine = product.description
    ?.split("\n")
    .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith("**"))
    ?.trim();

  return (
    <Link href={`/products/${product.slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", height: "100%" }}>
      <article
        style={{
          background: "var(--white)",
          border: "2px solid var(--ink)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
          transition: "transform 0.15s, box-shadow 0.15s",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          width: "100%",
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
        {/* Visual area */}
        <div
          style={{
            background: meta.bg,
            height: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderBottom: "2px solid var(--ink)",
          }}
        >
          {/* Badge */}
          <div style={{ position: "absolute", top: 16, left: 16 }}>
            <span
              style={{
                background: meta.tagColor,
                color: "var(--white)",
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {meta.badge}
            </span>
          </div>

          {/* Sticker previews */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 130,
                height: 130,
                transform: "rotate(-6deg)",
              }}
            >
              <StickerPreview
                shape={previewShape}
                color={previewColor}
                label="MS"
                material={previewMaterial}
              />
            </div>
            {secondShape && (
              <div
                style={{
                  width: 90,
                  height: 90,
                  transform: "rotate(5deg)",
                  opacity: 0.7,
                }}
              >
                <StickerPreview
                  shape={secondShape}
                  color={previewColor}
                  label="MS"
                  material={previewMaterial}
                />
              </div>
            )}
          </div>

          {/* Shape chips */}
          <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {shapes.map((s) => (
              <span
                key={s}
                style={{
                  background: "var(--white)",
                  border: "1.5px solid var(--ink)",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 9,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono), monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {SHAPE_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
          <h2
            style={{
              fontSize: 22,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            {product.name}
          </h2>

          {firstLine && (
            <p
              style={{
                fontSize: 13,
                color: "var(--grey-600)",
                lineHeight: 1.6,
                marginBottom: 20,
                flex: 1,
              }}
            >
              {firstLine}
            </p>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
              paddingTop: 16,
              borderTop: "1.5px solid var(--grey-100)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "var(--grey-400)",
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                À partir de
              </div>
              <div
                style={{
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                {formatPriceCents(product.basePriceCents)} €
              </div>
              <div style={{ fontSize: 10, color: "var(--grey-400)" }}>pour 50 stickers 5×5 cm</div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                background: "var(--blue)",
                color: "var(--white)",
                border: "2px solid var(--ink)",
                borderRadius: "var(--r)",
                fontFamily: "var(--font-mono), monospace",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Configurer →
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
