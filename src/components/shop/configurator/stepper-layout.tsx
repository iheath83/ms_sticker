"use client";

import type { ConfigState } from "./product-configurator";
import type { PricingOutput } from "@/lib/pricing";
import { QUANTITY_TIERS, computePrice, SIZE_MM } from "@/lib/pricing";
import type { StickerMaterial, StickerShape } from "../sticker-preview";
import { StickerPreview } from "../sticker-preview";
import { UploadIcon, CheckIcon, ArrowIcon } from "../icons";
import { OrderSummary } from "./order-summary";
import type { PricingSize } from "@/lib/pricing";

interface StepperLayoutProps {
  config: ConfigState;
  update: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void;
  price: PricingOutput;
  pricePer50: PricingOutput;
  step: number;
  setStep: (s: number) => void;
  uploaded: { name: string; size: string } | null;
  onFile: (f: File | null | undefined) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleAdd: () => void;
  handleAddAndCheckout: () => void;
}

const STEP_LABELS = ["Forme", "Matière", "Taille", "Quantité", "Design"];

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

export function StepperLayout({
  config,
  update,
  price,
  pricePer50,
  step,
  setStep,
  uploaded,
  onFile,
  dragOver,
  setDragOver,
  handleAdd,
  handleAddAndCheckout,
}: StepperLayoutProps) {
  return (
    <main style={{ background: "var(--cream)" }}>
      <section
        style={{
          background: "var(--white)",
          borderBottom: "2px solid var(--ink)",
          padding: "32px 0 0",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
          <h1
            style={{
              fontSize: 42,
              marginBottom: 32,
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontWeight: 800,
            }}
          >
            Configurez votre sticker
          </h1>

          {/* Step tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--ink)" }}>
            {STEP_LABELS.map((s, i) => (
              <button
                key={i}
                onClick={() => setStep(i + 1)}
                style={{
                  flex: 1,
                  padding: "16px 20px",
                  background: step === i + 1 ? "var(--red)" : "transparent",
                  color:
                    step === i + 1
                      ? "var(--white)"
                      : step > i + 1
                        ? "var(--ink)"
                        : "var(--grey-400)",
                  border: "none",
                  borderRight:
                    i < STEP_LABELS.length - 1 ? "1px solid var(--grey-200)" : "none",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  letterSpacing: "0.05em",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 10, opacity: 0.7 }}>
                  ÉTAPE 0{i + 1} {step > i + 1 && "✓"}
                </span>
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "48px 0" }}>
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 32px",
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: 40,
          }}
        >
          <div
            style={{
              background: "var(--white)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--r-lg)",
              padding: 40,
            }}
          >
            {/* Step 1: Shape */}
            {step === 1 && (
              <div>
                <h2
                  style={{
                    fontSize: 28,
                    marginBottom: 8,
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontWeight: 800,
                  }}
                >
                  Choisissez la forme
                </h2>
                <p style={{ fontSize: 13, color: "var(--grey-600)", marginBottom: 24 }}>
                  Die cut pour les designs complexes, rond/carré pour un rendu classique.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                  {(["die-cut", "circle", "square"] as StickerShape[]).map((s) => (
                    <OptionCard
                      key={s}
                      active={config.shape === s}
                      onClick={() => update("shape", s)}
                    >
                      <div style={{ height: 100, display: "grid", placeItems: "center" }}>
                        <div style={{ width: 80, height: 80 }}>
                          <StickerPreview shape={s} color="red" label="MS" />
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          fontFamily: "var(--font-archivo), system-ui, sans-serif",
                          textAlign: "center",
                        }}
                      >
                        {s === "die-cut" ? "Die Cut" : s === "circle" ? "Rond" : "Carré"}
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Material */}
            {step === 2 && (
              <div>
                <h2
                  style={{
                    fontSize: 28,
                    marginBottom: 24,
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontWeight: 800,
                  }}
                >
                  Choisissez la matière
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {(["vinyl", "holographic", "glitter", "transparent"] as StickerMaterial[]).map(
                    (m) => (
                      <OptionCard
                        key={m}
                        active={config.material === m}
                        onClick={() => update("material", m)}
                      >
                        <div style={{ height: 80, display: "grid", placeItems: "center" }}>
                          <div style={{ width: 60, height: 60 }}>
                            <StickerPreview shape={config.shape as StickerShape} color="red" label="MS" material={m as StickerMaterial} />
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: "center",
                            textTransform: "capitalize",
                          }}
                        >
                          {m}
                        </div>
                      </OptionCard>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Size */}
            {step === 3 && (
              <div>
                <h2
                  style={{
                    fontSize: 28,
                    marginBottom: 24,
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontWeight: 800,
                  }}
                >
                  Choisissez la taille
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {(["2x2", "3x3", "4x4", "5x5", "7x7", "custom"] as PricingSize[]).map((s) => (
                    <OptionCard key={s} active={config.size === s} onClick={() => update("size", s)}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          fontFamily: "var(--font-archivo), system-ui, sans-serif",
                        }}
                      >
                        {s === "custom" ? "Sur-mesure" : s.replace("x", " × ") + " cm"}
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Quantity */}
            {step === 4 && (
              <div>
                <h2
                  style={{
                    fontSize: 28,
                    marginBottom: 24,
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontWeight: 800,
                  }}
                >
                  Combien de stickers ?
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {QUANTITY_TIERS.map((q) => {
                    const [w, h] = config.size === "custom" ? [config.customWidth ?? 60, config.customHeight ?? 60] : SIZE_MM[config.size];
                    const p = computePrice({
                      product: { basePriceCents: 2490, material: config.material },
                      widthMm: w,
                      heightMm: h,
                      quantity: q.minQty,
                      shape: config.shape,
                      finish: config.finish,
                      options: {},
                    });
                    return (
                      <OptionCard
                        key={q.minQty}
                        active={config.qty === q.minQty}
                        onClick={() => update("qty", q.minQty)}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{q.minQty} pcs</span>
                          <span style={{ fontWeight: 700 }}>{(p.totalCents / 100).toFixed(2)} €</span>
                        </div>
                      </OptionCard>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Upload */}
            {step === 5 && (
              <div>
                <h2
                  style={{
                    fontSize: 28,
                    marginBottom: 8,
                    fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    fontWeight: 800,
                  }}
                >
                  Uploadez votre design
                </h2>
                <p style={{ fontSize: 13, color: "var(--grey-600)", marginBottom: 24 }}>
                  On vous envoie une épreuve avant impression.
                </p>
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
                    padding: 60,
                    textAlign: "center",
                  }}
                >
                  {uploaded ? (
                    <>
                      <CheckIcon size={40} />
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>
                        {uploaded.name}
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadIcon size={40} />
                      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>
                        Déposez votre fichier
                      </div>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          marginTop: 16,
                          padding: "14px 24px",
                          border: "2px solid var(--ink)",
                          borderRadius: "var(--r)",
                          background: "var(--white)",
                          fontFamily: "var(--font-mono), monospace",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Parcourir
                        <input
                          type="file"
                          style={{ display: "none" }}
                          onChange={(e) => onFile(e.target.files?.[0])}
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px dashed var(--grey-200)",
              }}
            >
              <button
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 24px",
                  border: "2px solid var(--ink)",
                  borderRadius: "var(--r)",
                  background: "var(--white)",
                  fontFamily: "var(--font-mono), monospace",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: step === 1 ? "not-allowed" : "pointer",
                  opacity: step === 1 ? 0.4 : 1,
                }}
              >
                ← Précédent
              </button>

              {step < 5 ? (
                <button
                  onClick={() => setStep(Math.min(5, step + 1))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 24px",
                    background: "var(--red)",
                    color: "var(--white)",
                    border: "2px solid var(--ink)",
                    borderRadius: "var(--r)",
                    fontFamily: "var(--font-mono), monospace",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Suivant <ArrowIcon />
                </button>
              ) : (
                <button
                  onClick={handleAddAndCheckout}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 24px",
                    background: "var(--red)",
                    color: "var(--white)",
                    border: "2px solid var(--ink)",
                    borderRadius: "var(--r)",
                    fontFamily: "var(--font-mono), monospace",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Commander <ArrowIcon />
                </button>
              )}
            </div>
          </div>

          <div style={{ position: "sticky", top: 100 }}>
            <OrderSummary
              config={config}
              price={price}
              pricePer50={pricePer50}
              uploaded={uploaded}
              onAdd={handleAdd}
              onAddAndCheckout={handleAddAndCheckout}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
