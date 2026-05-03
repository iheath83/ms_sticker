"use client";

import { useReducer, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart, prepareFileUpload, confirmFileUpload } from "@/lib/cart-actions";
import { StickerEditor, type StickerEditorHandle } from "@/components/sticker-editor/StickerEditor";
import type { EditorValidationOutput } from "@/lib/sticker-editor/editor.types";
// Note: file upload goes through /api/uploads/direct (same-origin proxy → MinIO)
import { configuratorReducer, createInitialState } from "./configurator.reducer";
import type {
  StickerShape, StickerSize, StickerMaterial, StickerLamination,
  ProductStickerConfig, UploadedFile,
} from "./configurator.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function eur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
function eurUnit(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Badge({ label, color = "blue" }: { label: string; color?: "blue" | "green" | "red" | "amber" }) {
  const colors: Record<string, React.CSSProperties> = {
    blue:  { background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" },
    green: { background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" },
    red:   { background: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3" },
    amber: { background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" },
  };
  return (
    <span style={{
      ...colors[color],
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
      textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function StepCard({
  number, title, summary, children, warning,
}: {
  number: string;
  title: string;
      summary?: string | undefined;
  children: React.ReactNode;
  warning?: string | undefined;
}) {
  return (
    <section style={{
      background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16,
      padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: "50%", background: "#0A0E27",
            color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0,
          }}>{number}</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0A0E27" }}>{title}</h2>
        </div>
        {summary && (
          <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500, flexShrink: 0 }}>→ {summary}</span>
        )}
      </div>
      {children}
      {warning && (
        <p style={{
          margin: 0, fontSize: 12, color: "#B45309", background: "#FFFBEB",
          padding: "8px 12px", borderRadius: 8, border: "1px solid #FDE68A",
        }}>
          ⚠️ {warning}
        </p>
      )}
    </section>
  );
}

// Variante compacte de StepCard utilisée dans la sidebar de l'éditeur intégré.
// Pas de numéro d'étape, padding réduit, utile dans une colonne sticky étroite.
function SidebarSection({
  title, summary, children, warning, complete,
}: {
  title: string;
  summary?: string | undefined;
  children: React.ReactNode;
  warning?: string | undefined;
  complete?: boolean | undefined;
}) {
  return (
    <section style={{
      background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0A0E27", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
          {complete && <span style={{ color: "#10B981", fontSize: 13 }}>✓</span>}
          {title}
        </h3>
        {summary && (
          <span style={{ fontSize: 12, color: "#374151", fontWeight: 600, textAlign: "right" }}>
            {summary}
          </span>
        )}
      </div>
      {children}
      {warning && (
        <p style={{
          margin: 0, fontSize: 11, color: "#B45309", background: "#FFFBEB",
          padding: "6px 10px", borderRadius: 6, border: "1px solid #FDE68A",
        }}>
          ⚠️ {warning}
        </p>
      )}
    </section>
  );
}

// ─── TrustBar ────────────────────────────────────────────────────────────────
// Bande horizontale d'arguments commerciaux placée juste sous le hero.
// Améliore la conversion en montrant les rassurances clés AVANT que
// l'utilisateur n'arrive au prix (impression de France, délais, qualité).
function TrustBar() {
  const items = [
    { icon: "🇫🇷", label: "Imprimé en France", sub: "À Bordeaux" },
    { icon: "⚡", label: "Production sous 48h", sub: "Délai garanti" },
    { icon: "✅", label: "Vérification fichier", sub: "Par notre équipe" },
    { icon: "🚚", label: "Livraison offerte", sub: "Dès 50 €" },
    { icon: "🔒", label: "Paiement sécurisé", sub: "CB · Apple Pay · PayPal" },
  ];
  return (
    <div style={{
      maxWidth: 1320, margin: "16px auto 0", padding: "0 24px",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 14,
        padding: "14px 18px",
      }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }} aria-hidden>{it.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0A0E27", lineHeight: 1.2 }}>
                {it.label}
              </div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                {it.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EditorPriceCard ─────────────────────────────────────────────────────────
// Carte prix + CTA compacte affichée EN HAUT de la sidebar de l'éditeur intégré.
// Le but CRO est que le prix et le bouton « Ajouter au panier » soient toujours
// visibles above-the-fold, et que les changements de configuration produisent
// un feedback prix instantané juste à droite du canvas.
function EditorPriceCard({
  priceResult, priceLoading, currentQty, widthMm, heightMm,
  onAddToCart, addState, hasFile, fileWarning,
  nextTier, onUpsell,
}: {
  priceResult: ReturnType<typeof configuratorReducer>["priceResult"];
  priceLoading: boolean;
  currentQty: number;
  widthMm: number;
  heightMm: number;
  onAddToCart: () => void;
  addState: string;
  hasFile: boolean;
  fileWarning: string | null;
  nextTier: { minQty: number; discountPct: number } | null;
  onUpsell: (qty: number) => void;
}) {
  const canOrder = !!priceResult && !priceLoading;
  return (
    <div style={{
      background: "#0A0E27", color: "#fff", borderRadius: 16,
      padding: "20px 22px", boxShadow: "0 4px 24px rgba(10,14,39,0.18)",
    }}>
      {/* Quantité + dimensions résumés (micro-info) */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 11, opacity: 0.6, marginBottom: 14,
        textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700,
      }}>
        <span>{currentQty} pcs · {widthMm}×{heightMm} mm</span>
        <span style={{
          padding: "2px 8px", borderRadius: 8,
          background: priceLoading ? "rgba(255,255,255,0.15)" : "rgba(34,197,94,0.18)",
          color: priceLoading ? "#9CA3AF" : "#86EFAC",
        }}>
          {priceLoading ? "Calcul…" : "Live"}
        </span>
      </div>

      {/* Prix */}
      {priceResult ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1 }} aria-live="polite">
            {eur(priceResult.totalCents)}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4, fontWeight: 600 }}>
            soit {eurUnit(priceResult.unitPriceCents)} / sticker
          </div>
          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
            TVA 20% incluse
          </div>
          {priceResult.quantityDiscountPct > 0 && (
            <span style={{
              display: "inline-block", marginTop: 8,
              fontSize: 11, fontWeight: 800,
              padding: "3px 10px", borderRadius: 8,
              background: "rgba(34,197,94,0.2)", color: "#86EFAC",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              ✓ -{priceResult.quantityDiscountPct}% remise volume
            </span>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 32, fontWeight: 900, opacity: 0.3 }}>— €</div>
          <div style={{ fontSize: 12, opacity: 0.4, marginTop: 4 }}>Choisissez vos options</div>
        </div>
      )}

      {/* CTA principal */}
      <button
        type="button"
        onClick={onAddToCart}
        disabled={!canOrder || addState === "loading"}
        style={{
          width: "100%", padding: "16px 20px", borderRadius: 12, border: "none",
          background: addState === "success" ? "#059669" : canOrder ? "#FF385C" : "#374151",
          color: "#fff", fontWeight: 900, fontSize: 16,
          cursor: canOrder ? "pointer" : "not-allowed",
          opacity: !canOrder && addState !== "loading" ? 0.5 : 1,
          transition: "all 0.2s", letterSpacing: "0.01em",
          boxShadow: canOrder ? "0 4px 16px rgba(255,56,92,0.35)" : "none",
        }}
      >
        {addState === "loading" ? "Ajout en cours…" :
         addState === "success" ? "✓ Ajouté au panier !" :
         "Ajouter au panier →"}
      </button>

      {/* Avertissement fichier — couleur ambrée pas alarmiste */}
      {!hasFile && (
        <p style={{
          margin: "10px 0 0", fontSize: 11, color: "#FCD34D", textAlign: "center",
          lineHeight: 1.4,
        }}>
          📎 Importez votre visuel dans l'éditeur pour finaliser
        </p>
      )}
      {fileWarning && (
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "#FCA5A5", textAlign: "center" }}>
          {fileWarning}
        </p>
      )}

      {/* Upsell tier suivant — incite à augmenter la quantité */}
      {nextTier && priceResult && (
        <button
          type="button"
          onClick={() => onUpsell(nextTier.minQty)}
          style={{
            marginTop: 12, width: "100%", padding: "9px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            textAlign: "left",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          }}
        >
          <span>
            💡 Passez à <strong>{nextTier.minQty}</strong> et économisez <strong>{nextTier.discountPct}%</strong>
          </span>
          <span style={{ opacity: 0.6 }}>→</span>
        </button>
      )}

      {/* Trust mini en bas du card prix */}
      <div style={{
        marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px",
      }}>
        {[
          "BAT offert",
          "Vérif. fichier",
          "Production 48h",
          "Paiement sécurisé",
        ].map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.7 }}>
            <span style={{ color: "#34D399" }}>✓</span>
            <span>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OptionCard({
  active, label, sublabel, badge, disabled, onClick,
}: {
  active: boolean;
  label: string;
  sublabel?: string | undefined;
  badge?: string | undefined;
  disabled?: boolean | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        padding: "14px 18px",
        borderRadius: 12,
        border: `2.5px solid ${active ? "#0A0E27" : disabled ? "#E5E7EB" : "#E5E7EB"}`,
        background: active ? "#0A0E27" : disabled ? "#F9FAFB" : "#fff",
        color: active ? "#fff" : disabled ? "#9CA3AF" : "#374151",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        minWidth: 110,
        opacity: disabled ? 0.55 : 1,
        transition: "all 0.15s",
        boxShadow: active ? "0 2px 12px rgba(10,14,39,0.18)" : "none",
      }}
    >
      {badge && (
        <span style={{
          position: "absolute", top: -9, left: 12,
          background: badge === "Premium" ? "#6D28D9" : badge === "Recommandé" ? "#059669" : "#0A0E27",
          color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 8px",
          borderRadius: 10, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          {badge}
        </span>
      )}
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 11, opacity: active ? 0.75 : 0.6, marginTop: 3, lineHeight: 1.3 }}>
          {sublabel}
        </div>
      )}
    </button>
  );
}

// ─── ProductHero ─────────────────────────────────────────────────────────────

function ProductHero({
  name, tagline, aggregate, slug,
}: {
      name: string;
  tagline?: string | undefined;
  aggregate?: { averageRating: number; reviewCount: number } | null | undefined;
  slug: string;
}) {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 0" }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16, display: "flex", gap: 6, alignItems: "center" }}>
        <a href="/" style={{ color: "#9CA3AF", textDecoration: "none" }}>Accueil</a>
        <span>/</span>
        <a href="/products" style={{ color: "#9CA3AF", textDecoration: "none" }}>Produits</a>
        <span>/</span>
        <span style={{ color: "#374151" }}>{name}</span>
      </nav>

      <h1 style={{
        margin: "0 0 8px",
        fontSize: "clamp(28px, 5vw, 40px)",
        fontWeight: 900, color: "#0A0E27",
        fontFamily: "var(--font-archivo, system-ui)",
        lineHeight: 1.15,
      }}>
        {name}
      </h1>

      {tagline && (
        <p style={{ fontSize: 18, color: "#4B5563", margin: "0 0 12px", lineHeight: 1.5 }}>
          {tagline}
        </p>
      )}

      {/* Rating + badges */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 8 }}>
        {aggregate && (
          <a href={`/products/${slug}#avis`} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span style={{ color: "#F59E0B", fontSize: 16 }}>
              {"★".repeat(Math.round(aggregate.averageRating))}{"☆".repeat(5 - Math.round(aggregate.averageRating))}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0A0E27" }}>
              {aggregate.averageRating.toFixed(1)}/5
            </span>
            <span style={{ fontSize: 13, color: "#6B7280" }}>
              ({aggregate.reviewCount} avis)
            </span>
          </a>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            "BAT numérique offert",
            "Vérification fichier incluse",
            "Livraison offerte dès 50 €",
            "Impression en France",
          ].map((b) => (
            <span key={b} style={{
              fontSize: 12, fontWeight: 600, color: "#374151",
              background: "#F3F4F6", borderRadius: 6, padding: "3px 10px",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ color: "#10B981" }}>✓</span> {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TierPricingCard ─────────────────────────────────────────────────────────

function TierPricingCard({
  tiers, currentQty, sizeLabel,
}: {
  tiers: { minQty: number; discountPct: number }[];
  currentQty: number;
  sizeLabel?: string;
}) {
  if (!tiers.length) return null;
  return (
    <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Tarifs dégressifs
        </h4>
        {sizeLabel && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{sizeLabel}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tiers.map((tier, i) => {
          const next = tiers[i + 1];
          const isActive = currentQty >= tier.minQty && (!next || currentQty < next.minQty);
          return (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 10px", borderRadius: 8,
              background: isActive ? "#EFF6FF" : "transparent",
              border: isActive ? "1.5px solid #BFDBFE" : "1.5px solid transparent",
            }}>
              <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 400, color: isActive ? "#1D4ED8" : "#374151" }}>
                {tier.minQty}+ pcs
              </span>
              {tier.discountPct > 0 ? (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                  background: isActive ? "#DBEAFE" : "#F3F4F6",
                  color: isActive ? "#1D4ED8" : "#6B7280",
                }}>
                  -{tier.discountPct}%
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>tarif standard</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── StickyQuote desktop ──────────────────────────────────────────────────────

function StickyQuoteSummary({
  priceResult, priceLoading, currentQty, widthMm, heightMm,
  shape, material, lamination, tiers, onAddToCart, addState,
  requiresFile, hasFile, onUpsell,
}: {
  priceResult: ReturnType<typeof configuratorReducer>["priceResult"];
  priceLoading: boolean;
  currentQty: number;
  widthMm: number;
  heightMm: number;
  shape?: { name: string } | undefined;
  material?: { name: string } | undefined;
  lamination?: { name: string } | null | undefined;
  tiers: { minQty: number; discountPct: number }[];
  onAddToCart: () => void;
  addState: string;
  requiresFile: boolean;
  hasFile: boolean;
  onUpsell: (qty: number) => void;
}) {
  const nextTier = tiers.find((t) => t.minQty > currentQty);
  const canOrder = !!priceResult && !priceLoading && (!requiresFile || hasFile);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Quote card */}
      <div style={{ background: "#0A0E27", color: "#fff", borderRadius: 16, padding: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Votre devis
          </h3>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: "3px 9px", borderRadius: 10,
            background: priceLoading ? "#374151" : "#22C55E", color: "#fff",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {priceLoading ? "Calcul…" : "LIVE"}
          </span>
        </div>

        {/* Config summary */}
        <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
          {[
            ["Forme", shape?.name ?? "—"],
            ["Taille", `${widthMm} × ${heightMm} mm`],
            ["Quantité", `${currentQty} pcs`],
            ["Matière", material?.name ?? "—"],
            ["Finition", lamination?.name ?? "Sans lamination"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ opacity: 0.6 }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Price */}
        {priceResult ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1 }} aria-live="polite">
                {eur(priceResult.totalCents)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>TVA 20% incluse</div>
              <div style={{ fontSize: 15, opacity: 0.85, marginTop: 6, fontWeight: 600 }}>
                soit {eurUnit(priceResult.unitPriceCents)} / sticker
              </div>
            </div>

            {priceResult.quantityDiscountPct > 0 && (
              <div style={{
                background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 8, padding: "8px 12px", marginBottom: 16,
                fontSize: 12, color: "#86EFAC", fontWeight: 700,
              }}>
                ✓ Vous économisez {priceResult.quantityDiscountPct}% grâce à la remise quantité
              </div>
            )}

            {/* Upsell */}
            {nextTier && (
              <div style={{
                background: "rgba(255,56,92,0.12)", border: "1px solid rgba(255,56,92,0.25)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#FCA5A5", fontWeight: 600 }}>
                  💡 Passez à {nextTier.minQty} stickers et économisez {nextTier.discountPct}% par sticker
                </p>
                <button
                  onClick={() => onUpsell(nextTier.minQty)}
                  style={{
                    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)",
                    color: "#fff", padding: "5px 14px", borderRadius: 8, fontSize: 12,
                    fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Passer à {nextTier.minQty} →
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 900, opacity: 0.3 }}>— €</div>
            <div style={{ fontSize: 12, opacity: 0.4, marginTop: 4 }}>Configurez votre sticker</div>
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={onAddToCart}
          disabled={!canOrder || addState === "loading"}
          style={{
            width: "100%", padding: "16px 20px", borderRadius: 12, border: "none",
            background: addState === "success" ? "#059669" : canOrder ? "#FF385C" : "#374151",
            color: "#fff", fontWeight: 900, fontSize: 17, cursor: canOrder ? "pointer" : "not-allowed",
            opacity: !canOrder && addState !== "loading" ? 0.5 : 1,
            transition: "all 0.2s", letterSpacing: "0.01em",
          }}
        >
          {addState === "loading" ? "Ajout en cours…" :
           addState === "success" ? "✓ Ajouté au panier !" :
           "Commander mes stickers →"}
        </button>

        {requiresFile && !hasFile && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#FCA5A5", textAlign: "center" }}>
            ⚠️ Déposez votre fichier (étape 6) pour continuer
          </p>
        )}

        {/* Reassurance */}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "BAT numérique offert",
            "Vérification fichier incluse",
            "Production sous 48h",
            "Livraison offerte dès 50 €",
            "Paiement 100% sécurisé",
          ].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.65 }}>
              <span style={{ color: "#34D399" }}>✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tier pricing */}
      <TierPricingCard tiers={tiers} currentQty={currentQty} />
    </div>
  );
}

// ─── Mobile sticky bar ────────────────────────────────────────────────────────

function MobileStickyBar({
  priceResult, currentQty, onAddToCart, addState, canOrder,
}: {
  priceResult: ReturnType<typeof configuratorReducer>["priceResult"];
  currentQty: number;
  onAddToCart: () => void;
  addState: string;
  canOrder: boolean;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "#0A0E27", borderTop: "1px solid rgba(255,255,255,0.1)",
      padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        {priceResult ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
              {eur(priceResult.totalCents)}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
              {eurUnit(priceResult.unitPriceCents)} / sticker · {currentQty} pcs
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Configurez votre sticker</div>
        )}
      </div>
      <button
        type="button"
        onClick={onAddToCart}
        disabled={!canOrder || addState === "loading"}
        style={{
          padding: "12px 24px", borderRadius: 10, border: "none",
          background: addState === "success" ? "#059669" : canOrder ? "#FF385C" : "#374151",
          color: "#fff", fontWeight: 800, fontSize: 15, cursor: canOrder ? "pointer" : "not-allowed",
          flexShrink: 0, opacity: !canOrder ? 0.55 : 1,
        }}
      >
        {addState === "loading" ? "…" : addState === "success" ? "✓ Ajouté" : "Commander →"}
      </button>
    </div>
  );
}

// ─── FileUploadStep ───────────────────────────────────────────────────────────

function FileUploadStep({
  uploadState, uploadedFile, uploadError, needsFile, shapeRequiresCutPath,
  onFileSelect, onRemove,
}: {
  uploadState: string;
  uploadedFile: UploadedFile | null;
  uploadError: string | null;
  needsFile: boolean;
  shapeRequiresCutPath: boolean;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const borderColor = uploadedFile ? "#10B981" : uploadError ? "#EF4444" : isDragging ? "#6366F1" : "#D1D5DB";
  const bgColor = uploadedFile ? "#F0FDF4" : isDragging ? "#EEF2FF" : "#F9FAFB";

  return (
    <StepCard
      number="06"
      title="Votre fichier"
      summary={uploadedFile ? "✓ Fichier reçu" : needsFile ? "Requis" : "Optionnel"}
    >
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFileSelect(file);
        }}
        onClick={() => !uploadedFile && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${borderColor}`, borderRadius: 14,
          padding: "32px 24px", textAlign: "center",
          cursor: uploadedFile ? "default" : "pointer",
          background: bgColor, transition: "all 0.2s",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.svg,.pdf,.ai,.eps"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
            e.target.value = "";
          }}
        />

        {uploadState === "uploading" ? (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#6366F1" }}>Upload en cours…</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Connexion sécurisée SSL</div>
          </div>
        ) : uploadedFile ? (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#059669" }}>{uploadedFile.filename}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
              {(uploadedFile.sizeBytes / 1024 / 1024).toFixed(2)} Mo
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              style={{
                marginTop: 12, fontSize: 12, color: "#EF4444",
                background: "none", border: "1px solid #FECACA",
                borderRadius: 8, padding: "4px 14px", cursor: "pointer",
              }}
            >
              Supprimer et changer
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📎</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0A0E27" }}>
              {isDragging ? "Déposez votre fichier ici" : "Glissez votre fichier ici ou cliquez"}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
              PNG, JPG, SVG, PDF, AI, EPS — max 50 Mo
            </div>
            <div style={{
              marginTop: 14, padding: "10px 16px",
              background: "#EFF6FF", borderRadius: 10, border: "1px solid #BFDBFE",
              fontSize: 12, color: "#1D4ED8",
            }}>
              💙 Pas sûr de votre fichier ? Envoyez-le quand même.<br />
              <strong>Notre équipe vérifie gratuitement avant impression.</strong>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div style={{
          padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 8, fontSize: 13, color: "#EF4444",
        }}>
          {uploadError}
        </div>
      )}

      {shapeRequiresCutPath && !uploadedFile && (
        <div style={{
          padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 8, fontSize: 12, color: "#B45309", fontWeight: 600,
        }}>
          ⚠️ Tracé vectoriel recommandé pour cette forme (PDF, AI, EPS ou SVG).<br />
          Si besoin, notre équipe vous recontacte avant la production.
        </div>
      )}
    </StepCard>
  );
}

// ─── Main Configurator ────────────────────────────────────────────────────────

export function ProductConfigurator({
  productId, productName, imageUrl, config, shapes, sizes, materials, laminations, aggregate, slug, enableProductionDownload = false,
}: {
  productId: string;
  productName: string;
  imageUrl?: string;
  config: ProductStickerConfig;
  shapes: StickerShape[];
  sizes: StickerSize[];
  materials: StickerMaterial[];
  laminations: StickerLamination[];
  aggregate?: { averageRating: number; reviewCount: number } | null;
  slug: string;
  /** Toggle back-office : autorise le téléchargement du PDF de production
   *  depuis l'éditeur (QA / tests internes). */
  enableProductionDownload?: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    configuratorReducer,
    { shapes, sizes, materials, laminations, minWidthMm: config.minWidthMm, minHeightMm: config.minHeightMm },
    createInitialState,
  );

  const priceDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<StickerEditorHandle>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);

  // Derived values
  const selectedShape = shapes.find((s) => s.id === state.selectedShapeId);
  const selectedSize = sizes.find((s) => s.id === state.selectedSizeId);
  const selectedMaterial = materials.find((m) => m.id === state.selectedMaterialId);
  const selectedLamination = laminations.find((l) => l.id === state.selectedLaminationId) ?? null;

  const widthMm = state.sizeMode === "custom"
    ? state.customWidth
    : selectedSize?.widthMm ?? config.minWidthMm;
  const heightMm = state.sizeMode === "custom"
    ? state.customHeight
    : selectedSize?.heightMm ?? config.minHeightMm;
  const currentQty = state.useCustomQty
    ? (parseInt(state.customQuantity) || 1)
    : state.quantity;

  const compatibleLaminations = laminations.filter((l) => {
    if (!selectedMaterial || !l.compatibleMaterialCodes.length) return true;
    return l.compatibleMaterialCodes.includes(selectedMaterial.code);
  });

  const QUICK_QUANTITIES = [50, 100, 250, 500, 1000];

  const needsFile = config.requireFileUpload || !!selectedShape?.requiresCutPath;
  const canOrder = !!state.priceResult && !state.priceLoading && (!needsFile || !!state.uploadedFile);

  // ── Price calculation ──
  const calculatePrice = useCallback(async () => {
    // Only require shapeId/materialId if those steps are visible
    if (hasShapes && !state.selectedShapeId) return;
    if (hasMaterials && !state.selectedMaterialId) return;
    if (currentQty < 1) return;
    dispatch({ type: "SET_PRICE", result: state.priceResult, loading: true });
    try {
      const res = await fetch("/api/stickers/calculate-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          ...(state.selectedShapeId ? { shapeId: state.selectedShapeId } : {}),
          ...(state.selectedSizeId ? { sizeId: state.selectedSizeId } : {}),
          widthMm, heightMm, quantity: currentQty,
          ...(state.selectedMaterialId ? { materialId: state.selectedMaterialId } : {}),
          ...(state.selectedLaminationId ? { laminationId: state.selectedLaminationId } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_PRICE", result: data, loading: false });
      } else {
        dispatch({ type: "SET_PRICE", result: null, loading: false });
      }
    } catch {
      dispatch({ type: "SET_PRICE", result: state.priceResult, loading: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, state.selectedShapeId, widthMm, heightMm, currentQty, state.selectedMaterialId, state.selectedLaminationId]);

  useEffect(() => {
    if (priceDebounce.current) clearTimeout(priceDebounce.current);
    priceDebounce.current = setTimeout(calculatePrice, 300);
    return () => { if (priceDebounce.current) clearTimeout(priceDebounce.current); };
  }, [calculatePrice]);

  // ── File upload — via same-origin proxy (no CSP issue, no MinIO URL exposed) ──
  // Upload bas niveau : prépare la clé, POST vers /api/uploads/direct.
  // Renvoie l'UploadedFile pour que les appelants puissent l'utiliser sans
  // attendre un re-render React (utile dans handleEmbeddedAddToCart).
  async function uploadFileBlob(file: File): Promise<UploadedFile> {
    const mimeType = file.type || "application/octet-stream";
    const { key } = await prepareFileUpload({
      filename: file.name,
      mimeType,
      sizeBytes: file.size,
    });
    const res = await fetch("/api/uploads/direct", {
      method: "POST",
      body: file,
      headers: {
        "Content-Type": mimeType,
        "x-file-name": encodeURIComponent(file.name),
        "x-file-mime": mimeType,
        "x-storage-key": key,
        "content-length": String(file.size),
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "Erreur d'upload");
    }
    return { key, filename: file.name, mimeType, sizeBytes: file.size };
  }

  async function handleFileSelect(file: File) {
    dispatch({ type: "SET_UPLOAD_STATE", state: "uploading" });
    try {
      const uploaded = await uploadFileBlob(file);
      dispatch({ type: "SET_UPLOADED_FILE", file: uploaded });
    } catch (err) {
      dispatch({
        type: "SET_UPLOAD_STATE",
        state: "error",
        error: err instanceof Error ? err.message : "Erreur d'upload",
      });
    }
  }

  // ── Add to cart ──
  async function handleAddToCart() {
    if (!canOrder || !state.priceResult) return;
    if (needsFile && !state.uploadedFile) {
      dispatch({ type: "SET_UPLOAD_STATE", state: "error", error: "Veuillez déposer votre fichier avant de commander." });
      document.querySelector("[data-step='upload']")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    dispatch({ type: "SET_ADD_STATE", state: "loading" });
    try {
      const shape = selectedShape;
      const material = selectedMaterial;
      const lamination = selectedLamination;

      const result = await addToCart({
        productId, productName, quantity: currentQty,
        unitPriceCents: state.priceResult.unitPriceCents,
        ...(state.customerNote ? { customizationNote: state.customerNote } : {}),
        stickerConfig: {
          ...(shape ? { shapeId: shape.id, shapeName: shape.name, shapeCode: shape.code } : {}),
          widthMm, heightMm, quantity: currentQty,
          ...(material ? { materialId: material.id, materialName: material.name } : {}),
          ...(lamination ? { laminationId: lamination.id, laminationName: lamination.name } : {}),
          ...(state.customerNote ? { customerNote: state.customerNote } : {}),
          pricingSnapshot: {
            pricingMode: (config.pricingMode ?? "per_cm2") as "per_cm2" | "unit_price",
            pricePerCm2Cents: config.pricePerCm2Cents,
            baseUnitPriceCents: config.baseUnitPriceCents ?? 0,
            surfaceCm2: state.priceResult.surfaceCm2,
            quantityDiscountPct: state.priceResult.quantityDiscountPct,
            materialMultiplier: state.priceResult.materialMultiplier,
            laminationMultiplier: state.priceResult.laminationMultiplier,
            shapeMultiplier: state.priceResult.shapeMultiplier,
            setupFeeCents: state.priceResult.setupFeeCents,
            unitPriceCents: state.priceResult.unitPriceCents,
            subtotalCents: state.priceResult.subtotalCents,
          },
        },
      });

      if (result.ok && state.uploadedFile) {
        await confirmFileUpload({
          orderId: result.data.orderId, itemId: result.data.itemId,
          key: state.uploadedFile.key, filename: state.uploadedFile.filename,
          mimeType: state.uploadedFile.mimeType, sizeBytes: state.uploadedFile.sizeBytes,
        });
      }

      dispatch({ type: "SET_ADD_STATE", state: "success" });
      setTimeout(() => dispatch({ type: "SET_ADD_STATE", state: "idle" }), 3500);
      router.refresh();
    } catch {
      dispatch({ type: "SET_ADD_STATE", state: "error" });
      setTimeout(() => dispatch({ type: "SET_ADD_STATE", state: "idle" }), 3000);
    }
  }

  // ── Éditeur visuel — callback validation ──
  async function handleEditorValidate(output: EditorValidationOutput) {
    setShowEditor(false);

    // Convertir le data URL en File blob
    const res = await fetch(output.previewDataUrl);
    const blob = await res.blob();
    const filename = `sticker-preview-${Date.now()}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    // Injecter la config éditeur dans la note
    dispatch({ type: "SET_NOTE", note: buildEditorNote(output) });

    // Uploader le preview comme fichier client
    await handleFileSelect(file);
  }

  // Construit la note client résumant le réglage de l'éditeur.
  function buildEditorNote(output: EditorValidationOutput): string {
    const shapeLabel = selectedShape?.name ?? "—";
    return [
      `[Éditeur] Forme : ${shapeLabel}`,
      `Type de coupe : ${output.editorConfig.cutType === "kiss_cut" ? "Demi-chair (Kiss cut)" : "Pleine chair"}`,
      `Marge de coupe : ${output.editorConfig.cutlineOffsetMm} mm`,
      `Résolution : ${output.editorConfig.dpi} DPI`,
      `Fichier original : ${output.editorConfig.originalFilename}`,
    ].join(" · ");
  }

  // ── Add to cart — variante intégrée (éditeur dans la page produit) ──
  // Capture l'aperçu Konva, l'upload puis enchaîne addToCart, sans bouton
  // « Valider » manuel : tout est résolu au clic « Ajouter au panier ».
  async function handleEmbeddedAddToCart() {
    if (!state.priceResult) return;

    // Si l'éditeur n'a pas d'image → erreur visible et scroll vers l'éditeur.
    if (!editorRef.current?.hasImage()) {
      dispatch({
        type: "SET_UPLOAD_STATE",
        state: "error",
        error: "Veuillez importer un visuel dans l'éditeur avant de commander.",
      });
      document.querySelector("[data-step='editor']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    dispatch({ type: "SET_ADD_STATE", state: "loading" });
    try {
      // 1. Capture l'aperçu PNG
      const output = await editorRef.current.validate();
      if (!output) {
        dispatch({ type: "SET_ADD_STATE", state: "error" });
        setTimeout(() => dispatch({ type: "SET_ADD_STATE", state: "idle" }), 3000);
        return;
      }

      // 2. Convertit l'aperçu en File et upload
      const blobRes = await fetch(output.previewDataUrl);
      const blob = await blobRes.blob();
      const filename = `sticker-preview-${Date.now()}.png`;
      const previewFile = new File([blob], filename, { type: "image/png" });

      const uploadedFile = await uploadFileBlob(previewFile);
      dispatch({ type: "SET_UPLOADED_FILE", file: uploadedFile });

      // 3. Note client résumant la config éditeur
      const note = buildEditorNote(output);
      dispatch({ type: "SET_NOTE", note });

      // 4. Add to cart (avec l'uploadedFile direct, sans dépendre du re-render)
      const shape = selectedShape;
      const material = selectedMaterial;
      const lamination = selectedLamination;

      const result = await addToCart({
        productId, productName, quantity: currentQty,
        unitPriceCents: state.priceResult.unitPriceCents,
        customizationNote: note,
        stickerConfig: {
          ...(shape ? { shapeId: shape.id, shapeName: shape.name, shapeCode: shape.code } : {}),
          widthMm, heightMm, quantity: currentQty,
          ...(material ? { materialId: material.id, materialName: material.name } : {}),
          ...(lamination ? { laminationId: lamination.id, laminationName: lamination.name } : {}),
          customerNote: note,
          pricingSnapshot: {
            pricingMode: (config.pricingMode ?? "per_cm2") as "per_cm2" | "unit_price",
            pricePerCm2Cents: config.pricePerCm2Cents,
            baseUnitPriceCents: config.baseUnitPriceCents ?? 0,
            surfaceCm2: state.priceResult.surfaceCm2,
            quantityDiscountPct: state.priceResult.quantityDiscountPct,
            materialMultiplier: state.priceResult.materialMultiplier,
            laminationMultiplier: state.priceResult.laminationMultiplier,
            shapeMultiplier: state.priceResult.shapeMultiplier,
            setupFeeCents: state.priceResult.setupFeeCents,
            unitPriceCents: state.priceResult.unitPriceCents,
            subtotalCents: state.priceResult.subtotalCents,
          },
        },
      });

      if (result.ok) {
        await confirmFileUpload({
          orderId: result.data.orderId, itemId: result.data.itemId,
          key: uploadedFile.key, filename: uploadedFile.filename,
          mimeType: uploadedFile.mimeType, sizeBytes: uploadedFile.sizeBytes,
        });
      }

      dispatch({ type: "SET_ADD_STATE", state: "success" });
      setTimeout(() => dispatch({ type: "SET_ADD_STATE", state: "idle" }), 3500);
      router.refresh();
    } catch {
      dispatch({ type: "SET_ADD_STATE", state: "error" });
      setTimeout(() => dispatch({ type: "SET_ADD_STATE", state: "idle" }), 3000);
    }
  }

  const sizeLabel = state.sizeMode === "custom"
    ? `${widthMm}×${heightMm} mm (perso.)`
    : selectedSize?.label ?? "";

  // Steps visible based on configured options
  const hasShapes = shapes.length > 0;
  const hasSizes = sizes.length > 0;
  const hasMaterials = materials.length > 0;
  const hasLaminations = laminations.length > 0;

  // Dynamic step numbering — only count visible steps
  let stepCounter = 0;
  const step = () => String(++stepCounter).padStart(2, "0");

  // ─── Mode « éditeur intégré » ────────────────────────────────────────────
  // Layout CRO-optimisé pour la fiche produit avec éditeur visuel :
  //  1. Hero compact (titre, avis, USP)
  //  2. TrustBar pleine largeur (5 piliers de réassurance)
  //  3. Grid 2 colonnes : éditeur à gauche, sidebar sticky à droite
  //     - Sidebar (top) : EditorPriceCard → prix big + CTA above-the-fold
  //     - Sidebar (mid) : configuration condensée (forme, taille, qté, …)
  //     - Sidebar (bot) : tarifs dégressifs (anchor pricing + upsell)
  //  4. MobileStickyBar : prix + CTA toujours visibles sur mobile
  if (config.editorEnabled) {
    const allConfigured = !!selectedShape && (state.sizeMode === "custom" || !!selectedSize) && currentQty > 0;
    const nextTier = config.quantityTiers.find((t) => t.minQty > currentQty) ?? null;
    return (
      <>
        <ProductHero
          name={productName}
          slug={slug}
          {...(aggregate ? { aggregate } : {})}
        />

        <TrustBar />

        <div
          className="editor-layout"
          style={{
            maxWidth: 1320, margin: "0 auto",
            padding: "20px 24px 120px",
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: 24, alignItems: "start",
          }}
        >
          {/* ── Gauche : éditeur visuel intégré ── */}
          <div data-step="editor" style={{ minWidth: 0 }}>
            <StickerEditor
              ref={editorRef}
              embedded
              productName={productName}
              widthMm={widthMm}
              heightMm={heightMm}
              shapes={shapes}
              selectedShapeId={state.selectedShapeId}
              onShapeChange={(id) => dispatch({ type: "SELECT_SHAPE", id })}
              sizes={sizes}
              selectedSizeId={state.selectedSizeId}
              sizeMode={state.sizeMode}
              onSizeChange={(id) => dispatch({ type: "SELECT_SIZE", id })}
              allowResize={config.allowCustomWidth}
              enableProductionDownload={enableProductionDownload}
              onValidate={handleEditorValidate}
              onClose={() => {}}
            />
          </div>

          {/* ── Droite : sidebar sticky CRO-optimisée ── */}
          <aside style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 1. Prix + CTA above-the-fold (priorité absolue) */}
            <EditorPriceCard
              priceResult={state.priceResult}
              priceLoading={state.priceLoading}
              currentQty={currentQty}
              widthMm={widthMm}
              heightMm={heightMm}
              onAddToCart={handleEmbeddedAddToCart}
              addState={state.addState}
              hasFile={!!state.uploadedFile}
              fileWarning={state.uploadError}
              nextTier={nextTier}
              onUpsell={(qty) => dispatch({ type: "SELECT_QUANTITY", qty })}
            />

            {/* 2. Configuration condensée — un bloc unique pour réduire le bruit */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Forme */}
              {hasShapes && (
                <SidebarSection
                  title="Forme"
                  summary={selectedShape?.name}
                  complete={!!selectedShape}
                  {...(selectedShape?.requiresCutPath
                    ? { warning: "Tracé vectoriel requis (PDF, AI, EPS, SVG)." }
                    : {})}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {shapes.map((shape) => (
                      <OptionCard
                        key={shape.id}
                        active={state.selectedShapeId === shape.id}
                        label={shape.name}
                        {...(shape.requiresCutPath
                          ? { sublabel: "Tracé requis" }
                          : shape.description
                          ? { sublabel: shape.description }
                          : {})}
                        onClick={() => dispatch({ type: "SELECT_SHAPE", id: shape.id })}
                      />
                    ))}
                  </div>
                </SidebarSection>
              )}

              {/* Taille */}
              {(hasSizes || config.allowCustomWidth) && (
                <SidebarSection
                  title="Taille"
                  summary={sizeLabel || undefined}
                  complete={state.sizeMode === "custom" || !!selectedSize}
                >
                  {hasSizes && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sizes.map((size) => (
                        <OptionCard
                          key={size.id}
                          active={state.sizeMode === "preset" && state.selectedSizeId === size.id}
                          label={size.label}
                          sublabel={`${size.widthMm}×${size.heightMm}`}
                          onClick={() => dispatch({ type: "SELECT_SIZE", id: size.id })}
                        />
                      ))}
                      {config.allowCustomWidth && (
                        <OptionCard
                          active={state.sizeMode === "custom"}
                          label="Perso."
                          sublabel="Sur mesure"
                          onClick={() => dispatch({ type: "SET_SIZE_MODE", mode: "custom" })}
                        />
                      )}
                    </div>
                  )}
                  {(!hasSizes || state.sizeMode === "custom") && config.allowCustomWidth && (
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8,
                      padding: 10, background: "#F9FAFB", borderRadius: 8,
                      border: "1px solid #E5E7EB",
                    }}>
                      {[
                        { label: "Larg.", key: "width" as const, value: state.customWidth, min: config.minWidthMm, max: config.maxWidthMm },
                        { label: "Haut.", key: "height" as const, value: state.customHeight, min: config.minHeightMm, max: config.maxHeightMm },
                      ].map(({ label, key, value, min, max }) => (
                        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 90 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number"
                              value={value}
                              min={min}
                              max={max}
                              onChange={(e) => dispatch({
                                type: key === "width" ? "SET_CUSTOM_WIDTH" : "SET_CUSTOM_HEIGHT",
                                value: Math.min(max, Math.max(min, parseInt(e.target.value) || min)),
                              })}
                              style={{ width: 60, padding: "5px 7px", border: "1.5px solid #D1D5DB", borderRadius: 6, fontSize: 13, fontWeight: 600 }}
                            />
                            <span style={{ fontSize: 11, color: "#6B7280" }}>mm</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </SidebarSection>
              )}

              {/* Quantité */}
              <SidebarSection title="Quantité" summary={`${currentQty} pcs`} complete={currentQty > 0}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {QUICK_QUANTITIES.map((qty) => {
                    const tier = [...config.quantityTiers].reverse().find((t) => t.minQty <= qty);
                    return (
                      <OptionCard
                        key={qty}
                        active={!state.useCustomQty && state.quantity === qty}
                        label={`${qty}`}
                        {...(tier && tier.discountPct > 0
                          ? { sublabel: `-${tier.discountPct}%`, badge: tier.discountPct >= 20 ? "Recommandé" : undefined }
                          : { sublabel: "tarif std" })}
                        onClick={() => dispatch({ type: "SELECT_QUANTITY", qty })}
                      />
                    );
                  })}
                  <OptionCard
                    active={state.useCustomQty}
                    label="Autre"
                    sublabel="Saisir"
                    onClick={() => dispatch({ type: "SET_CUSTOM_QTY_MODE", on: true })}
                  />
                </div>
                {state.useCustomQty && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <input
                      type="number"
                      value={state.customQuantity}
                      min={1}
                      placeholder="ex : 75"
                      onChange={(e) => dispatch({ type: "SET_CUSTOM_QTY_VALUE", value: e.target.value })}
                      autoFocus
                      style={{ width: 90, padding: "7px 10px", border: "1.5px solid #D1D5DB", borderRadius: 6, fontSize: 14, fontWeight: 600 }}
                    />
                    <span style={{ fontSize: 12, color: "#6B7280" }}>pcs</span>
                  </div>
                )}
              </SidebarSection>

              {/* Matière */}
              {hasMaterials && (
                <SidebarSection title="Matière" summary={selectedMaterial?.name} complete={!!selectedMaterial}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {materials.map((mat) => (
                      <OptionCard
                        key={mat.id}
                        active={state.selectedMaterialId === mat.id}
                        label={mat.name}
                        {...(mat.description ? { sublabel: mat.description } : {})}
                        {...(mat.isPremium ? { badge: "Premium" } : {})}
                        onClick={() => {
                          dispatch({ type: "SELECT_MATERIAL", id: mat.id });
                          if (state.selectedLaminationId) {
                            const lam = laminations.find((l) => l.id === state.selectedLaminationId);
                            if (lam && mat.compatibleLaminationCodes.length > 0 && !mat.compatibleLaminationCodes.includes(lam.code)) {
                              dispatch({ type: "SELECT_LAMINATION", id: laminations.find((l) => l.isDefault)?.id ?? null });
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                </SidebarSection>
              )}

              {/* Pellicule / Finition */}
              {hasLaminations && (
                <SidebarSection title="Finition" summary={selectedLamination?.name ?? "Sans"} complete={true}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {laminations.map((lam) => {
                      const isCompatible = compatibleLaminations.includes(lam);
                      const lamSublabel = !isCompatible
                        ? `Non compatible`
                        : lam.description
                        ? lam.description
                        : lam.priceModifierValue !== 1
                        ? `×${lam.priceModifierValue}`
                        : undefined;
                      return (
                        <OptionCard
                          key={lam.id}
                          active={state.selectedLaminationId === lam.id}
                          label={lam.name}
                          {...(lamSublabel ? { sublabel: lamSublabel } : {})}
                          disabled={!isCompatible}
                          onClick={() => isCompatible && dispatch({ type: "SELECT_LAMINATION", id: lam.id })}
                        />
                      );
                    })}
                  </div>
                </SidebarSection>
              )}
            </div>

            {/* 3. Tarifs dégressifs (anchor pricing — montre les économies à venir) */}
            <TierPricingCard
              tiers={config.quantityTiers}
              currentQty={currentQty}
              {...(sizeLabel ? { sizeLabel } : {})}
            />

            {/* 4. Indicateur progression discret */}
            {!allConfigured && (
              <p style={{
                margin: 0, fontSize: 11, color: "#6B7280", textAlign: "center",
                fontStyle: "italic", lineHeight: 1.4,
              }}>
                Complétez la configuration pour finaliser votre commande.
              </p>
            )}
          </aside>
        </div>

        {/* Mobile sticky bar — prix + CTA toujours visibles */}
        <div className="mobile-sticky-bar">
          <MobileStickyBar
            priceResult={state.priceResult}
            currentQty={currentQty}
            onAddToCart={handleEmbeddedAddToCart}
            addState={state.addState}
            canOrder={!!state.priceResult && !state.priceLoading}
          />
        </div>

        <style>{`
          .editor-layout {
            display: grid;
            grid-template-columns: 1fr 380px;
            gap: 24px;
          }
          .mobile-sticky-bar { display: none; }
          @media (max-width: 1024px) {
            .editor-layout {
              grid-template-columns: 1fr !important;
            }
            .editor-layout > aside {
              position: static !important;
            }
          }
          @media (max-width: 860px) {
            .mobile-sticky-bar { display: block; }
          }
        `}</style>
      </>
    );
  }

  // ─── Mode classique (éditeur désactivé) : layout original ────────────────
  return (
    <>
      {/* Éditeur visuel — modal plein écran.
          Le composant reste monté après la première ouverture pour
          préserver l'image et les paramètres entre les ouvertures. La taille
          du canvas se met a jour en interne via `SET_CANVAS_SIZE` quand
          widthMm/heightMm changent — pas de remount. */}
      {editorMounted && config.editorEnabled && (
        <StickerEditor
          ref={editorRef}
          isOpen={showEditor}
          productName={productName}
          widthMm={widthMm}
          heightMm={heightMm}
          shapes={shapes}
          selectedShapeId={state.selectedShapeId}
          onShapeChange={(id) => dispatch({ type: "SELECT_SHAPE", id })}
          sizes={sizes}
          selectedSizeId={state.selectedSizeId}
          sizeMode={state.sizeMode}
          onSizeChange={(id) => dispatch({ type: "SELECT_SIZE", id })}
          /* Pas de redimensionnement du visuel : il doit toujours remplir
             le format choisi. Activé uniquement si le produit autorise une
             taille personnalisée. */
          allowResize={config.allowCustomWidth}
          enableProductionDownload={enableProductionDownload}
          onValidate={handleEditorValidate}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Hero */}
      <ProductHero
        name={productName}
        slug={slug}
        {...(aggregate ? { aggregate } : {})}
      />

      {/* Main layout */}
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "32px 24px 120px",
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 32, alignItems: "start",
      }}
      className="configurator-grid"
      >
        {/* ── Left: steps ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Forme — masqué si aucune forme configurée */}
          {hasShapes && (
            <StepCard
              number={step()}
              title="Forme"
              {...(selectedShape?.name ? { summary: selectedShape.name } : {})}
              {...(selectedShape?.requiresCutPath
                ? { warning: "Cette forme nécessite un fichier vectoriel avec tracé de découpe (PDF, AI, EPS ou SVG)." }
                : {})}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {shapes.map((shape) => (
                  <OptionCard
                    key={shape.id}
                    active={state.selectedShapeId === shape.id}
                    label={shape.name}
                    {...(shape.requiresCutPath
                      ? { sublabel: "Tracé vectoriel requis" }
                      : shape.description
                      ? { sublabel: shape.description }
                      : {})}
                    onClick={() => dispatch({ type: "SELECT_SHAPE", id: shape.id })}
                  />
                ))}
              </div>
            </StepCard>
          )}

          {/* Taille — masqué si aucune taille ET taille custom désactivée */}
          {(hasSizes || config.allowCustomWidth) && (
            <StepCard number={step()} title="Taille" {...(sizeLabel ? { summary: sizeLabel } : {})}>
              {hasSizes && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {sizes.map((size) => (
                    <OptionCard
                      key={size.id}
                      active={state.sizeMode === "preset" && state.selectedSizeId === size.id}
                      label={size.label}
                      sublabel={`${size.widthMm} × ${size.heightMm} mm`}
                      onClick={() => dispatch({ type: "SELECT_SIZE", id: size.id })}
                    />
                  ))}
                  {config.allowCustomWidth && (
                    <OptionCard
                      active={state.sizeMode === "custom"}
                      label="Personnalisée"
                      sublabel="Dimensions libres"
                      onClick={() => dispatch({ type: "SET_SIZE_MODE", mode: "custom" })}
                    />
                  )}
                </div>
              )}

              {/* Si aucune taille prédéfinie ET custom autorisé → afficher direct les inputs */}
              {(!hasSizes || state.sizeMode === "custom") && config.allowCustomWidth && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "16px", background: "#F9FAFB", borderRadius: 12, border: "1.5px solid #E5E7EB" }}>
                  {[
                    { label: "Largeur", key: "width" as const, value: state.customWidth, min: config.minWidthMm, max: config.maxWidthMm },
                    { label: "Hauteur", key: "height" as const, value: state.customHeight, min: config.minHeightMm, max: config.maxHeightMm },
                  ].map(({ label, key, value, min, max }) => (
                    <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 120 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="number"
                          value={value}
                          min={min}
                          max={max}
                          onChange={(e) => dispatch({
                            type: key === "width" ? "SET_CUSTOM_WIDTH" : "SET_CUSTOM_HEIGHT",
                            value: Math.min(max, Math.max(min, parseInt(e.target.value) || min)),
                          })}
                          style={{ width: 80, padding: "8px 10px", border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                        />
                        <span style={{ fontSize: 13, color: "#6B7280" }}>mm</span>
                      </div>
                    </label>
                  ))}
                  <div style={{ width: "100%", fontSize: 12, color: "#9CA3AF" }}>
                    Min : {config.minWidthMm} mm · Max : {config.maxWidthMm} mm ·
                    Surface : {((widthMm * heightMm) / 100).toFixed(1)} cm²
                  </div>
                </div>
              )}
            </StepCard>
          )}

          {/* Quantité — toujours visible */}
          <StepCard number={step()} title="Quantité" summary={`${currentQty} pcs`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {QUICK_QUANTITIES.map((qty) => {
                const tier = [...config.quantityTiers].reverse().find((t) => t.minQty <= qty);
                return (
                  <OptionCard
                    key={qty}
                    active={!state.useCustomQty && state.quantity === qty}
                    label={`${qty} pcs`}
                    {...(tier && tier.discountPct > 0
                      ? { sublabel: `-${tier.discountPct}%` }
                      : { sublabel: "tarif standard" })}
                    onClick={() => dispatch({ type: "SELECT_QUANTITY", qty })}
                  />
                );
              })}
              <OptionCard
                active={state.useCustomQty}
                label="Autre"
                sublabel="Saisir une quantité"
                onClick={() => dispatch({ type: "SET_CUSTOM_QTY_MODE", on: true })}
              />
            </div>
            {state.useCustomQty && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="number"
                  value={state.customQuantity}
                  min={1}
                  placeholder="ex : 75"
                  onChange={(e) => dispatch({ type: "SET_CUSTOM_QTY_VALUE", value: e.target.value })}
                  autoFocus
                  style={{ width: 120, padding: "10px 14px", border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 15, fontWeight: 600 }}
                />
                <span style={{ fontSize: 13, color: "#6B7280" }}>pcs</span>
              </div>
            )}
          </StepCard>

          {/* Matière — masqué si aucune matière configurée */}
          {hasMaterials && (
            <StepCard number={step()} title="Matière" {...(selectedMaterial?.name ? { summary: selectedMaterial.name } : {})}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {materials.map((mat) => (
                  <OptionCard
                    key={mat.id}
                    active={state.selectedMaterialId === mat.id}
                    label={mat.name}
                    {...(mat.description ? { sublabel: mat.description } : {})}
                    {...(mat.isPremium ? { badge: "Premium" } : {})}
                    onClick={() => {
                      dispatch({ type: "SELECT_MATERIAL", id: mat.id });
                      if (state.selectedLaminationId) {
                        const lam = laminations.find((l) => l.id === state.selectedLaminationId);
                        if (lam && mat.compatibleLaminationCodes.length > 0 && !mat.compatibleLaminationCodes.includes(lam.code)) {
                          dispatch({ type: "SELECT_LAMINATION", id: laminations.find((l) => l.isDefault)?.id ?? null });
                        }
                      }
                    }}
                  />
                ))}
              </div>
            </StepCard>
          )}

          {/* Finition — masqué si aucune lamination configurée */}
          {hasLaminations && (
            <StepCard number={step()} title="Finition" summary={selectedLamination?.name ?? "Sans lamination"}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {laminations.map((lam) => {
                  const isCompatible = compatibleLaminations.includes(lam);
                  const lamSublabel = !isCompatible
                    ? `Non compatible avec ${selectedMaterial?.name ?? "cette matière"}`
                    : lam.description
                    ? lam.description
                    : lam.priceModifierValue !== 1
                    ? `×${lam.priceModifierValue}`
                    : undefined;
                  return (
                    <OptionCard
                      key={lam.id}
                      active={state.selectedLaminationId === lam.id}
                      label={lam.name}
                      {...(lamSublabel ? { sublabel: lamSublabel } : {})}
                      disabled={!isCompatible}
                      onClick={() => isCompatible && dispatch({ type: "SELECT_LAMINATION", id: lam.id })}
                    />
                  );
                })}
              </div>
            </StepCard>
          )}

          {/* Fichier */}
          <div data-step="upload">
            <FileUploadStep
              uploadState={state.uploadState}
              uploadedFile={state.uploadedFile}
              uploadError={state.uploadError}
              needsFile={needsFile}
              shapeRequiresCutPath={!!selectedShape?.requiresCutPath}
              onFileSelect={handleFileSelect}
              onRemove={() => dispatch({ type: "SET_UPLOADED_FILE", file: null })}
            />
            {/* Bouton éditeur visuel — affiché uniquement si l'éditeur est
                activé pour ce produit dans le back-office. */}
            {config.editorEnabled && !state.uploadedFile && (
              <div style={{
                marginTop: 12, padding: "14px 18px",
                background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
                border: "1.5px solid #BFDBFE",
                borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1D4ED8" }}>
                    ✏️ Créer avec l&apos;éditeur visuel
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                    Importez votre visuel, ajustez la ligne de coupe et visualisez le résultat
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditorMounted(true); setShowEditor(true); }}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "#1D4ED8", color: "#fff",
                    border: "none", fontWeight: 700, fontSize: 13,
                    cursor: "pointer", whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Ouvrir l&apos;éditeur →
                </button>
              </div>
            )}
            {config.editorEnabled && state.uploadedFile && state.customerNote?.includes("[Éditeur]") && (
              <div style={{
                marginTop: 10, padding: "10px 14px",
                background: "#F0FDF4", border: "1px solid #BBF7D0",
                borderRadius: 10, display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 8,
              }}>
                <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>
                  ✓ Fichier créé avec l&apos;éditeur
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // Ne pas reset uploadedFile/note : si l'utilisateur ferme
                    // sans valider, on garde la version actuelle. La validation
                    // suivante écrasera de toute façon.
                    setEditorMounted(true);
                    setShowEditor(true);
                  }}
                  style={{
                    fontSize: 11, color: "#15803D", background: "none",
                    border: "1px solid #BBF7D0", borderRadius: 6,
                    padding: "3px 10px", cursor: "pointer",
                  }}
                >
                  Modifier
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <StepCard number={step()} title="Instructions" summary={state.customerNote ? "Renseignées" : "Optionnel"}>
            <textarea
              value={state.customerNote}
              onChange={(e) => dispatch({ type: "SET_NOTE", note: e.target.value })}
              placeholder="Instructions particulières : couleur Pantone, dimensions exactes, zone de sécurité, remarques de production…"
              rows={3}
              style={{
                width: "100%", padding: "12px 14px",
                border: "1.5px solid #D1D5DB", borderRadius: 10,
                fontSize: 13, resize: "vertical", boxSizing: "border-box", lineHeight: 1.5,
              }}
            />
          </StepCard>
        </div>

        {/* ── Right: sticky quote ── */}
        <div style={{ position: "sticky", top: 80 }}>
          <StickyQuoteSummary
            priceResult={state.priceResult}
            priceLoading={state.priceLoading}
            currentQty={currentQty}
            widthMm={widthMm}
            heightMm={heightMm}
            {...(selectedShape ? { shape: { name: selectedShape.name } } : {})}
            {...(selectedMaterial ? { material: { name: selectedMaterial.name } } : {})}
            lamination={selectedLamination ? { name: selectedLamination.name } : null}
            tiers={config.quantityTiers}
            onAddToCart={handleAddToCart}
            addState={state.addState}
            requiresFile={needsFile}
            hasFile={!!state.uploadedFile}
            onUpsell={(qty) => dispatch({ type: "SELECT_QUANTITY", qty })}
          />
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="mobile-sticky-bar">
        <MobileStickyBar
          priceResult={state.priceResult}
          currentQty={currentQty}
          onAddToCart={handleAddToCart}
          addState={state.addState}
          canOrder={canOrder}
        />
      </div>

      <style>{`
        .configurator-grid {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 32px;
        }
        .mobile-sticky-bar { display: none; }

        @media (max-width: 860px) {
          .configurator-grid {
            grid-template-columns: 1fr !important;
          }
          .configurator-grid > div:last-child {
            display: none !important;
          }
          .mobile-sticky-bar { display: block; }
        }
      `}</style>
    </>
  );
}
