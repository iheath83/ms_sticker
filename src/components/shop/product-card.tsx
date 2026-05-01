"use client";

import Link from "next/link";
import type { Product } from "@/db/schema";

interface ProductCardProps {
  product: Product;
  index: number;
}

const PRODUCT_COLORS = ["#EEF2FF", "#FFF0F5", "#F0FFF4", "#FFFBEB", "#EFF6FF"];

export function ProductCard({ product, index }: ProductCardProps) {
  const bg = PRODUCT_COLORS[index % PRODUCT_COLORS.length] ?? "#EEF2FF";

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
            background: bg,
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            borderBottom: "2px solid var(--ink)",
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ fontSize: 64 }}>🏷️</div>
          )}
          <div style={{ position: "absolute", top: 14, left: 14 }}>
            <span style={{
              background: "var(--blue)",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              {product.productFamily === "sticker" ? "Sticker personnalisé" : product.productFamily}
            </span>
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
          <h2 style={{
            fontSize: 22,
            fontFamily: "var(--font-archivo), system-ui, sans-serif",
            fontWeight: 800,
            letterSpacing: "-0.01em",
            marginBottom: 8,
          }}>
            {product.name}
          </h2>

          {(product.tagline ?? firstLine) && (
            <p style={{ fontSize: 13, color: "var(--grey-600)", lineHeight: 1.6, marginBottom: 20, flex: 1 }}>
              {product.tagline ?? firstLine}
            </p>
          )}

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: "auto",
            paddingTop: 16,
            borderTop: "1.5px solid var(--grey-100)",
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              background: "var(--blue)",
              color: "var(--white)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--r)",
              fontFamily: "var(--font-archivo), monospace",
              fontWeight: 600,
              fontSize: 12,
            }}>
              Configurer →
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
