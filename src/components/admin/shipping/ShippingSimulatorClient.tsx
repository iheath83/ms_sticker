"use client";

import { useState } from "react";
import {
  AdminTopbar, AdminPage, AdminCard, T, PrimaryBtn, SecondaryBtn, StatusBadge,
} from "@/components/admin/admin-ui";
import type { ShippingQuoteResult, ShippingDebugLog } from "@/lib/shipping/types";

const DEFAULT_CONTEXT = {
  cart: {
    currency: "EUR",
    subtotal: 80,
    totalDiscount: 0,
    totalQuantity: 2,
    totalWeight: 1.5,
    items: [
      {
        productId: "test-product",
        name: "Sticker personnalisé",
        quantity: 2,
        unitPrice: 40,
        requiresShipping: true,
        isFragile: false,
        isOversized: false,
      },
    ],
  },
  destination: {
    country: "FR",
    postalCode: "75001",
    city: "Paris",
  },
  customer: {
    isB2B: false,
    orderCount: 2,
  },
};

export function ShippingSimulatorClient() {
  const [contextJson, setContextJson] = useState(JSON.stringify(DEFAULT_CONTEXT, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShippingQuoteResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Simple form mode
  const [simpleMode, setSimpleMode] = useState(true);
  const [simple, setSimple] = useState({
    subtotal: "80",
    postalCode: "75001",
    country: "FR",
    city: "Paris",
    isFragile: false,
    isOversized: false,
    isB2B: false,
    quantity: "2",
    weight: "1.5",
    couponCode: "",
  });

  async function runSimulation(ctx: unknown) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/shipping/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      });
      const data = await res.json() as ShippingQuoteResult & { success?: boolean };
      setResult(data);
    } catch (e) {
      setResult({ currency: "EUR", methods: [], hiddenMethods: [], errors: ["Erreur réseau"] });
    } finally {
      setLoading(false);
    }
  }

  function runSimple() {
    const ctx = {
      cart: {
        currency: "EUR",
        subtotal: parseFloat(simple.subtotal) || 0,
        totalDiscount: 0,
        totalQuantity: parseInt(simple.quantity, 10) || 1,
        totalWeight: parseFloat(simple.weight) || 0,
        couponCodes: simple.couponCode ? [simple.couponCode] : [],
        items: [{
          productId: "sim-product",
          name: "Produit simulé",
          quantity: parseInt(simple.quantity, 10) || 1,
          unitPrice: parseFloat(simple.subtotal) || 0,
          requiresShipping: true,
          isFragile: simple.isFragile,
          isOversized: simple.isOversized,
        }],
      },
      destination: {
        country: simple.country,
        postalCode: simple.postalCode,
        city: simple.city,
      },
      customer: {
        isB2B: simple.isB2B,
      },
    };
    void runSimulation(ctx);
  }

  function runJson() {
    try {
      const ctx = JSON.parse(contextJson) as unknown;
      setJsonError(null);
      void runSimulation(ctx);
    } catch (e) {
      setJsonError("JSON invalide : " + String(e));
    }
  }

  return (
    <>
      <AdminTopbar title="Simulateur de livraison" subtitle="Testez vos règles sur un panier fictif" />

      <AdminPage>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Input panel */}
          <div>
            <AdminCard>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <button onClick={() => setSimpleMode(true)} style={{ padding: "7px 14px", background: simpleMode ? T.brand : T.surface, color: simpleMode ? "#fff" : T.textPrimary, border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, cursor: "pointer", fontWeight: simpleMode ? 700 : 400 }}>Mode simple</button>
                <button onClick={() => setSimpleMode(false)} style={{ padding: "7px 14px", background: !simpleMode ? T.brand : T.surface, color: !simpleMode ? "#fff" : T.textPrimary, border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, cursor: "pointer", fontWeight: !simpleMode ? 700 : 400 }}>Mode JSON</button>
              </div>

              {simpleMode ? (
                <div style={{ display: "grid", gap: 14 }}>
                  <SimRow label="Sous-total panier (€)">
                    <input value={simple.subtotal} onChange={(e) => setSimple((s) => ({ ...s, subtotal: e.target.value }))} style={inputStyle} type="number" />
                  </SimRow>
                  <SimRow label="Quantité">
                    <input value={simple.quantity} onChange={(e) => setSimple((s) => ({ ...s, quantity: e.target.value }))} style={inputStyle} type="number" />
                  </SimRow>
                  <SimRow label="Poids total (kg)">
                    <input value={simple.weight} onChange={(e) => setSimple((s) => ({ ...s, weight: e.target.value }))} style={inputStyle} type="number" step="0.1" />
                  </SimRow>
                  <SimRow label="Code postal">
                    <input value={simple.postalCode} onChange={(e) => setSimple((s) => ({ ...s, postalCode: e.target.value }))} style={inputStyle} />
                  </SimRow>
                  <SimRow label="Ville">
                    <input value={simple.city} onChange={(e) => setSimple((s) => ({ ...s, city: e.target.value }))} style={inputStyle} />
                  </SimRow>
                  <SimRow label="Pays (ISO)">
                    <input value={simple.country} onChange={(e) => setSimple((s) => ({ ...s, country: e.target.value }))} style={inputStyle} />
                  </SimRow>
                  <SimRow label="Code promo">
                    <input value={simple.couponCode} onChange={(e) => setSimple((s) => ({ ...s, couponCode: e.target.value }))} style={inputStyle} placeholder="Optionnel" />
                  </SimRow>
                  <div style={{ display: "flex", gap: 20 }}>
                    <label style={checkStyle}><input type="checkbox" checked={simple.isFragile} onChange={(e) => setSimple((s) => ({ ...s, isFragile: e.target.checked }))} /> Produit fragile</label>
                    <label style={checkStyle}><input type="checkbox" checked={simple.isOversized} onChange={(e) => setSimple((s) => ({ ...s, isOversized: e.target.checked }))} /> Produit volumineux</label>
                    <label style={checkStyle}><input type="checkbox" checked={simple.isB2B} onChange={(e) => setSimple((s) => ({ ...s, isB2B: e.target.checked }))} /> Client B2B</label>
                  </div>
                  <PrimaryBtn onClick={runSimple} disabled={loading}>{loading ? "Simulation…" : "Simuler"}</PrimaryBtn>
                </div>
              ) : (
                <div>
                  {jsonError && <div style={{ marginBottom: 10, padding: "8px 12px", background: T.dangerBg, borderRadius: T.radiusSm, fontSize: 12, color: T.danger }}>{jsonError}</div>}
                  <textarea
                    value={contextJson}
                    onChange={(e) => setContextJson(e.target.value)}
                    rows={20}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 12, border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, resize: "vertical", boxSizing: "border-box" }}
                  />
                  <div style={{ marginTop: 12 }}>
                    <PrimaryBtn onClick={runJson} disabled={loading}>{loading ? "Simulation…" : "Simuler"}</PrimaryBtn>
                  </div>
                </div>
              )}
            </AdminCard>
          </div>

          {/* Result panel */}
          <div>
            <AdminCard>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Résultats</div>

              {!result && !loading && (
                <div style={{ fontSize: 13, color: T.textSecondary, padding: "20px 0" }}>Lancez une simulation pour voir les résultats.</div>
              )}

              {loading && (
                <div style={{ fontSize: 13, color: T.textSecondary, padding: "20px 0" }}>Calcul en cours…</div>
              )}

              {result && (
                <>
                  {result.blocked && (
                    <div style={{ padding: "12px 16px", background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: T.radiusSm, marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: T.danger, marginBottom: 4 }}>⛔ Checkout bloqué</div>
                      <div style={{ fontSize: 13 }}>{result.blocked.message}</div>
                    </div>
                  )}

                  {result.errors.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      {result.errors.map((e, i) => (
                        <div key={i} style={{ padding: "8px 12px", background: T.warningBg, borderRadius: T.radiusSm, fontSize: 12, marginBottom: 6 }}>{e}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Méthodes disponibles ({result.methods.length})</div>
                  {result.methods.length === 0 && <div style={{ fontSize: 13, color: T.textSecondary }}>Aucune méthode disponible.</div>}
                  {result.methods.map((m) => (
                    <div key={m.id} style={{ padding: "12px 16px", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{m.publicName}</span>
                          {m.badges.map((b) => (
                            <span key={b} style={{ marginLeft: 6, padding: "2px 6px", background: T.brandLight, fontSize: 10, fontWeight: 700, borderRadius: T.radiusSm, color: T.brand }}>{b}</span>
                          ))}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: m.isFree ? T.success : T.textPrimary }}>
                            {m.isFree ? "OFFERT" : `${m.price.toFixed(2)} €`}
                          </div>
                          {m.discountAmount > 0 && (
                            <div style={{ fontSize: 11, color: T.textSecondary, textDecoration: "line-through" }}>{m.originalPrice.toFixed(2)} €</div>
                          )}
                        </div>
                      </div>
                      {m.description && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{m.description}</div>}
                      {m.minDeliveryDays !== null && (
                        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>{m.minDeliveryDays}–{m.maxDeliveryDays} jours ouvrés</div>
                      )}
                      {m.appliedRules.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: T.info }}>
                          Règles appliquées : {m.appliedRules.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}

                  {result.hiddenMethods.length > 0 && (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, marginTop: 16 }}>Méthodes masquées ({result.hiddenMethods.length})</div>
                      {result.hiddenMethods.map((h) => (
                        <div key={h.id} style={{ padding: "10px 14px", background: T.dangerBg, borderRadius: T.radiusSm, marginBottom: 8, fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{h.name}</span> — <span style={{ color: T.danger }}>{h.reason}</span>
                        </div>
                      ))}
                    </>
                  )}

                  {result.debug && result.debug.length > 0 && (
                    <>
                      <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Log de débogage</div>
                        <SecondaryBtn onClick={() => setShowDebug((v) => !v)}>{showDebug ? "Masquer" : "Afficher"}</SecondaryBtn>
                      </div>
                      {showDebug && (
                        <div style={{ marginTop: 10, maxHeight: 400, overflow: "auto" }}>
                          {result.debug.map((log: ShippingDebugLog, i: number) => (
                            <div key={i} style={{ marginBottom: 12, padding: "10px 14px", background: log.matched ? "#F0FDF4" : T.bg, borderRadius: T.radiusSm, fontSize: 12, fontFamily: "monospace" }}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                {log.matched ? "✓" : "✗"} {log.ruleName} (priorité évaluée)
                              </div>
                              {log.conditions.map((c, ci) => (
                                <div key={ci} style={{ color: c.matched ? T.success : T.danger, marginLeft: 8 }}>
                                  {c.matched ? "✓" : "✗"} {c.field} {c.operator} {JSON.stringify(c.expected)} → {JSON.stringify(c.actual)}
                                </div>
                              ))}
                              {log.actionsApplied.length > 0 && (
                                <div style={{ marginTop: 4, color: T.info }}>→ {log.actionsApplied.join(", ")}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </AdminCard>
          </div>
        </div>
      </AdminPage>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm, fontSize: 13,
  boxSizing: "border-box",
};

const checkStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
};

function SimRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textSecondary, display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
