"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StickerPreview, type StickerColor, type StickerMaterial, type StickerShape } from "../sticker-preview";
import { StarIcon, CheckIcon, UploadIcon } from "../icons";
import { OrderSummary } from "./order-summary";
import { StepperLayout } from "./stepper-layout";
import { computePrice, QUANTITY_TIERS, SIZE_MM, type PricingSize, type PricingShape, type PricingMaterial, type PricingFinish, type PricingTier, type CustomPreset } from "@/lib/pricing";
import { useCart } from "../cart-context";
import type { Product } from "@/db/schema";
import type { AddToCartInput } from "@/lib/cart-types";
import { materialToPreview } from "@/lib/product-utils";

export interface ConfigState {
  shape: PricingShape;
  size: PricingSize;
  customPresetId?: string; // id of a CustomPreset, when size === "custom" from a preset
  material: PricingMaterial;
  finish: PricingFinish;
  qty: number;
  color: StickerColor;
  customWidth?: number;
  customHeight?: number;
}

interface UploadedFile {
  name: string;
  size: string;
  file: File;
}

function OptionCard({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 12,
        background: active ? "#FEF2F2" : "var(--white)",
        border: `1.5px solid ${active ? "var(--red)" : "var(--grey-200)"}`,
        borderRadius: "var(--r)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-mono), monospace",
        boxShadow: active ? "inset 0 0 0 1px var(--red)" : "none",
        transition: "all 0.1s",
        width: "100%",
      }}
    >
      {children}
    </button>
  );
}

function ConfigSection({
  num,
  title,
  value,
  children,
}: {
  num: string;
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--white)",
        border: "1.5px solid var(--grey-200)",
        borderRadius: "var(--r-lg)",
        padding: 24,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700, letterSpacing: "0.15em" }}>
            ◆ {num}
          </span>
          <h3
            style={{
              fontSize: 20,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 800,
            }}
          >
            {title}
          </h3>
        </div>
        <div style={{ fontSize: 12, color: "var(--grey-600)" }}>
          → <b style={{ color: "var(--ink)" }}>{value}</b>
        </div>
      </div>
      {children}
    </div>
  );
}

const MATERIAL_VISUALS: Record<string, { bg: string; border: string; label: string }> = {
  vinyl:        { bg: "#fff", border: "var(--grey-200)", label: "Vinyle" },
  holographic:  { bg: "linear-gradient(135deg, #ff9ee5, #a6f0ff, #ffea93, #b3a1ff)", border: "transparent", label: "Holo" },
  glitter:      { bg: "radial-gradient(circle at 30% 30%, #fff 1%, transparent 3%), #DC2626", border: "transparent", label: "Pailleté" },
  transparent:  { bg: "repeating-linear-gradient(45deg, #f0f0f0 0, #f0f0f0 4px, #fff 4px, #fff 8px)", border: "var(--grey-200)", label: "Transparent" },
  kraft:        { bg: "#c8a96e", border: "transparent", label: "Kraft" },
};

/** Default basePriceCents when no product in DB */
const DEFAULT_BASE_PRICE_CENTS = 2490;


interface ProductConfiguratorProps {
  products?: Product[];
  defaultMaterial?: PricingMaterial;
  defaultShape?: PricingShape;
  productName?: string;
  description?: string | undefined;
  imageUrl?: string | undefined;
  features?: string[] | undefined;
  pricingTiers?: ReadonlyArray<PricingTier> | undefined;
  availableFinishes?: PricingFinish[] | undefined;
  availableSizes?: PricingSize[] | undefined;
  minQty?: number | undefined;
  sizePrices?: Record<string, number> | undefined;
  customPresets?: CustomPreset[] | undefined;
}

export function ProductConfigurator({
  products,
  defaultMaterial = "vinyl",
  defaultShape = "die-cut",
  productName,
  description,
  imageUrl,
  features,
  pricingTiers = QUANTITY_TIERS,
  availableFinishes,
  availableSizes,
  minQty = 1,
  sizePrices,
  customPresets = [],
}: ProductConfiguratorProps) {
  const router = useRouter();
  const { addToCart: addToCartAction, refreshCart, setCartOpen } = useCart();
  const [layout] = useState<"columns" | "stepper">("columns");
  const defaultSize: PricingSize = availableSizes?.includes("5x5") ? "5x5" : (availableSizes?.[0] ?? "5x5");
  const defaultFinish: PricingFinish = availableFinishes?.includes("gloss") ? "gloss" : (availableFinishes?.[0] ?? "gloss");

  const [config, setConfig] = useState<ConfigState>({
    shape: defaultShape,
    size: defaultSize,
    material: defaultMaterial,
    finish: defaultFinish,
    qty: Math.max(minQty, pricingTiers[0]?.minQty === 1 ? 300 : (pricingTiers[0]?.minQty ?? 300)),
    color: "red",
  });
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState(1);
  const [addLoading, setAddLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  // Get basePriceCents from matching product or default
  function getBasePriceCents(): number {
    if (products && products.length > 0) {
      const match = products.find((p) => materialToPreview(p.material) === config.material);
      return match?.basePriceCents ?? products[0]?.basePriceCents ?? DEFAULT_BASE_PRICE_CENTS;
    }
    return DEFAULT_BASE_PRICE_CENTS;
  }

  function getProductId(): string | undefined {
    if (products && products.length > 0) {
      const match = products.find((p) => materialToPreview(p.material) === config.material);
      return match?.id ?? products[0]?.id;
    }
    return undefined;
  }

  function getDimensions(): [number, number] {
    // Custom preset selected
    if (config.customPresetId) {
      const preset = customPresets.find((p) => p.id === config.customPresetId);
      if (preset) return [preset.widthMm, preset.heightMm];
    }
    if (config.size === "custom") {
      return [config.customWidth ?? 60, config.customHeight ?? 60];
    }
    return SIZE_MM[config.size];
  }

  function makePricingInput(overrideQty?: number) {
    // Custom preset price takes precedence
    const presetPrice = config.customPresetId ? sizePrices?.[config.customPresetId] : undefined;
    const sizeKey = config.size;
    const explicitPrice = presetPrice ?? (sizeKey !== "custom" ? sizePrices?.[sizeKey] : undefined);
    const [w, h] = explicitPrice ? [50, 50] : getDimensions();
    return {
      product: {
        basePriceCents: explicitPrice ?? getBasePriceCents(),
        material: config.material,
      },
      widthMm: w,
      heightMm: h,
      quantity: overrideQty ?? config.qty,
      shape: config.shape,
      finish: config.finish,
      options: {},
      vatRate: 0.20,
    };
  }

  const price = computePrice(makePricingInput(), pricingTiers);
  const pricePer50 = computePrice(makePricingInput(50), pricingTiers);

  function update<K extends keyof ConfigState>(key: K, value: ConfigState[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function onFile(file: File | null | undefined) {
    if (!file) return;
    setUploaded({ name: file.name, size: (file.size / 1024).toFixed(0) + " KB", file });
    setUploadStatus("idle");
  }

  async function handleAdd() {
    setAddLoading(true);
    setUploadStatus("idle");
    const [widthMm, heightMm] = getDimensions();
    const shapeName =
      config.shape === "die-cut" ? "Die Cut" :
      config.shape === "circle" ? "Ronds" :
      config.shape === "square" ? "Carrés" : "Rectangle";

    // Call server action directly to get back the orderId + itemId
    const result = await addToCartAction({
      productId: getProductId(),
      productName: productName ?? `Stickers ${shapeName}`,
      quantity: config.qty,
      widthMm,
      heightMm,
      shape: config.shape,
      finish: config.finish,
      material: config.material,
      basePriceCents: getBasePriceCents(),
      options: {},
    });

    if (result.ok) {
      // Upload design file if one was selected
      if (uploaded?.file) {
        setUploadStatus("uploading");
        try {
          const presignRes = await fetch("/api/uploads/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: result.data.orderId,
              type: "customer_upload",
              filename: uploaded.file.name,
              mimeType: uploaded.file.type || "application/octet-stream",
            }),
          });

          if (presignRes.ok) {
            const { uploadUrl, key } = await presignRes.json() as { uploadUrl: string; key: string };
            const putRes = await fetch(uploadUrl, {
              method: "PUT",
              body: uploaded.file,
              headers: { "Content-Type": uploaded.file.type || "application/octet-stream" },
            });
            if (putRes.ok) {
              await fetch("/api/uploads/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: result.data.orderId,
                  itemId: result.data.itemId,
                  key,
                  filename: uploaded.file.name,
                  mimeType: uploaded.file.type,
                }),
              });
              setUploadStatus("done");
            } else {
              setUploadStatus("error");
            }
          } else {
            setUploadStatus("error");
          }
        } catch {
          setUploadStatus("error");
        }
      }

      await refreshCart();
      setCartOpen(true);
    }

    setAddLoading(false);
  }

  async function handleAddAndCheckout() {    await handleAdd();
    router.push("/checkout");
  }

  if (layout === "stepper") {
    return (
      <StepperLayout
        config={config}
        update={update}
        price={price}
        pricePer50={pricePer50}
        step={step}
        setStep={setStep}
        uploaded={uploaded}
        onFile={onFile}
        dragOver={dragOver}
        setDragOver={setDragOver}
        handleAdd={handleAdd}
        handleAddAndCheckout={handleAddAndCheckout}
      />
    );
  }

  // COLUMNS layout (default)
  const shapeName =
    config.shape === "die-cut" ? "Die Cut" :
    config.shape === "circle" ? "Rond" :
    config.shape === "square" ? "Carré" : "Rectangle";

  const materialName: Record<string, string> = {
    vinyl: "Vinyle",
    holographic: "Holographique",
    glitter: "Pailleté",
    transparent: "Transparent",
    kraft: "Kraft",
  };

  return (
    <main style={{ background: "var(--cream)" }}>
      {/* Page header */}
      <section
        style={{
          background: "var(--white)",
          borderBottom: "2px solid var(--ink)",
          padding: "32px 0",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--grey-600)",
              marginBottom: 12,
            }}
          >
            ACCUEIL / <a href="/products" style={{ color: "inherit", textDecoration: "none" }}>PRODUITS</a>
            {productName && (
              <> / <span style={{ color: "var(--red)", fontWeight: 700 }}>{productName.toUpperCase()}</span></>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1fr",
              gap: 40,
              alignItems: "center",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 56,
                  letterSpacing: "-0.02em",
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontWeight: 800,
                }}
              >
                {productName ?? "Stickers Die Cut"}
              </h1>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", gap: 2, color: "var(--red)" }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <StarIcon key={i} />
                  ))}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>4,9/5</span>
                <span style={{ fontSize: 13, color: "var(--grey-600)" }}>· 312 avis vérifiés</span>
              </div>
              {description && (
                <p
                  style={{
                    fontSize: 15,
                    color: "var(--grey-600)",
                    maxWidth: 640,
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {description}
                </p>
              )}
              {features && features.length > 0 && (
                <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--grey-600)" }}>
                      <span style={{ color: "var(--red)", fontWeight: 900, flexShrink: 0 }}>◆</span>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {imageUrl ? (
                <div
                  style={{
                    width: 220,
                    height: 220,
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "2px solid var(--grey-200)",
                    flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={productName ?? "Produit"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ) : (
                (["red", "blue", "white"] as StickerColor[]).map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: 72,
                      height: 72,
                      transform: `rotate(${(i - 1) * 6}deg)`,
                      filter: "drop-shadow(3px 3px 0 rgba(0,0,0,0.12))",
                    }}
                  >
                    <StickerPreview shape="die-cut" color={c} label="MS" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3-column configurator */}
      <section style={{ padding: "48px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1.4fr 1fr",
              gap: 28,
              alignItems: "flex-start",
            }}
          >
            {/* Col 1: Live preview */}
            <div style={{ position: "sticky", top: 100 }}>
              <div
                style={{
                  background: "var(--white)",
                  border: "2px solid var(--ink)",
                  borderRadius: "var(--r-lg)",
                  padding: 24,
                  aspectRatio: "1",
                  display: "grid",
                  placeItems: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Blueprint grid */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage:
                      "linear-gradient(rgba(11,61,145,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,61,145,0.05) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
                {/* Ruler */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    right: 8,
                    height: 14,
                    borderTop: "1px solid var(--grey-200)",
                    fontSize: 8,
                    color: "var(--grey-400)",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>0</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>{config.size === "custom" ? "?" : config.size.split("x")[0]}cm</span>
                </div>

                <div style={{ width: "75%", aspectRatio: "1", zIndex: 2 }}>
                  <StickerPreview
                    shape={config.shape as StickerShape}
                    color={config.color}
                    label="MS"
                    material={config.material as StickerMaterial}
                  />
                </div>

                <div
                  style={{
                    position: "absolute",
                    bottom: 12,
                    left: 12,
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    color: "var(--grey-400)",
                  }}
                >
                  ◆ APERÇU LIVE · ÉCHELLE ~1:1
                </div>
              </div>

              {/* Color picker */}
              <div
                style={{
                  marginTop: 16,
                  background: "var(--white)",
                  border: "1.5px solid var(--grey-200)",
                  borderRadius: "var(--r)",
                  padding: 16,
                }}
              >
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--grey-600)",
                    marginBottom: 8,
                    display: "block",
                  }}
                >
                  Couleur d&apos;exemple
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["red", "blue", "white", "yellow"] as StickerColor[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => update("color", c)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background:
                          c === "red"
                            ? "#DC2626"
                            : c === "blue"
                              ? "#0B3D91"
                              : c === "yellow"
                                ? "#FFD60A"
                                : "#fff",
                        border:
                          config.color === c
                            ? "3px solid var(--ink)"
                            : "1.5px solid var(--grey-200)",
                        cursor: "pointer",
                        boxShadow:
                          config.color === c
                            ? "0 0 0 2px var(--white), 0 0 0 4px var(--ink)"
                            : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Col 2: Config options */}
            <div>
              {/* Shape */}
              <ConfigSection num="01" title="Forme" value={shapeName}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {[
                    { id: "die-cut" as PricingShape, label: "Die Cut", desc: "Découpé à la forme" },
                    { id: "circle" as PricingShape, label: "Rond", desc: "Cercles parfaits" },
                    { id: "square" as PricingShape, label: "Carré", desc: "Coins légèrement arrondis" },
                  ].map((s) => (
                    <OptionCard
                      key={s.id}
                      active={config.shape === s.id}
                      onClick={() => update("shape", s.id)}
                    >
                      <div
                        style={{
                          height: 56,
                          display: "grid",
                          placeItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        {s.id === "die-cut" && (
                          <svg width="48" height="40" viewBox="0 0 48 40">
                            <path
                              d="M8 8 Q24 2 40 8 Q46 20 40 32 Q24 38 8 32 Q2 20 8 8z"
                              fill={config.shape === s.id ? "var(--red)" : "var(--grey-200)"}
                            />
                          </svg>
                        )}
                        {s.id === "circle" && (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background:
                                config.shape === s.id ? "var(--red)" : "var(--grey-200)",
                            }}
                          />
                        )}
                        {s.id === "square" && (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 4,
                              background:
                                config.shape === s.id ? "var(--red)" : "var(--grey-200)",
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "var(--font-archivo), system-ui, sans-serif",
                        }}
                      >
                        {s.label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--grey-600)", marginTop: 2 }}>
                        {s.desc}
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </ConfigSection>

              {/* Material */}
              <ConfigSection num="02" title="Matière" value={materialName[config.material] ?? "Vinyle"}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${products && products.length > 0 ? Math.min(products.length, 5) : 4}, 1fr)`, gap: 10 }}>
                  {(products && products.length > 0
                    ? products.map((p) => {
                        const mat = materialToPreview(p.material) as PricingMaterial;
                        const vis = MATERIAL_VISUALS[p.material] ?? MATERIAL_VISUALS["vinyl"]!;
                        return { id: mat, label: vis.label, bg: vis.bg, border: vis.border };
                      })
                    : [
                        { id: "vinyl" as PricingMaterial, label: "Vinyle", bg: "#fff", border: "var(--grey-200)" },
                        { id: "holographic" as PricingMaterial, label: "Holo", bg: "linear-gradient(135deg, #ff9ee5, #a6f0ff, #ffea93, #b3a1ff)", border: "transparent" },
                        { id: "glitter" as PricingMaterial, label: "Pailleté", bg: "radial-gradient(circle at 30% 30%, #fff 1%, transparent 3%), #DC2626", border: "transparent" },
                        { id: "transparent" as PricingMaterial, label: "Transparent", bg: "repeating-linear-gradient(45deg, #f0f0f0 0, #f0f0f0 4px, #fff 4px, #fff 8px)", border: "var(--grey-200)" },
                      ]
                  ).map((m) => (
                    <OptionCard
                      key={m.id}
                      active={config.material === m.id}
                      onClick={() => update("material", m.id)}
                    >
                      <div
                        style={{
                          height: 48,
                          borderRadius: 8,
                          marginBottom: 8,
                          background: m.bg,
                          border: `1px solid ${m.border}`,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "var(--font-archivo), system-ui, sans-serif",
                        }}
                      >
                        {m.label}
                      </div>
                    </OptionCard>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--grey-600)",
                      margin: 0,
                    }}
                  >
                    Finition
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(availableFinishes ?? (["gloss", "matte", "uv-laminated"] as PricingFinish[])).map((f) => (
                      <button
                        key={f}
                        onClick={() => update("finish", f)}
                        style={{
                          padding: "6px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          background: config.finish === f ? "var(--ink)" : "var(--white)",
                          color: config.finish === f ? "var(--white)" : "var(--ink)",
                          border: "1.5px solid var(--ink)",
                          borderRadius: 999,
                          cursor: "pointer",
                          fontFamily: "var(--font-mono), monospace",
                          textTransform: "capitalize",
                        }}
                      >
                        {f === "uv-laminated" ? "UV laminé" : f === "matte" ? "Mat" : "Gloss"}
                      </button>
                    ))}
                  </div>
                </div>
              </ConfigSection>

              {/* Size */}
              <ConfigSection
                num="03"
                title="Taille"
                value={
                  config.customPresetId
                    ? (customPresets.find((p) => p.id === config.customPresetId)?.label ?? "Personnalisé")
                    : config.size === "custom"
                      ? "Sur-mesure"
                      : config.size.replace("x", " × ") + " cm"
                }
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {/* Custom presets from admin */}
                  {customPresets.map((preset) => {
                    const isActive = config.customPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => update("customPresetId" as keyof ConfigState, preset.id as ConfigState[keyof ConfigState])}
                        style={{
                          padding: "14px 12px",
                          border: `1.5px solid ${isActive ? "var(--red)" : "var(--grey-200)"}`,
                          background: isActive ? "#FEF2F2" : "var(--white)",
                          borderRadius: "var(--r)",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 13,
                          fontWeight: 600,
                          textAlign: "left",
                          boxShadow: isActive ? "inset 0 0 0 1px var(--red)" : "none",
                        }}
                      >
                        {preset.label}
                        <span style={{ fontSize: 10, color: "var(--grey-400)", fontWeight: 400, display: "block", marginTop: 2 }}>
                          {preset.widthMm}×{preset.heightMm} mm
                        </span>
                      </button>
                    );
                  })}
                  {/* Standard presets */}
                  {(availableSizes ?? (["2x2", "3x3", "4x4", "5x5", "7x7", "custom"] as PricingSize[])).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setConfig((c) => { const { customPresetId: _, ...rest } = c; return { ...rest, size: s }; }); }}
                      style={{
                        padding: "14px 12px",
                        border: `1.5px solid ${config.size === s ? "var(--red)" : "var(--grey-200)"}`,
                        background: config.size === s ? "#FEF2F2" : "var(--white)",
                        borderRadius: "var(--r)",
                        cursor: "pointer",
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 13,
                        fontWeight: 600,
                        textAlign: "left",
                        boxShadow: config.size === s ? "inset 0 0 0 1px var(--red)" : "none",
                      }}
                    >
                      {s === "custom" ? (
                        <>
                          Personnalisée{" "}
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--grey-400)",
                              fontWeight: 400,
                              display: "block",
                              marginTop: 2,
                            }}
                          >
                            + dimensions libres
                          </span>
                        </>
                      ) : (
                        <>
                          {s.replace("x", " × ")} cm
                          <span
                            style={{
                              fontSize: 10,
                              color: "var(--grey-400)",
                              fontWeight: 400,
                              display: "block",
                              marginTop: 2,
                            }}
                          >
                            {s === "5x5"
                              ? "◆ Le plus commandé"
                              : s === "3x3"
                                ? "Laptop / frigo"
                                : s === "7x7"
                                  ? "Vitrine / casque"
                                  : "Standard"}
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                {config.size === "custom" && (
                  <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--grey-600)", display: "block", marginBottom: 4 }}>Largeur (mm)</label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={config.customWidth ?? 60}
                        onChange={(e) => update("customWidth", Number(e.target.value))}
                        style={{
                          width: 80,
                          padding: "6px 10px",
                          border: "1.5px solid var(--grey-200)",
                          borderRadius: "var(--r)",
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 13,
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--grey-600)", display: "block", marginBottom: 4 }}>Hauteur (mm)</label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={config.customHeight ?? 60}
                        onChange={(e) => update("customHeight", Number(e.target.value))}
                        style={{
                          width: 80,
                          padding: "6px 10px",
                          border: "1.5px solid var(--grey-200)",
                          borderRadius: "var(--r)",
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                )}
              </ConfigSection>

              {/* Quantity */}
              <ConfigSection num="04" title="Quantité" value={`${config.qty} stickers`}>
                {minQty > 1 && (
                  <div style={{ marginBottom: 10, padding: "6px 10px", background: "#FEF3C7", borderRadius: 6, fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                    Minimum de commande : {minQty} pcs
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                  {pricingTiers.filter((q) => q.minQty >= minQty || (q.minQty === 1 && minQty <= 10)).map((q) => {
                    const qty = q.minQty < minQty ? minQty : q.minQty;
                    const p = computePrice({ ...makePricingInput(), quantity: qty }, pricingTiers);
                    return (
                      <button
                        key={q.minQty}
                        onClick={() => update("qty", qty)}
                        style={{
                          padding: "12px 14px",
                          border: `1.5px solid ${config.qty === qty ? "var(--red)" : "var(--grey-200)"}`,
                          background: config.qty === qty ? "#FEF2F2" : "var(--white)",
                          borderRadius: "var(--r)",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          boxShadow: config.qty === qty ? "inset 0 0 0 1px var(--red)" : "none",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{qty} pcs</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700 }}>{(p.totalCents / 100).toFixed(2)} €</span>
                          {q.discountPct > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--blue)",
                                background: "#DBEAFE",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontWeight: 700,
                              }}
                            >
                              −{(q.discountPct * 100).toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ConfigSection>

              {/* Upload */}
              <ConfigSection
                num="05"
                title="Design"
                value={uploaded ? uploaded.name : "Non fourni"}
              >
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    onFile(e.dataTransfer.files[0]);
                  }}
                  style={{
                    border: `2px dashed ${dragOver ? "var(--red)" : "var(--grey-200)"}`,
                    background: dragOver ? "#FEF2F2" : uploaded ? "#F0FDF4" : "var(--grey-50)",
                    borderRadius: "var(--r)",
                    padding: 32,
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {uploaded ? (
                    <>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          background: uploadStatus === "done" ? "#16A34A" : uploadStatus === "error" ? "var(--red)" : "var(--blue)",
                          borderRadius: 8,
                          display: "inline-grid",
                          placeItems: "center",
                          color: "var(--white)",
                          marginBottom: 12,
                        }}
                      >
                        <CheckIcon size={28} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{uploaded.name}</div>
                      <div style={{ fontSize: 12, color: "var(--grey-600)", marginTop: 4 }}>
                        {uploaded.size}
                        {uploadStatus === "done" && <span style={{ color: "#16A34A", marginLeft: 6 }}>✓ Envoyé</span>}
                        {uploadStatus === "uploading" && <span style={{ color: "var(--blue)", marginLeft: 6 }}>Envoi en cours…</span>}
                        {uploadStatus === "error" && <span style={{ color: "var(--red)", marginLeft: 6 }}>Erreur d&apos;envoi</span>}
                        {uploadStatus === "idle" && <span style={{ marginLeft: 6 }}>· sera envoyé à la commande</span>}
                      </div>
                      <button
                        onClick={() => { setUploaded(null); setUploadStatus("idle"); }}
                        style={{
                          marginTop: 12,
                          fontSize: 12,
                          background: "transparent",
                          border: "none",
                          color: "var(--red)",
                          textDecoration: "underline",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        Changer le fichier
                      </button>
                    </>
                  ) : (
                    <>
                      <UploadIcon size={36} />
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>
                        Glissez votre fichier ici
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--grey-600)",
                          marginTop: 4,
                          marginBottom: 14,
                        }}
                      >
                        PNG, JPG, PDF, AI, SVG · Max 50 MB · 300 DPI
                      </div>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          padding: "10px 18px",
                          border: "2px solid var(--ink)",
                          borderRadius: "var(--r)",
                          background: "var(--white)",
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Choisir un fichier
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf,.ai,.svg"
                          style={{ display: "none" }}
                          onChange={(e) => onFile(e.target.files?.[0])}
                        />
                      </label>
                      <div style={{ marginTop: 12, fontSize: 11, color: "var(--grey-400)" }}>
                        Pas de design ?{" "}
                        <a
                          style={{
                            color: "var(--blue)",
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          On en crée un pour vous (+29€)
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </ConfigSection>
            </div>

            {/* Col 3: Sticky order summary + pricing tiers */}
            <div style={{ position: "sticky", top: 100, display: "flex", flexDirection: "column", gap: 16 }}>
              <OrderSummary
                config={config}
                price={price}
                pricePer50={pricePer50}
                uploaded={uploaded}
                onAdd={handleAdd}
                onAddAndCheckout={handleAddAndCheckout}
                loading={addLoading}
              />

              {/* Pricing tiers table */}
              <div
                style={{
                  background: "var(--white)",
                  border: "1.5px solid var(--grey-200)",
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "var(--cream, #F5F2EC)",
                    borderBottom: "1.5px solid var(--grey-200)",
                    padding: "10px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink)" }}>
                    ◆ TARIFS DÉGRESSIFS
                  </span>
                  <span style={{ fontSize: 10, color: "var(--grey-600)", fontFamily: "var(--font-mono), monospace" }}>
                    {config.size === "custom" ? "sur-mesure" : config.size.replace("x", "×") + " cm"}
                  </span>
                </div>
                {pricingTiers.map((tier, i) => {
                  const qty = tier.minQty === 1 ? 10 : tier.minQty;
                  const explicitSizePrice = config.size !== "custom" ? sizePrices?.[config.size] : undefined;
                  const [tw, th] = explicitSizePrice ? [50, 50] : getDimensions();
                  const out = computePrice({
                    product: { basePriceCents: explicitSizePrice ?? getBasePriceCents(), material: config.material },
                    widthMm: tw,
                    heightMm: th,
                    quantity: qty,
                    shape: config.shape,
                    finish: config.finish,
                    options: {},
                    vatRate: 0.20,
                  }, pricingTiers);
                  const isActive = config.qty >= tier.minQty &&
                    (i === pricingTiers.length - 1 || config.qty < (pricingTiers[i + 1]?.minQty ?? Infinity));
                  return (
                    <div
                      key={tier.minQty}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "52px 1fr 1fr",
                        alignItems: "center",
                        padding: "9px 16px",
                        borderBottom: i < pricingTiers.length - 1 ? "1px solid var(--grey-100, #F3F4F6)" : "none",
                        background: isActive ? "#FEF2F2" : "transparent",
                        borderLeft: isActive ? "3px solid var(--red)" : "3px solid transparent",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 13,
                          fontWeight: 800,
                          color: isActive ? "var(--red)" : "var(--ink)",
                        }}
                      >
                        {qty}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--grey-600)" }}>
                        {tier.discountPct > 0 ? (
                          <span style={{ background: "#DCFCE7", color: "#14532D", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                            −{Math.round(tier.discountPct * 100)}%
                          </span>
                        ) : (
                          <span style={{ color: "var(--grey-400)", fontSize: 10 }}>tarif normal</span>
                        )}
                      </span>
                      <span style={{ textAlign: "right", fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                        {(out.unitPriceCents / 100).toFixed(2)} €<span style={{ fontSize: 10, fontWeight: 400, color: "var(--grey-600)" }}>/u</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specs & FAQ */}
      <section
        style={{
          background: "var(--ink)",
          color: "var(--white)",
          padding: "64px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 32px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 60,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "var(--red)",
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              ◆ FICHE TECHNIQUE
            </div>
            <h2
              style={{
                fontSize: 40,
                marginBottom: 24,
                fontFamily: "var(--font-archivo), system-ui, sans-serif",
                fontWeight: 800,
              }}
            >
              Fait pour durer.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, fontSize: 13 }}>
              {[
                { label: "Matériau", value: "Vinyle polymère 80µ" },
                { label: "Laminat", value: "Polyester 25µ UV" },
                { label: "Impression", value: "6 couleurs CMYK+Blanc" },
                { label: "Résolution", value: "1200 dpi" },
                { label: "Résistance", value: "3 ans extérieur" },
                { label: "Température", value: "−40°C à +90°C" },
                { label: "Certifications", value: "FSC · REACH" },
                { label: "Fabriqué", value: "Lyon, France" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 10 }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      color: "var(--grey-400)",
                      marginBottom: 4,
                    }}
                  >
                    {label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <FaqPanel />
        </div>
      </section>
    </main>
  );
}

function FaqPanel() {
  const FAQS = [
    {
      q: "Comment préparer mon fichier ?",
      a: "PDF vectoriel ou PNG 300dpi avec fond transparent. On corrige gratuitement si besoin.",
    },
    {
      q: "Quel est le délai réel ?",
      a: "Production sous 24-48h, livraison Colissimo en 2-3 jours ouvrés en France métropolitaine.",
    },
    {
      q: "Puis-je commander un échantillon ?",
      a: "Oui, pack découverte à 5€ (5 stickers sur les différentes matières).",
    },
  ];

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.2em",
          color: "var(--red)",
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        ◆ QUESTIONS FRÉQUENTES
      </div>
      <h2
        style={{
          fontSize: 40,
          marginBottom: 24,
          fontFamily: "var(--font-archivo), system-ui, sans-serif",
          fontWeight: 800,
        }}
      >
        Bonne question.
      </h2>
      {FAQS.map((f) => (
        <FaqItem key={f.q} q={f.q} a={f.a} />
      ))}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "18px 0" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: "inherit",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
        }}
      >
        {q}
        <span style={{ fontSize: 18, flexShrink: 0, marginLeft: 16 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--grey-400)", lineHeight: 1.5 }}>
          {a}
        </div>
      )}
    </div>
  );
}
