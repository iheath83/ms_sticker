"use client";

import type { ConfigState } from "./product-configurator";
import type { PricingOutput } from "@/lib/pricing";
import { ArrowIcon, CheckIcon, TruckIcon, ShieldIcon } from "../icons";

interface OrderSummaryProps {
  config: ConfigState;
  price: PricingOutput;
  pricePer50: PricingOutput;
  uploaded: { name: string; size: string } | null;
  onAdd: () => void;
  onAddAndCheckout: () => void;
  loading?: boolean;
}

export function OrderSummary({
  config,
  price,
  pricePer50,
  uploaded,
  onAdd,
  onAddAndCheckout,
  loading = false,
}: OrderSummaryProps) {
  const unitEuros = price.unitPriceCents / 100;
  const totalEuros = price.totalCents / 100;
  const unit50Euros = pricePer50.unitPriceCents / 100;

  const savings =
    unit50Euros > unitEuros
      ? (((unit50Euros - unitEuros) / unit50Euros) * 100).toFixed(0)
      : 0;

  const shapeName =
    config.shape === "die-cut"
      ? "Die Cut"
      : config.shape === "circle"
        ? "Ronds"
        : config.shape === "rectangle"
          ? "Rectangle"
          : "Carrés";

  const materialName: Record<string, string> = {
    vinyl: "Vinyle",
    holographic: "Holo",
    glitter: "Pailleté",
    transparent: "Transparent",
    kraft: "Kraft",
  };

  return (
    <div
      style={{
        background: "var(--white)",
        border: "2px solid var(--ink)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        boxShadow: "6px 6px 0 0 var(--red)",
      }}
    >
      <div
        style={{
          background: "var(--ink)",
          color: "var(--white)",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: "0.15em", fontWeight: 700 }}>◆ VOTRE DEVIS</span>
        <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700 }}>LIVE</span>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
          {config.qty} × Stickers {shapeName}
        </div>

        <div style={{ fontSize: 12, color: "var(--grey-600)", lineHeight: 1.8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Taille</span>
            <b style={{ color: "var(--ink)" }}>
              {config.size === "custom" ? "Sur-mesure" : config.size.replace("x", "×") + " cm"}
            </b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Matière</span>
            <b style={{ color: "var(--ink)" }}>{materialName[config.material] ?? config.material}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Finition</span>
            <b style={{ color: "var(--ink)", textTransform: "capitalize" }}>{config.finish}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Design</span>
            <b style={{ color: uploaded ? "var(--blue)" : "var(--grey-400)" }}>
              {uploaded ? "Fourni ✓" : "À fournir"}
            </b>
          </div>
        </div>

        <div
          style={{
            margin: "20px 0",
            height: 1,
            backgroundImage:
              "repeating-linear-gradient(90deg, var(--grey-200) 0, var(--grey-200) 4px, transparent 4px, transparent 8px)",
          }}
        />

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div
            style={{
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            {totalEuros.toFixed(2)} €
          </div>
          <div style={{ fontSize: 11, color: "var(--grey-400)", marginBottom: 2 }}>
            TVA 20% incluse
          </div>
          <div style={{ fontSize: 12, color: "var(--grey-600)" }}>
            soit <b>{unitEuros.toFixed(2)} €</b> / sticker
          </div>
          {Number(savings) > 0 && (
            <div
              style={{
                display: "inline-block",
                marginTop: 8,
                background: "#DBEAFE",
                color: "var(--blue)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Vous économisez {savings}% vs 50 pcs
            </div>
          )}
        </div>

        <button
          onClick={onAddAndCheckout}
          disabled={loading}
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "18px 28px",
            background: loading ? "var(--grey-400)" : "var(--red)",
            color: "var(--white)",
            border: "2px solid var(--ink)",
            borderRadius: "var(--r)",
            fontFamily: "var(--font-mono), monospace",
            fontWeight: 600,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Ajout..." : <>Commander maintenant <ArrowIcon /></>}
        </button>

        <button
          onClick={onAdd}
          disabled={loading}
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "14px 24px",
            background: "var(--white)",
            color: "var(--ink)",
            border: "2px solid var(--ink)",
            borderRadius: "var(--r)",
            fontFamily: "var(--font-mono), monospace",
            fontWeight: 600,
            fontSize: 12,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          Ajouter au panier
        </button>

        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px dashed var(--grey-200)",
            display: "grid",
            gap: 8,
            fontSize: 11,
            color: "var(--grey-600)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckIcon size={14} /> Épreuve numérique gratuite
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TruckIcon size={14} /> Livraison 48h · offerte dès 50€
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldIcon size={14} /> Paiement sécurisé · SSL
          </div>
        </div>
      </div>
    </div>
  );
}
