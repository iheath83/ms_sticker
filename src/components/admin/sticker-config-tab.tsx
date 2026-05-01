"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProductStickerConfig } from "@/lib/sticker-catalog-actions";
import type {
  StickerShape,
  StickerSize,
  StickerMaterial,
  StickerLamination,
  StickerCutType,
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

export function StickerConfigTab({
  productId,
  config: initialConfig,
  shapes: allShapes,
  sizes: allSizes,
  materials: allMaterials,
  laminations: allLaminations,
  cutTypes: allCutTypes,
}: {
  productId: string;
  config: ProductStickerConfig | null;
  shapes: StickerShape[];
  sizes: StickerSize[];
  materials: StickerMaterial[];
  laminations: StickerLamination[];
  cutTypes: StickerCutType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [enabledShapeIds, setEnabledShapeIds] = useState<string[]>(initialConfig?.enabledShapeIds ?? []);
  const [enabledSizeIds, setEnabledSizeIds] = useState<string[]>(initialConfig?.enabledSizeIds ?? []);
  const [enabledMaterialIds, setEnabledMaterialIds] = useState<string[]>(initialConfig?.enabledMaterialIds ?? []);
  const [enabledLaminationIds, setEnabledLaminationIds] = useState<string[]>(initialConfig?.enabledLaminationIds ?? []);
  const [enabledCutTypeIds, setEnabledCutTypeIds] = useState<string[]>(initialConfig?.enabledCutTypeIds ?? []);

  const [allowCustomWidth, setAllowCustomWidth] = useState(initialConfig?.allowCustomWidth ?? false);
  const [allowCustomHeight, setAllowCustomHeight] = useState(initialConfig?.allowCustomHeight ?? false);
  const [minWidthMm, setMinWidthMm] = useState(initialConfig?.minWidthMm ?? 20);
  const [maxWidthMm, setMaxWidthMm] = useState(initialConfig?.maxWidthMm ?? 1000);
  const [minHeightMm, setMinHeightMm] = useState(initialConfig?.minHeightMm ?? 20);
  const [maxHeightMm, setMaxHeightMm] = useState(initialConfig?.maxHeightMm ?? 1000);

  const [requireFileUpload, setRequireFileUpload] = useState(initialConfig?.requireFileUpload ?? true);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(initialConfig?.maxFileSizeMb ?? 100);

  const [pricePerCm2, setPricePerCm2] = useState(
    initialConfig ? (initialConfig.pricePerCm2Cents / 100).toFixed(4) : "0.0150"
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
        enabledSizeIds,
        enabledMaterialIds,
        enabledLaminationIds,
        enabledCutTypeIds,
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
        defaultCutTypeId: null,
        pricePerCm2Cents: Math.round(parseFloat(pricePerCm2) * 100),
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
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
              Ex: 0.0150 € = 1.50 € pour 100 cm² (sticker 10×10 cm)
            </p>
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allShapes.map((shape) => (
              <ToggleChip
                key={shape.id}
                active={enabledShapeIds.includes(shape.id)}
                label={shape.name}
                {...(shape.requiresCutPath ? { sublabel: "tracé requis" } : {})}
                onClick={() => toggle(shape.id, enabledShapeIds, setEnabledShapeIds)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tailles */}
      <div style={sectionStyle}>
        <SectionTitle>Tailles prédéfinies</SectionTitle>
        {allSizes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Aucune taille dans le catalogue. <a href="/admin/sticker" style={{ color: "#0A0E27" }}>Configurer →</a></p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allSizes.map((size) => (
              <ToggleChip
                key={size.id}
                active={enabledSizeIds.includes(size.id)}
                label={size.label}
                sublabel={`${size.widthMm}×${size.heightMm}mm`}
                onClick={() => toggle(size.id, enabledSizeIds, setEnabledSizeIds)}
              />
            ))}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allMaterials.map((mat) => (
              <ToggleChip
                key={mat.id}
                active={enabledMaterialIds.includes(mat.id)}
                label={mat.name}
                {...(mat.isPremium ? { sublabel: "premium" } : mat.priceModifierValue !== 1 ? { sublabel: `×${mat.priceModifierValue}` } : {})}
                onClick={() => toggle(mat.id, enabledMaterialIds, setEnabledMaterialIds)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Laminations */}
      <div style={sectionStyle}>
        <SectionTitle>Laminations / Finitions</SectionTitle>
        {allLaminations.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Aucune lamination dans le catalogue. <a href="/admin/sticker" style={{ color: "#0A0E27" }}>Configurer →</a></p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allLaminations.map((lam) => (
              <ToggleChip
                key={lam.id}
                active={enabledLaminationIds.includes(lam.id)}
                label={lam.name}
                {...(lam.priceModifierValue !== 1 ? { sublabel: `×${lam.priceModifierValue}` } : {})}
                onClick={() => toggle(lam.id, enabledLaminationIds, setEnabledLaminationIds)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Types de découpe */}
      <div style={sectionStyle}>
        <SectionTitle>Types de découpe</SectionTitle>
        {allCutTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Aucun type de découpe dans le catalogue. <a href="/admin/sticker" style={{ color: "#0A0E27" }}>Configurer →</a></p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allCutTypes.map((ct) => (
              <ToggleChip
                key={ct.id}
                active={enabledCutTypeIds.includes(ct.id)}
                label={ct.name}
                {...(ct.requiresCutPath ? { sublabel: "tracé requis" } : ct.priceModifierValue !== 1 ? { sublabel: `×${ct.priceModifierValue}` } : {})}
                onClick={() => toggle(ct.id, enabledCutTypeIds, setEnabledCutTypeIds)}
              />
            ))}
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
