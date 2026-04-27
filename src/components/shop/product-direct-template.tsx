"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/components/shop/cart-context";
import type { ProductWithVariants, ProductVariant } from "@/lib/products";
import { materialToPreview } from "@/lib/product-utils";
import { StickerPreview } from "@/components/shop/sticker-preview";
import type { StickerMaterial, StickerShape } from "@/components/shop/sticker-preview";

const MATERIAL_LABELS: Record<string, string> = {
  vinyl: "Vinyle",
  holographic: "Holographique",
  glitter: "Pailleté",
  transparent: "Transparent",
  kraft: "Kraft",
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

interface Props {
  product: ProductWithVariants;
  variants: ProductVariant[];
}

export function ProductDirectTemplate({ product, variants }: Props) {
  const { addToCart } = useCart();
  const [isPending, startTransition] = useTransition();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    variants[0] ?? (product as unknown as ProductVariant),
  );
  const [quantity, setQuantity] = useState(selectedVariant?.minQty ?? 1);
  const [added, setAdded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const variant = selectedVariant;
  const images: string[] = [
    ...(variant.imageUrl ? [variant.imageUrl] : []),
    ...((variant.images as string[]) ?? []),
    ...((product.images as string[]) ?? []),
    ...(product.imageUrl ? [product.imageUrl] : []),
  ].filter(Boolean);

  // Price calculation (simplified — linear for direct products)
  const unitPriceCents = variant.basePriceCents;
  const totalCents = unitPriceCents * quantity;

  // Tiers
  const tiers = (variant.tiers as { minQty: number; discountPct: number }[] | null) ?? [];
  const applicableTier = [...tiers]
    .sort((a, b) => b.minQty - a.minQty)
    .find((t) => quantity >= t.minQty);
  const discountPct = applicableTier?.discountPct ?? 0;
  const discountedTotal = Math.round(totalCents * (1 - discountPct));

  function handleAddToCart() {
    if (isPending) return;
    setAdded(false);
    startTransition(async () => {
      await addToCart({
        productId: product.id,
        productName: product.name,
        quantity,
        widthMm: 50,
        heightMm: 50,
        shape: (variant.shapes?.[0] ?? "die-cut") as "die-cut" | "circle" | "square" | "rectangle",
        finish: variant.availableFinishes?.[0] ?? "gloss",
        material: variant.material,
        basePriceCents: variant.basePriceCents,
        options: {},
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    });
  }

  return (
    <div
      style={{
        background: "var(--cream)",
        minHeight: "100vh",
        paddingBottom: 80,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 32px 0" }}>
        <div style={{ fontSize: 12, color: "var(--grey-400)" }}>
          <a href="/products" style={{ color: "var(--grey-400)", textDecoration: "underline" }}>Produits</a>
          {" › "}
          {product.category && (
            <>
              <a href={`/products?category=${product.category.slug}`} style={{ color: "var(--grey-400)", textDecoration: "underline" }}>{product.category.name}</a>
              {" › "}
            </>
          )}
          <span>{product.name}</span>
        </div>
      </div>

      {/* Main layout */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 60,
          alignItems: "start",
        }}
      >
        {/* Left: gallery */}
        <div>
          {/* Main image */}
          <div
            style={{
              background: "#F0F4FF",
              borderRadius: 16,
              border: "2px solid var(--ink)",
              overflow: "hidden",
              aspectRatio: "1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            {images.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[galleryIndex] ?? images[0]!}
                alt={product.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <StickerPreview
                shape={(variant.shapes?.[0] ?? "die-cut") as StickerShape}
                color="blue"
                label="MS"
                material={materialToPreview(variant.material) as StickerMaterial}
              />
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {images.map((img, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={img}
                  alt={`${product.name} ${idx + 1}`}
                  onClick={() => setGalleryIndex(idx)}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: `2px solid ${galleryIndex === idx ? "var(--ink)" : "var(--grey-200)"}`,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: product info + purchase */}
        <div>
          {/* Badge */}
          <div style={{ marginBottom: 12 }}>
            <span style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: "#EFF6FF",
              color: "#1D4ED8",
              letterSpacing: "0.05em",
            }}>
              Impression directe
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            {product.name}
          </h1>

          {(product.tagline ?? product.description) && (
            <p style={{ fontSize: 16, color: "var(--grey-600)", lineHeight: 1.6, marginBottom: 24 }}>
              {product.tagline ?? product.description?.split("\n")[0]}
            </p>
          )}

          {/* Variant selector (if multiple) */}
          {variants.length > 1 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--grey-600)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Matière
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setSelectedVariant(v); setQuantity(v.minQty); }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: `2px solid ${v.id === variant.id ? "var(--ink)" : "var(--grey-200)"}`,
                      background: v.id === variant.id ? "var(--ink)" : "#fff",
                      color: v.id === variant.id ? "#fff" : "var(--grey-700)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {MATERIAL_LABELS[v.material] ?? v.material}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pricing tiers */}
          {tiers.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--grey-600)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Tarifs dégressifs</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {tiers.map((t) => (
                  <div
                    key={t.minQty}
                    onClick={() => setQuantity(t.minQty)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${quantity >= t.minQty ? "var(--red)" : "var(--grey-200)"}`,
                      background: quantity >= t.minQty ? "#FEF2F2" : "#fff",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: quantity >= t.minQty ? "var(--red)" : "var(--grey-400)" }}>
                      {t.minQty}+
                    </div>
                    {t.discountPct > 0 && (
                      <div style={{ fontSize: 10, color: "var(--red)", fontWeight: 700 }}>-{Math.round(t.discountPct * 100)}%</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + price */}
          <div
            style={{
              background: "var(--white)",
              border: "2px solid var(--ink)",
              borderRadius: 12,
              padding: "20px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--grey-400)", textTransform: "uppercase", marginBottom: 4 }}>Prix total</div>
                <div style={{ fontFamily: "var(--font-archivo)", fontSize: 36, fontWeight: 900 }}>
                  {euros(discountedTotal)}
                </div>
                {discountPct > 0 && (
                  <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 700 }}>
                    Économie : {euros(totalCents - discountedTotal)} (-{Math.round(discountPct * 100)}%)
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--grey-400)" }}>
                  {euros(Math.round(discountedTotal / quantity))} / unité
                </div>
              </div>

              {/* Qty stepper */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, border: "2px solid var(--ink)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(variant.minQty, quantity - 1))}
                  style={{ padding: "10px 16px", border: "none", background: "#F3F4F6", cursor: "pointer", fontSize: 18, fontWeight: 700 }}
                >
                  −
                </button>
                <div style={{ padding: "10px 16px", minWidth: 56, textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16 }}>
                  {quantity}
                </div>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  style={{ padding: "10px 16px", border: "none", background: "#F3F4F6", cursor: "pointer", fontSize: 18, fontWeight: 700 }}
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isPending}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 8,
                border: "none",
                background: added ? "#22C55E" : "var(--ink)",
                color: "#fff",
                fontFamily: "var(--font-mono), monospace",
                fontSize: 14,
                fontWeight: 700,
                cursor: isPending ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {isPending ? "Ajout…" : added ? "✓ Ajouté au panier" : "Ajouter au panier →"}
            </button>
          </div>

          {/* Features */}
          {product.features && product.features.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {product.features.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--grey-700)" }}>
                  <span style={{ color: "var(--red)", fontWeight: 900, flexShrink: 0, marginTop: 2 }}>◆</span>
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && product.description !== product.tagline && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ background: "var(--white)", border: "2px solid var(--ink)", borderRadius: 16, padding: "32px 40px" }}>
            <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 22, fontWeight: 900, marginBottom: 16 }}>Description</h2>
            <div style={{ fontSize: 15, color: "var(--grey-700)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {product.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
