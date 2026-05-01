"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProductStickerConfig } from "@/lib/sticker-catalog-actions";
import type {
  StickerShape,
  StickerSize,
  StickerMaterial,
  StickerLamination,
  ProductStickerConfig,
  StickerQuantityTier,
} from "@/db/schema";

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  fontSize: 13,
  color: "#0A0E27",
  background: "#fff",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#6B7280",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 4,
};

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: "20px 24px",
  marginBottom: 16,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {children}
    </h3>
  );
}

function ToggleChip({
  active,
  label,
  sublabel,
  onClick,
}: {
  active: boolean;
  label: string;
  sublabel?: string | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: 8,
        border: `2px solid ${active ? "#0A0E27" : "#E5E7EB"}`,
        background: active ? "#0A0E27" : "#fff",
        color: active ? "#fff" : "#374151",
        cursor: "pointer",
        minWidth: 90,
        gap: 2,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
      {sublabel && <span style={{ fontSize: 10, opacity: 0.7 }}>{sublabel}</span>}
    </button>
  );
}

function OptionCard({
  active, title, subtitle, onToggle, children,
}: {
  active: boolean; title: string; subtitle?: string | undefined;
  onToggle: () => void; children?: React.ReactNode;
}) {
  return (
    <div style={{
      border: `2px solid ${active ? "#0A0E27" : "#E5E7EB"}`,
      borderRadius: 10, padding: "10px 14px",
      background: active ? "#F8F9FF" : "#fff",
      transition: "border-color 0.15s",
    }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: active && children ? 10 : 0, cursor: "pointer" }}>
        <div style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          border: `2px solid ${active ? "#0A0E27" : "#D1D5DB"}`,
          background: active ? "#0A0E27" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {active && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0A0E27" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: "#6B7280" }}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function ModifierOverrideInput({
  id, globalType, globalValue, overrides, setOverrides,
}: {
  id: string; globalType: string; globalValue: number;
  overrides: Record<string, string>;
  setOverrides: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
}) {
  const label = globalType === "multiplier" ? "Multiplicateur (×)"
    : globalType === "percentage" ? "Pourcentage (%)"
    : globalType === "fixed" ? "Supplément fixe (€ cts)"
    : "Modificateur";
  const placeholder = globalType === "multiplier" ? `${globalValue} (global)`
    : globalType === "percentage" ? `${globalValue} (global)`
    : `${globalValue} (global)`;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <label style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
        {label} — ce produit
      </label>
      <input
        type="number" step="0.01" min="0"
        value={overrides[id] ?? ""}
        onChange={(e) => setOverrides((prev) => ({ ...prev, [id]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid #D1D5DB", fontSize: 13, boxSizing: "border-box" as const }}
      />
      <p style={{ fontSize: 10, color: "#9CA3AF", margin: "3px 0 0" }}>
        Laissez vide pour utiliser la valeur du catalogue
      </p>
    </div>
  );
}

export function StickerConfigTab({
  productId,
  config: initialConfig,
  shapes: allShapes,
  sizes: allSizes,
  materials: allMaterials,
  laminations: allLaminations,
}: {
  productId: string;
  config: ProductStickerConfig | null;
  shapes: StickerShape[];
  sizes: StickerSize[];
  materials: StickerMaterial[];
  laminations: StickerLamination[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [enabledShapeIds, setEnabledShapeIds] = useState<string[]>(initialConfig?.enabledShapeIds ?? []);
  const [shapeModifierOverrides, setShapeModifierOverrides] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries((initialConfig?.shapeModifierOverrides as Record<string, number> | undefined) ?? {})
        .map(([id, v]) => [id, String(v)])
    )
  );
  const [enabledSizeIds, setEnabledSizeIds] = useState<string[]>(initialConfig?.enabledSizeIds ?? []);
  const [sizePriceOverrides, setSizePriceOverrides] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries((initialConfig?.sizePriceOverrides as Record<string, number> | undefined) ?? {})
        .map(([id, cents]) => [id, (cents / 100).toFixed(2)])
    )
  );
  const [enabledMaterialIds, setEnabledMaterialIds] = useState<string[]>(initialConfig?.enabledMaterialIds ?? []);
  const [materialModifierOverrides, setMaterialModifierOverrides] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries((initialConfig?.materialModifierOverrides as Record<string, number> | undefined) ?? {})
        .map(([id, v]) => [id, String(v)])
    )
  );
  const [enabledLaminationIds, setEnabledLaminationIds] = useState<string[]>(initialConfig?.enabledLaminationIds ?? []);
  const [laminationModifierOverrides, setLaminationModifierOverrides] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries((initialConfig?.laminationModifierOverrides as Record<string, number> | undefined) ?? {})
        .map(([id, v]) => [id, String(v)])
    )
  );
  const [allowCustomWidth, setAllowCustomWidth] = useState(initialConfig?.allowCustomWidth ?? false);
  const [allowCustomHeight, setAllowCustomHeight] = useState(initialConfig?.allowCustomHeight ?? false);
  const [minWidthMm, setMinWidthMm] = useState(initialConfig?.minWidthMm ?? 20);
  const [maxWidthMm, setMaxWidthMm] = useState(initialConfig?.maxWidthMm ?? 1000);
  const [minHeightMm, setMinHeightMm] = useState(initialConfig?.minHeightMm ?? 20);
  const [maxHeightMm, setMaxHeightMm] = useState(initialConfig?.maxHeightMm ?? 1000);

  const [requireFileUpload, setRequireFileUpload] = useState(initialConfig?.requireFileUpload ?? true);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(initialConfig?.maxFileSizeMb ?? 100);

  const [pricingMode, setPricingMode] = useState<"per_cm2" | "unit_price">(
    (initialConfig?.pricingMode as "per_cm2" | "unit_price" | undefined) ?? "per_cm2"
  );
  const [pricePerCm2, setPricePerCm2] = useState(
    initialConfig ? (initialConfig.pricePerCm2Cents / 100).toFixed(4) : "0.0150"
  );
  const [baseUnitPrice, setBaseUnitPrice] = useState(
    initialConfig ? (initialConfig.baseUnitPriceCents / 100).toFixed(2) : "1.00"
  );
  const [setupFee, setSetupFee] = useState(
    initialConfig ? (initialConfig.setupFeeCents / 100).toFixed(2) : "0.00"
  );
  const [minOrder, setMinOrder] = useState(
    initialConfig ? (initialConfig.minOrderCents / 100).toFixed(2) : "0.00"
  );

  const [tiers, setTiers] = useState<StickerQuantityTier[]>(
    initialConfig?.quantityTiers ?? [
      { minQty: 1, discountPct: 0 },
      { minQty: 50, discountPct: 10 },
      { minQty: 100, discountPct: 20 },
      { minQty: 250, discountPct: 30 },
      { minQty: 500, discountPct: 40 },
    ]
  );

  function toggle(id: string, current: string[], set: (ids: string[]) => void) {
    if (current.includes(id)) {
      set(current.filter((x) => x !== id));
    } else {
      set([...current, id]);
    }
  }

  async function handleSave() {
    startTransition(async () => {
      await upsertProductStickerConfig(productId, {
        enabledShapeIds,
        shapeModifierOverrides: Object.fromEntries(
          Object.entries(shapeModifierOverrides)
            .filter(([id, val]) => enabledShapeIds.includes(id) && val.trim() !== "")
            .map(([id, val]) => [id, parseFloat(val)])
            .filter(([, v]) => !isNaN(v as number))
        ),
        enabledSizeIds,
        sizePriceOverrides: Object.fromEntries(
          Object.entries(sizePriceOverrides)
            .filter(([id, val]) => enabledSizeIds.includes(id) && val.trim() !== "")
            .map(([id, val]) => [id, Math.round(parseFloat(val) * 100)])
            .filter(([, cents]) => !isNaN(cents as number))
        ),
        enabledMaterialIds,
        materialModifierOverrides: Object.fromEntries(
          Object.entries(materialModifierOverrides)
            .filter(([id, val]) => enabledMaterialIds.includes(id) && val.trim() !== "")
            .map(([id, val]) => [id, parseFloat(val)])
            .filter(([, v]) => !isNaN(v as number))
        ),
        enabledLaminationIds,
        laminationModifierOverrides: Object.fromEntries(
          Object.entries(laminationModifierOverrides)
            .filter(([id, val]) => enabledLaminationIds.includes(id) && val.trim() !== "")
            .map(([id, val]) => [id, parseFloat(val)])
            .filter(([, v]) => !isNaN(v as number))
        ),
        allowCustomWidth,
        allowCustomHeight,
        minWidthMm,
        maxWidthMm,
        minHeightMm,
        maxHeightMm,
        requireFileUpload,
        allowedFileExtensions: ["pdf", "ai", "eps", "svg", "png", "jpg", "jpeg"],
        maxFileSizeMb,
        defaultShapeId: null,
        defaultMaterialId: null,
        defaultLaminationId: null,
        pricingMode,
        pricePerCm2Cents: Math.round(parseFloat(pricePerCm2) * 100),
        baseUnitPriceCents: Math.round(parseFloat(baseUnitPrice) * 100),
        quantityTiers: tiers,
        setupFeeCents: Math.round(parseFloat(setupFee) * 100),
        minOrderCents: Math.round(parseFloat(minOrder) * 100),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Prix de base */}
      <div style={sectionStyle}>
        <SectionTitle>Moteur de prix</SectionTitle>

        {/* Sélecteur de mode */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Mode de tarification</label>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setPricingMode("per_cm2")}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: `2px solid ${pricingMode === "per_cm2" ? "#0A0E27" : "#E5E7EB"}`,
                background: pricingMode === "per_cm2" ? "#0A0E27" : "#fff",
                color: pricingMode === "per_cm2" ? "#fff" : "#374151",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Prix au cm²
            </button>
            <button
              type="button"
              onClick={() => setPricingMode("unit_price")}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: `2px solid ${pricingMode === "unit_price" ? "#0A0E27" : "#E5E7EB"}`,
                background: pricingMode === "unit_price" ? "#0A0E27" : "#fff",
                color: pricingMode === "unit_price" ? "#fff" : "#374151",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Prix unitaire fixe
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
            {pricingMode === "per_cm2"
              ? "Le prix dépend de la surface (largeur × hauteur). Idéal pour les stickers personnalisés en toute taille."
              : "Un prix fixe par unité, indépendant de la taille. Idéal pour des formats standardisés."}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            {pricingMode === "per_cm2" ? (
              <>
                <label style={labelStyle}>Prix / cm² HT (€)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={pricePerCm2}
                    onChange={(e) => setPricePerCm2(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 32 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF" }}>€</span>
                </div>
                <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                  Ex : 0.0150 € = 1,50 € pour 100 cm² (10×10 cm)
                </p>
              </>
            ) : (
              <>
                <label style={labelStyle}>Prix unitaire HT (€)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseUnitPrice}
                    onChange={(e) => setBaseUnitPrice(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 32 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF" }}>€</span>
                </div>
                <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                  Prix HT par unité avant remise quantité et modificateurs
                </p>
              </>
            )}
          </div>
          <div>
            <label style={labelStyle}>Frais de setup HT (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={setupFee}
              onChange={(e) => setSetupFee(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Commande minimum HT (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Paliers de remise (quantité)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 500 }}>
            {tiers.map((tier, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#9CA3AF", minWidth: 100 }}>À partir de</span>
                <input
                  type="number"
                  min="1"
                  value={tier.minQty}
                  onChange={(e) => {
                    const t = [...tiers];
                    t[i] = { ...tier, minQty: parseInt(e.target.value) || 1 };
                    setTiers(t);
                  }}
                  style={{ ...inputStyle, maxWidth: 80 }}
                />
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>unités →</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={tier.discountPct}
                  onChange={(e) => {
                    const t = [...tiers];
                    t[i] = { ...tier, discountPct: parseFloat(e.target.value) || 0 };
                    setTiers(t);
                  }}
                  style={{ ...inputStyle, maxWidth: 70 }}
                />
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>% remise</span>
                <button
                  type="button"
                  onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                  style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #FCA5A5", background: "#FEE2E2", color: "#DC2626", fontSize: 12, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTiers([...tiers, { minQty: 1000, discountPct: 45 }])}
              style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              + Palier
            </button>
          </div>
        </div>
      </div>

      {/* Formes */}
      <div style={sectionStyle}>
        <SectionTitle>Formes disponibles</SectionTitle>
        {allShapes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Aucune forme dans le catalogue. <a href="/admin/sticker" style={{ color: "#0A0E27" }}>Configurer →</a></p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {allShapes.map((shape) => {
              const active = enabledShapeIds.includes(shape.id);
              return (
                <OptionCard
                  key={shape.id} active={active}
                  title={shape.name}
                  subtitle={shape.requiresCutPath ? "tracé requis" : undefined}
                  onToggle={() => toggle(shape.id, enabledShapeIds, setEnabledShapeIds)}
                >
                  {active && (
                    <ModifierOverrideInput
                      id={shape.id}
                      globalType={shape.priceModifierType}
                      globalValue={shape.priceModifierValue}
                      overrides={shapeModifierOverrides}
                      setOverrides={setShapeModifierOverrides}
                    />
                  )}
                </OptionCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Tailles */}
      <div style={sectionStyle}>
        <SectionTitle>Tailles prédéfinies</SectionTitle>
        {allSizes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Aucune taille dans le catalogue. <a href="/admin/sticker" style={{ color: "#0A0E27" }}>Configurer →</a></p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {allSizes.map((size) => {
              const active = enabledSizeIds.includes(size.id);
              return (
                <div
                  key={size.id}
                  style={{
                    border: `2px solid ${active ? "#0A0E27" : "#E5E7EB"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    background: active ? "#F8F9FF" : "#fff",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div
                    onClick={() => toggle(size.id, enabledSizeIds, setEnabledSizeIds)}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: active ? 10 : 0 }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 4,
                      border: `2px solid ${active ? "#0A0E27" : "#D1D5DB"}`,
                      background: active ? "#0A0E27" : "#fff",
                      flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {active && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0A0E27" }}>{size.label}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{size.widthMm} × {size.heightMm} mm</div>
                    </div>
                  </div>
                  {active && (
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 4 }}>Prix HT pour ce produit (€)</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={sizePriceOverrides[size.id] ?? ""}
                          onChange={(e) => setSizePriceOverrides((prev) => ({ ...prev, [size.id]: e.target.value }))}
                          placeholder="Calcul auto (cm² ou unitaire)"
                          style={{ ...inputStyle, paddingRight: 28, fontSize: 13 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF" }}>€</span>
                      </div>
                      <p style={{ fontSize: 10, color: "#9CA3AF", margin: "3px 0 0" }}>
                        Laissez vide pour utiliser le mode de tarification global
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={allowCustomWidth && allowCustomHeight}
              onChange={(e) => { setAllowCustomWidth(e.target.checked); setAllowCustomHeight(e.target.checked); }}
            />
            <strong>Taille libre (dimensions personnalisées)</strong>
          </label>
        </div>
        {(allowCustomWidth || allowCustomHeight) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
            {[
              { label: "Larg. min (mm)", value: minWidthMm, set: setMinWidthMm },
              { label: "Larg. max (mm)", value: maxWidthMm, set: setMaxWidthMm },
              { label: "Haut. min (mm)", value: minHeightMm, set: setMinHeightMm },
              { label: "Haut. max (mm)", value: maxHeightMm, set: setMaxHeightMm },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label style={labelStyle}>{label}</label>
                <input type="number" min="1" value={value} onChange={(e) => set(parseInt(e.target.value) || 1)} style={inputStyle} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matières */}
      <div style={sectionStyle}>
        <SectionTitle>Matières disponibles</SectionTitle>
        {allMaterials.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Aucune matière dans le catalogue. <a href="/admin/sticker" style={{ color: "#0A0E27" }}>Configurer →</a></p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {allMaterials.map((mat) => {
              const active = enabledMaterialIds.includes(mat.id);
              return (
                <OptionCard
                  key={mat.id} active={active}
                  title={mat.name}
                  subtitle={mat.isPremium ? "premium" : undefined}
                  onToggle={() => toggle(mat.id, enabledMaterialIds, setEnabledMaterialIds)}
                >
                  {active && (
                    <ModifierOverrideInput
                      id={mat.id}
                      globalType={mat.priceModifierType}
                      globalValue={mat.priceModifierValue}
                      overrides={materialModifierOverrides}
                      setOverrides={setMaterialModifierOverrides}
                    />
                  )}
                </OptionCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Laminations */}
      <div style={sectionStyle}>
        <SectionTitle>Laminations / Finitions</SectionTitle>
        {allLaminations.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Aucune lamination dans le catalogue. <a href="/admin/sticker" style={{ color: "#0A0E27" }}>Configurer →</a></p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {allLaminations.map((lam) => {
              const active = enabledLaminationIds.includes(lam.id);
              return (
                <OptionCard
                  key={lam.id} active={active}
                  title={lam.name}
                  subtitle={undefined}
                  onToggle={() => toggle(lam.id, enabledLaminationIds, setEnabledLaminationIds)}
                >
                  {active && (
                    <ModifierOverrideInput
                      id={lam.id}
                      globalType={lam.priceModifierType}
                      globalValue={lam.priceModifierValue}
                      overrides={laminationModifierOverrides}
                      setOverrides={setLaminationModifierOverrides}
                    />
                  )}
                </OptionCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Fichier client */}
      <div style={sectionStyle}>
        <SectionTitle>Fichier client</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={requireFileUpload} onChange={(e) => setRequireFileUpload(e.target.checked)} />
            <span>Fichier client obligatoire</span>
          </label>
          <div style={{ maxWidth: 200 }}>
            <label style={labelStyle}>Taille max (Mo)</label>
            <input type="number" min="1" max="500" value={maxFileSizeMb} onChange={(e) => setMaxFileSizeMb(parseInt(e.target.value) || 1)} style={inputStyle} />
          </div>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
            Extensions acceptées : PDF, AI, EPS, SVG, PNG, JPG, JPEG
          </p>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: "#0A0E27",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Enregistrement…" : "Enregistrer la configuration"}
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "#007F5F", fontWeight: 600 }}>✓ Configuration enregistrée</span>
        )}
      </div>
    </div>
  );
}
