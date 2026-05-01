"use client";

import { useState, useCallback, useTransition, useEffect, useRef } from "react";
import type {
  StickerShape,
  StickerSize,
  StickerMaterial,
  StickerLamination,
  ProductStickerConfig,
} from "@/db/schema";
import { addToCart } from "@/lib/cart-actions";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceResult {
  surfaceCm2: number;
  quantityDiscountPct: number;
  materialMultiplier: number;
  laminationMultiplier: number;
  shapeMultiplier: number;
  unitPriceCents: number;
  subtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
  setupFeeCents: number;
  shape: { id: string; name: string; code: string };
  material: { id: string; name: string };
  lamination: { id: string; name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatEurUnit(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ number, title, current }: { number: string; title: string; current: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: "50%", background: "#0A0E27",
          color: "#fff", fontSize: 13, fontWeight: 800,
        }}>
          {number}
        </span>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0A0E27", fontFamily: "var(--font-archivo, system-ui)" }}>
          {title}
        </h2>
      </div>
      {current && (
        <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>→ {current}</span>
      )}
    </div>
  );
}

function OptionCard({
  active,
  label,
  sublabel,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  sublabel?: string | undefined;
  badge?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        padding: "14px 20px",
        borderRadius: 12,
        border: `2.5px solid ${active ? "#0A0E27" : "#E5E7EB"}`,
        background: active ? "#0A0E27" : "#fff",
        color: active ? "#fff" : "#374151",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 120,
        transition: "all 0.15s",
        boxShadow: active ? "0 2px 8px rgba(10,14,39,0.18)" : "none",
      }}
    >
      {badge && (
        <span style={{
          position: "absolute", top: -8, left: 12,
          background: "#FF385C", color: "#fff",
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
        }}>
          {badge}
        </span>
      )}
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{sublabel}</div>}
    </button>
  );
}

// ─── Main Configurator ───────────────────────────────────────────────────────

export function StickerConfigurator({
  productId,
  productName,
  imageUrl,
  config,
  shapes,
  sizes,
  materials,
  laminations,
}: {
  productId: string;
  productName: string;
  imageUrl?: string;
  config: ProductStickerConfig;
  shapes: StickerShape[];
  sizes: StickerSize[];
  materials: StickerMaterial[];
  laminations: StickerLamination[];
}) {
  const router = useRouter();
  const [addPending, startAddTransition] = useTransition();

  const [selectedShapeId, setSelectedShapeId] = useState<string>(shapes[0]?.id ?? "");
  const [selectedSizeId, setSelectedSizeId] = useState<string>(sizes[0]?.id ?? "");
  const [customWidth, setCustomWidth] = useState(config.minWidthMm);
  const [customHeight, setCustomHeight] = useState(config.minHeightMm);
  const [useCustomSize, setUseCustomSize] = useState(false);
  const [quantity, setQuantity] = useState(50);
  const [customQuantity, setCustomQuantity] = useState("");
  const [useCustomQty, setUseCustomQty] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(materials[0]?.id ?? "");
  const [selectedLaminationId, setSelectedLaminationId] = useState<string | null>(
    laminations.find((l) => l.isDefault)?.id ?? laminations[0]?.id ?? null
  );
  const [customerNote, setCustomerNote] = useState("");

  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const priceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedSize = sizes.find((s) => s.id === selectedSizeId);
  const widthMm = useCustomSize ? customWidth : (selectedSize?.widthMm ?? config.minWidthMm);
  const heightMm = useCustomSize ? customHeight : (selectedSize?.heightMm ?? config.minHeightMm);
  const currentQty = useCustomQty ? parseInt(customQuantity) || 1 : quantity;

  const QUICK_QUANTITIES = [50, 100, 250, 500, 1000];

  // Filter compatible laminations based on selected material
  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);
  const compatibleLaminations = laminations.filter((l) => {
    if (!selectedMaterial || !l.compatibleMaterialCodes.length) return true;
    return l.compatibleMaterialCodes.includes(selectedMaterial.code);
  });

  const calculatePrice = useCallback(async () => {
    if (!selectedShapeId || !selectedMaterialId) return;
    if (currentQty < 1) return;

    setPriceLoading(true);
    try {
      const res = await fetch("/api/stickers/calculate-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          shapeId: selectedShapeId,
          widthMm,
          heightMm,
          quantity: currentQty,
          materialId: selectedMaterialId,
          laminationId: selectedLaminationId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPriceResult(data);
      }
    } finally {
      setPriceLoading(false);
    }
  }, [productId, selectedShapeId, widthMm, heightMm, currentQty, selectedMaterialId, selectedLaminationId]);

  useEffect(() => {
    if (priceTimeout.current) clearTimeout(priceTimeout.current);
    priceTimeout.current = setTimeout(calculatePrice, 300);
    return () => { if (priceTimeout.current) clearTimeout(priceTimeout.current); };
  }, [calculatePrice]);

  async function handleAddToCart() {
    if (!priceResult || !selectedShapeId || !selectedMaterialId) return;

    startAddTransition(async () => {
      const shape = shapes.find((s) => s.id === selectedShapeId)!;
      const material = materials.find((m) => m.id === selectedMaterialId)!;
      const lamination = selectedLaminationId ? laminations.find((l) => l.id === selectedLaminationId) : null;

      await addToCart({
        productId,
        productName,
        quantity: currentQty,
        unitPriceCents: priceResult.unitPriceCents,
        ...(customerNote ? { customizationNote: customerNote } : {}),
        stickerConfig: {
          shapeId: shape.id,
          shapeName: shape.name,
          shapeCode: shape.code,
          widthMm,
          heightMm,
          quantity: currentQty,
          materialId: material.id,
          materialName: material.name,
          ...(lamination ? { laminationId: lamination.id, laminationName: lamination.name } : {}),
          ...(customerNote ? { customerNote } : {}),
          pricingSnapshot: {
            pricePerCm2Cents: config.pricePerCm2Cents,
            surfaceCm2: priceResult.surfaceCm2,
            quantityDiscountPct: priceResult.quantityDiscountPct,
            materialMultiplier: priceResult.materialMultiplier,
            laminationMultiplier: priceResult.laminationMultiplier,
            shapeMultiplier: priceResult.shapeMultiplier,
            setupFeeCents: priceResult.setupFeeCents,
            unitPriceCents: priceResult.unitPriceCents,
            subtotalCents: priceResult.subtotalCents,
          },
        },
      });

      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 3000);
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>

      {/* ─── Left column: Steps ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Step 1 — Forme */}
        <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "24px 28px" }}>
          <StepHeader
            number="01"
            title="Forme"
            current={shapes.find((s) => s.id === selectedShapeId)?.name ?? ""}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {shapes.map((shape) => (
              <OptionCard
                key={shape.id}
                active={selectedShapeId === shape.id}
                label={shape.name}
                {...(shape.requiresCutPath
                  ? { sublabel: "Tracé vectoriel requis" }
                  : shape.description
                  ? { sublabel: shape.description }
                  : {})}
                onClick={() => setSelectedShapeId(shape.id)}
              />
            ))}
          </div>
          {shapes.find((s) => s.id === selectedShapeId)?.requiresCutPath && (
            <p style={{ marginTop: 12, fontSize: 12, color: "#B45309", background: "#FFFBEB", padding: "8px 12px", borderRadius: 8, border: "1px solid #FDE68A" }}>
              ⚠️ Cette forme nécessite un fichier vectoriel avec tracé de découpe (PDF, AI, EPS ou SVG).
            </p>
          )}
        </section>

        {/* Step 2 — Taille */}
        <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "24px 28px" }}>
          <StepHeader
            number="02"
            title="Taille"
            current={useCustomSize ? `${customWidth}×${customHeight} mm (personnalisée)` : selectedSize?.label ?? ""}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            {sizes.map((size) => (
              <OptionCard
                key={size.id}
                active={!useCustomSize && selectedSizeId === size.id}
                label={size.label}
                sublabel={`${size.widthMm}×${size.heightMm} mm`}
                onClick={() => { setSelectedSizeId(size.id); setUseCustomSize(false); }}
              />
            ))}
            {config.allowCustomWidth && config.allowCustomHeight && (
              <OptionCard
                active={useCustomSize}
                label="Personnalisée"
                sublabel="+ dimensions libres"
                onClick={() => setUseCustomSize(true)}
              />
            )}
          </div>
          {useCustomSize && (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 4 }}>LARGEUR (mm)</label>
                <input
                  type="number"
                  min={config.minWidthMm}
                  max={config.maxWidthMm}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Math.min(config.maxWidthMm, Math.max(config.minWidthMm, parseInt(e.target.value) || config.minWidthMm)))}
                  style={{ width: 100, padding: "8px 12px", border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <span style={{ fontSize: 20, color: "#9CA3AF", marginTop: 18 }}>×</span>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", display: "block", marginBottom: 4 }}>HAUTEUR (mm)</label>
                <input
                  type="number"
                  min={config.minHeightMm}
                  max={config.maxHeightMm}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Math.min(config.maxHeightMm, Math.max(config.minHeightMm, parseInt(e.target.value) || config.minHeightMm)))}
                  style={{ width: 100, padding: "8px 12px", border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <span style={{ fontSize: 13, color: "#9CA3AF", marginTop: 18 }}>
                Surface : {((customWidth * customHeight) / 100).toFixed(1)} cm²
              </span>
            </div>
          )}
        </section>

        {/* Step 3 — Quantité */}
        <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "24px 28px" }}>
          <StepHeader
            number="03"
            title="Quantité"
            current={`${currentQty} stickers`}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            {QUICK_QUANTITIES.map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => { setQuantity(qty); setUseCustomQty(false); }}
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: `2px solid ${!useCustomQty && quantity === qty ? "#0A0E27" : "#E5E7EB"}`,
                  background: !useCustomQty && quantity === qty ? "#0A0E27" : "#fff",
                  color: !useCustomQty && quantity === qty ? "#fff" : "#374151",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  minWidth: 70,
                }}
              >
                {qty}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseCustomQty(true)}
              style={{
                padding: "12px 20px",
                borderRadius: 10,
                border: `2px solid ${useCustomQty ? "#0A0E27" : "#E5E7EB"}`,
                background: useCustomQty ? "#0A0E27" : "#fff",
                color: useCustomQty ? "#fff" : "#374151",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Autre
            </button>
          </div>
          {useCustomQty && (
            <input
              type="number"
              min={1}
              value={customQuantity}
              onChange={(e) => setCustomQuantity(e.target.value)}
              placeholder="Entrez une quantité"
              style={{ width: 200, padding: "10px 14px", border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 14 }}
            />
          )}
          {priceResult && priceResult.quantityDiscountPct > 0 && (
            <p style={{ marginTop: 10, fontSize: 13, color: "#059669", fontWeight: 600 }}>
              ✓ Remise quantité -{priceResult.quantityDiscountPct}% appliquée
            </p>
          )}
        </section>

        {/* Step 4 — Matière */}
        <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "24px 28px" }}>
          <StepHeader
            number="04"
            title="Matière"
            current={materials.find((m) => m.id === selectedMaterialId)?.name ?? ""}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {materials.map((mat) => (
              <OptionCard
                key={mat.id}
                active={selectedMaterialId === mat.id}
                label={mat.name}
                {...(mat.description ? { sublabel: mat.description } : {})}
                {...(mat.isPremium ? { badge: "Premium" } : {})}
                onClick={() => {
                  setSelectedMaterialId(mat.id);
                  if (selectedLaminationId && mat.compatibleLaminationCodes.length > 0) {
                    const lam = laminations.find((l) => l.id === selectedLaminationId);
                    if (lam && !mat.compatibleLaminationCodes.includes(lam.code)) {
                      setSelectedLaminationId(laminations.find((l) => l.isDefault)?.id ?? null);
                    }
                  }
                }}
              />
            ))}
          </div>
        </section>

        {/* Step 5 — Lamination */}
        {laminations.length > 0 && (
          <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "24px 28px" }}>
            <StepHeader
              number="05"
              title="Finition"
              current={laminations.find((l) => l.id === selectedLaminationId)?.name ?? "Aucune"}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {compatibleLaminations.map((lam) => (
                <OptionCard
                  key={lam.id}
                  active={selectedLaminationId === lam.id}
                  label={lam.name}
                  {...(lam.description
                    ? { sublabel: lam.description }
                    : lam.priceModifierValue !== 1
                    ? { sublabel: `×${lam.priceModifierValue}` }
                    : {})}
                  onClick={() => setSelectedLaminationId(lam.id)}
                />
              ))}
              {laminations.some((l) => !compatibleLaminations.includes(l)) && (
                <p style={{ width: "100%", fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                  Certaines finitions ne sont pas compatibles avec la matière sélectionnée.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Note client */}
        {config.requireFileUpload && (
          <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "24px 28px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: "#0A0E27" }}>
              Note pour la production
            </h3>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Instructions particulières, lien fichier, etc."
              rows={3}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #D1D5DB", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </section>
        )}
      </div>

      {/* ─── Right column: Price summary ─────────────────────────────────── */}
      <div style={{ position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#0A0E27", color: "#fff", borderRadius: 16, padding: "24px", border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Votre devis
            </h3>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
              background: priceLoading ? "#374151" : "#22C55E", color: "#fff",
            }}>
              {priceLoading ? "Calcul…" : "LIVE"}
            </span>
          </div>

          {/* Summary lines */}
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.8 }}>
              <span>Quantité</span>
              <span style={{ fontWeight: 600 }}>{currentQty} pcs</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.8 }}>
              <span>Taille</span>
              <span style={{ fontWeight: 600 }}>{widthMm}×{heightMm} mm</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.8 }}>
              <span>Matière</span>
              <span style={{ fontWeight: 600 }}>{materials.find((m) => m.id === selectedMaterialId)?.name ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.8 }}>
              <span>Finition</span>
              <span style={{ fontWeight: 600 }}>{laminations.find((l) => l.id === selectedLaminationId)?.name ?? "Sans"}</span>
            </div>
          </div>

          {/* Price */}
          {priceResult ? (
            <>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-1px" }}>
                  {formatEur(priceResult.totalCents)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>TVA 20% incluse</div>
                {priceResult.unitPriceCents > 0 && (
                  <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
                    soit {formatEurUnit(priceResult.unitPriceCents)} / sticker
                  </div>
                )}
              </div>
              {priceResult.quantityDiscountPct > 0 && (
                <div style={{ background: "rgba(34,197,94,0.15)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#86EFAC", fontWeight: 600 }}>
                  Vous économisez {priceResult.quantityDiscountPct}% grâce à la remise quantité
                </div>
              )}
            </>
          ) : (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 900, opacity: 0.4 }}>— €</div>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addPending || priceLoading || !priceResult}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 10,
              border: "none",
              background: addedToCart ? "#059669" : "#FF385C",
              color: "#fff",
              fontWeight: 800,
              fontSize: 16,
              cursor: addPending || !priceResult ? "not-allowed" : "pointer",
              opacity: !priceResult ? 0.5 : 1,
              transition: "background 0.2s",
              letterSpacing: "0.02em",
            }}
          >
            {addPending ? "Ajout en cours…" : addedToCart ? "✓ Ajouté au panier" : "Commander maintenant →"}
          </button>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "Épreuve numérique gratuite",
              "Livraison 48h · offerte dès 50€",
              "Paiement sécurisé · SSL",
            ].map((feat) => (
              <div key={feat} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.7 }}>
                <span>✓</span>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quantity discount table */}
        {config.quantityTiers.length > 0 && (
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0A0E27", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Tarifs dégressifs
              </h4>
              {selectedSize && !useCustomSize && (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{selectedSize.label}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {config.quantityTiers.map((tier, i) => {
                const isActive = currentQty >= tier.minQty && (i === config.quantityTiers.length - 1 || currentQty < config.quantityTiers[i + 1]!.minQty);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: isActive ? "#EFF6FF" : "transparent",
                      border: isActive ? "1px solid #BFDBFE" : "1px solid transparent",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 400, color: isActive ? "#1D4ED8" : "#374151" }}>
                      {tier.minQty}+ pcs
                    </span>
                    {tier.discountPct > 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                        background: isActive ? "#DBEAFE" : "#F3F4F6",
                        color: isActive ? "#1D4ED8" : "#6B7280",
                      }}>
                        -{tier.discountPct}%
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>tarif normal</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
