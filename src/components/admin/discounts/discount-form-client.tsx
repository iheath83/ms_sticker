"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDiscount, updateDiscount } from "@/lib/discount-actions";
import type { Discount } from "@/db/schema";
import type { DiscountFormInput, DiscountConditions, DiscountCombinationRules } from "@/lib/discounts/discount-types";

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 6, border: "1px solid #D1D5DB",
  fontSize: 13, color: "#0A0E27", background: "#fff", fontFamily: "inherit",
  width: "100%", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
};
const sectionStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12,
  padding: "24px", marginBottom: 20,
};

function toDatetimeLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}

export function DiscountFormClient({ existing }: { existing?: Discount | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [title,         setTitle]        = useState(existing?.title ?? "");
  const [internalName,  setInternalName]  = useState(existing?.internalName ?? "");
  const [code,          setCode]          = useState(existing?.code ?? "");
  const [method,        setMethod]        = useState<"CODE" | "AUTOMATIC">(
    (existing?.method as "CODE" | "AUTOMATIC") ?? "CODE",
  );
  const [type,          setType]          = useState<"PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING">(
    (existing?.type as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING") ?? "PERCENTAGE",
  );
  const [value,         setValue]         = useState(String(existing?.value ?? ""));
  const [status,        setStatus]        = useState(existing?.status ?? "ACTIVE");
  const [startsAt,      setStartsAt]      = useState(toDatetimeLocal(existing?.startsAt) || new Date().toISOString().slice(0, 16));
  const [endsAt,        setEndsAt]        = useState(toDatetimeLocal(existing?.endsAt));
  const [globalLimit,   setGlobalLimit]   = useState(String(existing?.globalUsageLimit ?? ""));
  const [perCustomer,   setPerCustomer]   = useState(String(existing?.usageLimitPerCustomer ?? ""));
  const [minSubtotal,   setMinSubtotal]   = useState(String((existing?.conditions as DiscountConditions)?.minimumSubtotal != null ? ((existing?.conditions as DiscountConditions).minimumSubtotal! / 100).toFixed(2) : ""));
  const [minQty,        setMinQty]        = useState(String((existing?.conditions as DiscountConditions)?.minimumQuantity ?? ""));
  const [combineOrder,  setCombineOrder]  = useState((existing?.combinationRules as DiscountCombinationRules)?.combinableWithOrderDiscounts ?? false);
  const [combineCode,   setCombineCode]   = useState((existing?.combinationRules as DiscountCombinationRules)?.combinableWithOtherCodes ?? false);
  const [combineShip,   setCombineShip]   = useState((existing?.combinationRules as DiscountCombinationRules)?.combinableWithShippingDiscounts ?? true);
  const [combineAuto,   setCombineAuto]   = useState((existing?.combinationRules as DiscountCombinationRules)?.combinableWithAutomaticDiscounts ?? true);

  function buildInput(): DiscountFormInput {
    const conditions: DiscountConditions = {};
    if (minSubtotal) conditions.minimumSubtotal = Math.round(parseFloat(minSubtotal) * 100);
    if (minQty) conditions.minimumQuantity = parseInt(minQty, 10);

    const combinationRules: DiscountCombinationRules = {
      combinableWithOrderDiscounts:     combineOrder,
      combinableWithOtherCodes:         combineCode,
      combinableWithShippingDiscounts:  combineShip,
      combinableWithAutomaticDiscounts: combineAuto,
    };

    const base: DiscountFormInput = {
      title,
      method,
      type,
      target: type === "FREE_SHIPPING" ? "SHIPPING" : "ORDER",
      status: status as DiscountFormInput["status"],
      startsAt,
      priority: 0,
      conditions,
      combinationRules,
    };
    if (internalName) base.internalName = internalName;
    if (method === "CODE" && code) base.code = code;
    if (value) base.value = type === "FIXED_AMOUNT" ? Math.round(parseFloat(value) * 100) : parseInt(value, 10);
    if (endsAt) base.endsAt = endsAt;
    if (globalLimit) base.globalUsageLimit = parseInt(globalLimit, 10);
    if (perCustomer) base.usageLimitPerCustomer = parseInt(perCustomer, 10);
    return base;
  }

  function handleSave() {
    if (!title.trim()) { setError("Le titre est requis."); return; }
    setError("");
    startTransition(async () => {
      try {
        const input = buildInput();
        if (existing) {
          await updateDiscount(existing.id, input);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } else {
          await createDiscount(input);
          router.push("/admin/discounts");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  const fieldRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", margin: "0 0 4px" }}>
          {existing ? "Modifier la réduction" : "Nouvelle réduction"}
        </h1>
      </div>

      {/* Informations générales */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>Informations</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="Ex : Bienvenue -10 %" />
          </div>
          <div>
            <label style={labelStyle}>Nom interne (optionnel)</label>
            <input value={internalName} onChange={(e) => setInternalName(e.target.value)} style={inputStyle} placeholder="Nom visible seulement en admin" />
          </div>
        </div>
      </div>

      {/* Type et méthode */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>Type de réduction</h2>
        <div style={{ ...fieldRow, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Méthode</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as "CODE" | "AUTOMATIC")} style={inputStyle}>
              <option value="CODE">Code promo (saisi par le client)</option>
              <option value="AUTOMATIC">Automatique (sans code)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING")} style={inputStyle}>
              <option value="PERCENTAGE">Pourcentage (%)</option>
              <option value="FIXED_AMOUNT">Montant fixe (€)</option>
              <option value="FREE_SHIPPING">Livraison offerte</option>
            </select>
          </div>
        </div>
        <div style={fieldRow}>
          {method === "CODE" && (
            <div>
              <label style={labelStyle}>Code promo</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={inputStyle} placeholder="WELCOME10" />
            </div>
          )}
          {type !== "FREE_SHIPPING" && (
            <div>
              <label style={labelStyle}>{type === "PERCENTAGE" ? "Valeur (%)" : "Montant (€)"}</label>
              <input
                type="number"
                min="0"
                step={type === "PERCENTAGE" ? "1" : "0.01"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                style={inputStyle}
                placeholder={type === "PERCENTAGE" ? "10" : "5.00"}
              />
            </div>
          )}
        </div>
      </div>

      {/* Conditions */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>Conditions</h2>
        <div style={fieldRow}>
          <div>
            <label style={labelStyle}>Montant minimum (€ HT)</label>
            <input type="number" min="0" step="0.01" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} style={inputStyle} placeholder="50.00" />
          </div>
          <div>
            <label style={labelStyle}>Quantité minimum d&apos;articles</label>
            <input type="number" min="0" step="1" value={minQty} onChange={(e) => setMinQty(e.target.value)} style={inputStyle} placeholder="3" />
          </div>
        </div>
      </div>

      {/* Dates et statut */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>Dates et statut</h2>
        <div style={{ ...fieldRow, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Date de début *</label>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date de fin (optionnel)</label>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Statut</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 240 }}>
            <option value="ACTIVE">Actif</option>
            <option value="DISABLED">Désactivé</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SCHEDULED">Planifié</option>
          </select>
        </div>
      </div>

      {/* Limites d'utilisation */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>Limites d&apos;utilisation</h2>
        <div style={fieldRow}>
          <div>
            <label style={labelStyle}>Limite globale (utilisations totales)</label>
            <input type="number" min="0" step="1" value={globalLimit} onChange={(e) => setGlobalLimit(e.target.value)} style={inputStyle} placeholder="Illimité" />
          </div>
          <div>
            <label style={labelStyle}>Limite par client</label>
            <input type="number" min="0" step="1" value={perCustomer} onChange={(e) => setPerCustomer(e.target.value)} style={inputStyle} placeholder="Illimité" />
          </div>
        </div>
      </div>

      {/* Règles de cumul */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>Règles de cumul</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {([
            [combineOrder,  setCombineOrder,  "Cumulable avec d'autres réductions commande"],
            [combineCode,   setCombineCode,   "Cumulable avec d'autres codes promo"],
            [combineShip,   setCombineShip,   "Cumulable avec réductions livraison"],
            [combineAuto,   setCombineAuto,   "Cumulable avec réductions automatiques"],
          ] as [boolean, (v: boolean) => void, string][]).map(([val, setter, label]) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} style={{ width: 16, height: 16 }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      {error && <div style={{ padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#991B1B", marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{ padding: "12px 28px", background: "#0B3D91", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? "Enregistrement…" : (existing ? "Enregistrer" : "Créer la réduction")}
        </button>
        {saved && <span style={{ fontSize: 13, color: "#16A34A", fontWeight: 600 }}>✓ Enregistré</span>}
        <a href="/admin/discounts" style={{ fontSize: 13, color: "#6B7280", textDecoration: "underline", marginLeft: 8 }}>Annuler</a>
      </div>
    </div>
  );
}
