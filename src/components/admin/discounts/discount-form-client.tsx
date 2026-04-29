"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createDiscount, updateDiscount } from "@/lib/discount-actions";
import type { Discount } from "@/db/schema";
import type { DiscountFormInput, DiscountConditions, DiscountCombinationRules, DiscountEligibility, CustomerEligibility } from "@/lib/discounts/discount-types";

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
  dt.setMinutes(dt.getTimezoneOffset() === 0 ? 0 : dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}

interface CustomerOption { id: string; name: string | null; email: string; }

function CustomerPicker({
  selectedIds,
  onAdd,
  onRemove,
  selectedCustomers,
}: {
  selectedIds: string[];
  selectedCustomers: CustomerOption[];
  onAdd: (c: CustomerOption) => void;
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(q)}`);
        const data = await res.json() as CustomerOption[];
        setResults(data.filter((c) => !selectedIds.includes(c.id)));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [selectedIds]);

  useEffect(() => { search(query); }, [query, search]);

  return (
    <div>
      {/* Selected customers */}
      {selectedCustomers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {selectedCustomers.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: "#1E40AF" }}>{c.name ?? c.email}</span>
              <span style={{ color: "#93C5FD", fontSize: 11 }}>{c.name ? c.email : ""}</span>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#93C5FD", padding: "0 2px", lineHeight: 1, fontSize: 14 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          style={{ ...inputStyle, paddingRight: 32 }}
        />
        {loading && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#9CA3AF" }}>…</span>
        )}
      </div>

      {/* Results dropdown */}
      {results.length > 0 && (
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 6, marginTop: 4, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onAdd(c); setQuery(""); setResults([]); }}
              style={{ display: "flex", flexDirection: "column", width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #F3F4F6" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E27" }}>{c.name ?? c.email}</span>
              {c.name && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{c.email}</span>}
            </button>
          ))}
        </div>
      )}
      {!loading && query.length >= 2 && results.length === 0 && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>Aucun client trouvé.</div>
      )}
    </div>
  );
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

  const existingElig = existing?.eligibility as DiscountEligibility | undefined;
  const [customerEligibility, setCustomerEligibility] = useState<CustomerEligibility>(existingElig?.customerEligibility ?? "ALL");
  const [selectedCustomers,   setSelectedCustomers]   = useState<CustomerOption[]>([]);

  // Load customer details for existing SPECIFIC_CUSTOMERS discount
  useEffect(() => {
    const ids = existingElig?.customerIds;
    if (!ids || ids.length === 0) return;
    void (async () => {
      const results: CustomerOption[] = [];
      for (const id of ids) {
        try {
          const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(id)}`);
          const data = await res.json() as CustomerOption[];
          const found = data.find((c) => c.id === id);
          results.push(found ?? { id, name: null, email: id });
        } catch {
          results.push({ id, name: null, email: id });
        }
      }
      setSelectedCustomers(results);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const eligibility: DiscountEligibility = { customerEligibility };
    if (customerEligibility === "SPECIFIC_CUSTOMERS") {
      eligibility.customerIds = selectedCustomers.map((c) => c.id);
    }

    const base: DiscountFormInput = {
      title,
      method,
      type,
      target: type === "FREE_SHIPPING" ? "SHIPPING" : "ORDER",
      status: status as DiscountFormInput["status"],
      startsAt,
      priority: 0,
      conditions,
      eligibility,
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

      {/* Éligibilité clients */}
      <div style={sectionStyle}>
        <h2 style={{ fontFamily: "var(--font-archivo)", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 20px" }}>Clients éligibles</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: customerEligibility === "SPECIFIC_CUSTOMERS" ? 20 : 0 }}>
          {(["ALL", "LOGGED_IN", "SPECIFIC_CUSTOMERS"] as CustomerEligibility[]).map((opt) => {
            const labels: Record<CustomerEligibility, string> = {
              ALL:                "Tous les clients (connectés ou non)",
              LOGGED_IN:          "Clients connectés uniquement",
              SPECIFIC_CUSTOMERS: "Clients spécifiques",
            };
            return (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="radio"
                  name="customerEligibility"
                  value={opt}
                  checked={customerEligibility === opt}
                  onChange={() => setCustomerEligibility(opt)}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontWeight: customerEligibility === opt ? 700 : 400 }}>{labels[opt]}</span>
              </label>
            );
          })}
        </div>

        {customerEligibility === "SPECIFIC_CUSTOMERS" && (
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Rechercher et ajouter des clients</label>
            <CustomerPicker
              selectedIds={selectedCustomers.map((c) => c.id)}
              selectedCustomers={selectedCustomers}
              onAdd={(c) => setSelectedCustomers((prev) => [...prev, c])}
              onRemove={(id) => setSelectedCustomers((prev) => prev.filter((c) => c.id !== id))}
            />
            {selectedCustomers.length === 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#EF4444" }}>
                Ajoutez au moins un client ou choisissez une autre option d&apos;éligibilité.
              </div>
            )}
          </div>
        )}
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
