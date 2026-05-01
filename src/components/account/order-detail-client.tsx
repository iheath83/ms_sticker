"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveProof, requestProofRevision, reorderFromOrder } from "@/lib/customer-actions";

// ─── Types (serialized — Dates as strings) ────────────────────────────────────

interface SerializedOrderDetail {
  order: {
    id: string;
    status: string;
    stripePaymentIntentId?: string | null;
    totalCents: number;
    subtotalCents: number;
    taxAmountCents: number;
    shippingCents: number;
    vatRate: string | null;
    notes: string | null;
    trackingNumber: string | null;
    trackingCarrier: string | null;
    pennylaneInvoiceUrl: string | null;
    pennylaneInvoiceId: string | null;
    deliveryMethod: string | null;
    cardLast4: string | null;
    totalRefundedCents: number;
    createdAt: string;
    updatedAt: string;
    shippingAddress: {
      firstName: string | null; lastName: string | null;
      line1: string; line2: string | null;
      postalCode: string; city: string; countryCode: string; phone: string | null;
    } | null;
    billingAddress: {
      firstName: string | null; lastName: string | null;
      line1: string; line2: string | null;
      postalCode: string; city: string; countryCode: string; phone: string | null;
    } | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    widthMm: number | null;
    heightMm: number | null;
    shape: string | null;
    unitPriceCents: number;
    lineTotalCents: number;
    productName: string | null;
    productId: string | null;
    customerFile: { url: string; filename: string | null } | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
    payload: unknown;
  }>;
  proofs: Array<{
    id: string;
    storageKey: string;
    version: number;
    createdAt: string;
    originalFilename: string | null;
  }>;
  canApprove: boolean;
  canRequestRevision: boolean;
}

interface Props {
  detail: SerializedOrderDetail;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  proof_pending: "Payé — BAT en cours de préparation",
  proof_sent: "BAT prêt — votre validation est requise",
  proof_revision_requested: "Révision demandée",
  approved: "BAT validé — mise en production",
  paid: "Payé — BAT en cours de préparation",
  in_production: "En production",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  proof_pending:            { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  proof_sent:               { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  proof_revision_requested: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  approved:                 { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  paid:                     { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" },
  in_production:            { bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4" },
  shipped:                  { bg: "#CFFAFE", text: "#164E63", border: "#67E8F9" },
  delivered:                { bg: "#DCFCE7", text: "#14532D", border: "#86EFAC" },
  cancelled:                { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
};

const EVENT_LABELS: Record<string, string> = {
  "order.submitted":          "Commande reçue",
  "proof.uploaded":           "BAT préparé par notre équipe",
  "proof.approved":           "BAT approuvé",
  "proof.revision_requested": "Révision demandée",
  "payment.received":         "Paiement reçu",
  "order.in_production":      "Mise en production",
  "order.shipped":            "Expédié",
  "order.delivered":          "Livré",
  "order.cancelled":          "Commande annulée",
  "order.partial_refund":     "Remboursement partiel effectué",
  "order.refunded":           "Remboursement effectué",
  "admin.revision_reply":     "Réponse de notre équipe",
};

const EVENT_ICONS: Record<string, string> = {
  "order.submitted":          "📥",
  "proof.uploaded":           "🖼️",
  "proof.approved":           "✅",
  "proof.revision_requested": "🔄",
  "payment.received":         "💳",
  "order.in_production":      "🏭",
  "order.shipped":            "🚚",
  "order.delivered":          "🎉",
  "order.cancelled":          "❌",
  "order.partial_refund":     "↩️",
  "order.refunded":           "💸",
  "admin.revision_reply":     "💬",
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderDetailClient({ detail }: Props) {
  const { order, items, events, proofs, canApprove, canRequestRevision } = detail;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reordering, setReordering] = useState(false);

  const [revisionMode, setRevisionMode] = useState(false);
  const [revisionMsg, setRevisionMsg] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Show payment success/cancelled banner from Stripe redirect
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const paymentStatus = searchParams?.get("payment");

  const colors = STATUS_COLORS[order.status] ?? STATUS_COLORS["cancelled"]!;
  const latestProof = proofs[0];

  function handleApprove() {
    startTransition(async () => {
      const res = await approveProof(order.id);
      if (res.ok) {
        setFeedback({ ok: true, message: "BAT approuvé ! Votre commande passe en production." });
        router.refresh();
      } else {
        setFeedback({ ok: false, message: res.error });
      }
    });
  }

  function handleRevision() {
    if (!revisionMsg.trim() || revisionMsg.trim().length < 10) {
      setFeedback({ ok: false, message: "Votre message doit faire au moins 10 caractères." });
      return;
    }
    startTransition(async () => {
      const res = await requestProofRevision({ orderId: order.id, message: revisionMsg.trim() });
      if (res.ok) {
        setFeedback({ ok: true, message: "Demande de révision envoyée. Notre équipe vous recontacte sous 24h." });
        setRevisionMode(false);
        setRevisionMsg("");
        router.refresh();
      } else {
        setFeedback({ ok: false, message: res.error });
      }
    });
  }

  return (
    <div>
      {/* Back */}
      <Link
        href="/account/orders"
        style={{ fontSize: 13, color: "#6B7280", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 24 }}
      >
        ← Mes commandes
      </Link>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", color: "#0A0E27", margin: 0 }}>
              Commande #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.text,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>
            Passée le {formatDate(order.createdAt)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0A0E27", letterSpacing: "-0.02em" }}>
            {euros(order.totalCents)}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 12 }}>TTC</div>
          <button
            onClick={async () => {
              setReordering(true);
              const res = await reorderFromOrder(order.id);
              setReordering(false);
              if (res.ok) router.push("/checkout");
            }}
            disabled={reordering}
            style={{
              padding: "9px 16px",
              background: reordering ? "#E5E7EB" : "#DC2626",
              color: reordering ? "#9CA3AF" : "#fff",
              border: "1.5px solid var(--ink)",
              borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: reordering ? "not-allowed" : "pointer",
              fontFamily: "var(--font-archivo), monospace", whiteSpace: "nowrap",
            }}
          >
            {reordering ? "⏳ Chargement…" : "↺ Recommander"}
          </button>
        </div>
      </div>

      {/* Stripe payment result banners */}
      {paymentStatus === "success" && (
        <div style={{ padding: "14px 20px", borderRadius: 10, background: "#D1FAE5", border: "1px solid #6EE7B7", color: "#065F46", fontWeight: 700, fontSize: 14, marginBottom: 24 }}>
          ✅ Paiement confirmé ! Votre commande est en cours de traitement.
        </div>
      )}
      {paymentStatus === "cancelled" && (
        <div style={{ padding: "14px 20px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E", fontWeight: 700, fontSize: 14, marginBottom: 24 }}>
          Le paiement a été annulé. Vous pouvez réessayer ci-dessous.
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: feedback.ok ? "#D1FAE5" : "#FEE2E2",
            border: `1px solid ${feedback.ok ? "#6EE7B7" : "#FCA5A5"}`,
            color: feedback.ok ? "#065F46" : "#991B1B",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          {feedback.message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Payment card — when status is approved */}
          {order.status === "approved" && (
            <section
              style={{
                background: "#F0FDF4",
                border: "2px solid #86EFAC",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#14532D", margin: "0 0 6px" }}>
                ✅ BAT validé — mise en production
              </h2>
              <p style={{ fontSize: 13, color: "#374151" }}>
                Vous avez approuvé votre bon à tirer. Notre équipe lance la production de votre commande.
              </p>
            </section>
          )}

          {/* BAT Action card — only when proof_sent */}
          {(canApprove || canRequestRevision) && (
            <section
              style={{
                background: "#EFF6FF",
                border: "2px solid #93C5FD",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1E40AF", margin: "0 0 6px" }}>
                🖼️ Votre bon à tirer est prêt
              </h2>
              <p style={{ fontSize: 13, color: "#374151", marginBottom: 20 }}>
                Notre équipe a préparé votre BAT. Vérifiez-le attentivement, puis validez ou demandez une modification.
              </p>

              {/* Proof file */}
              {latestProof && (
                <a
                  href={latestProof.storageKey}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    background: "#1E40AF",
                    color: "#fff",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 20,
                  }}
                >
                  📄 Voir le BAT v{latestProof.version}
                  {latestProof.originalFilename ? ` — ${latestProof.originalFilename}` : ""}
                </a>
              )}

              {!revisionMode ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={handleApprove}
                    disabled={isPending}
                    style={{
                      padding: "12px 24px",
                      background: "#16A34A",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: isPending ? "wait" : "pointer",
                      opacity: isPending ? 0.7 : 1,
                      fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    }}
                  >
                    ✅ Approuver le BAT
                  </button>
                  <button
                    onClick={() => { setRevisionMode(true); setFeedback(null); }}
                    disabled={isPending}
                    style={{
                      padding: "12px 24px",
                      background: "#fff",
                      color: "#DC2626",
                      border: "2px solid #DC2626",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isPending ? "wait" : "pointer",
                      fontFamily: "var(--font-archivo), system-ui, sans-serif",
                    }}
                  >
                    🔄 Demander une modification
                  </button>
                </div>
              ) : (
                <div>
                  <textarea
                    placeholder="Décrivez les modifications souhaitées (couleur, texte, forme, position…)"
                    rows={4}
                    value={revisionMsg}
                    onChange={(e) => setRevisionMsg(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1.5px solid #D1D5DB",
                      borderRadius: 8,
                      fontSize: 14,
                      fontFamily: "var(--font-archivo), system-ui, sans-serif",
                      resize: "vertical",
                      boxSizing: "border-box",
                      marginBottom: 12,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={handleRevision}
                      disabled={isPending || revisionMsg.trim().length < 10}
                      style={{
                        padding: "10px 20px",
                        background: "#DC2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: isPending || revisionMsg.trim().length < 10 ? "not-allowed" : "pointer",
                        opacity: revisionMsg.trim().length < 10 ? 0.6 : 1,
                        fontFamily: "var(--font-archivo), system-ui, sans-serif",
                      }}
                    >
                      Envoyer la demande
                    </button>
                    <button
                      onClick={() => { setRevisionMode(false); setRevisionMsg(""); }}
                      style={{
                        padding: "10px 20px",
                        background: "#F3F4F6",
                        color: "#374151",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "var(--font-archivo), system-ui, sans-serif",
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                    {revisionMsg.trim().length}/10 caractères minimum
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Tracking info */}
          {order.trackingNumber && (
            <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 12px" }}>
                🚚 Suivi colis
              </h2>
              <div style={{ fontSize: 14, color: "#374151" }}>
                <span style={{ color: "#6B7280" }}>Transporteur : </span>
                <strong>{order.trackingCarrier ?? "—"}</strong>
              </div>
              <div style={{ fontSize: 14, color: "#374151", marginTop: 4 }}>
                <span style={{ color: "#6B7280" }}>Numéro de suivi : </span>
                <strong style={{ fontFamily: "monospace" }}>{order.trackingNumber}</strong>
              </div>
            </section>
          )}

          {/* Order items */}
          <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px" }}>
              Détail de la commande
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "12px 0",
                    borderBottom: "1px solid #F3F4F6",
                    gap: 12,
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: 56, height: 56, borderRadius: 8, flexShrink: 0,
                    border: "1px solid #E5E7EB", overflow: "hidden",
                    background: item.customerFile?.url ? "transparent" : "#F9FAFB",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {item.customerFile?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.customerFile.url} alt={item.customerFile.filename ?? "Design"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 22, color: "#D1D5DB" }}>🏷️</span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0A0E27" }}>
                      {item.productName ?? "Sticker personnalisé"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                      {item.widthMm && item.heightMm ? `${item.widthMm}×${item.heightMm} mm — ` : ""}{item.shape ? `${item.shape} — ` : ""}{item.quantity} unité{item.quantity > 1 ? "s" : ""}
                    </div>
                    {item.customerFile && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#16A34A", display: "flex", alignItems: "center", gap: 4 }}>
                          <span>✅</span>
                          <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.customerFile.filename ?? "Design attaché"}
                          </span>
                        </span>
                        <a
                          href={item.customerFile.url}
                          download={item.customerFile.filename ?? "design"}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "3px 10px", fontSize: 10, fontWeight: 700,
                            background: "transparent", border: "1px solid #16A34A",
                            borderRadius: 6, color: "#16A34A", textDecoration: "none",
                            fontFamily: "var(--font-archivo), monospace", whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          ⬇ Télécharger
                        </a>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0A0E27" }}>
                      {euros(item.lineTotalCents)}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {euros(item.unitPriceCents)} / u.
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              {order.shippingCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6B7280" }}>
                  <span>Livraison</span>
                  <span>{euros(order.shippingCents)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6B7280" }}>
                <span>TVA ({Number(order.vatRate ?? 0.2) * 100}%)</span>
                <span>{euros(order.taxAmountCents)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#0A0E27",
                  borderTop: "2px solid #E5E7EB",
                  paddingTop: 10,
                  marginTop: 6,
                }}
              >
                <span>Total TTC</span>
                <span>{euros(order.totalCents)}</span>
              </div>
            </div>
          </section>

          {/* Refund info */}
          {order.totalRefundedCents > 0 && (
            <section style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: "#991B1B", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                ↩️ Remboursement
              </h2>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6B7280", marginBottom: 6 }}>
                <span>Montant payé</span>
                <span style={{ textDecoration: "line-through" }}>{euros(order.totalCents)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#DC2626", fontWeight: 700, marginBottom: 6 }}>
                <span>Remboursé</span>
                <span>− {euros(order.totalRefundedCents)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, color: "#0A0E27", borderTop: "1px solid #FCA5A5", paddingTop: 10, marginTop: 4 }}>
                <span>Net encaissé</span>
                <span>{euros(Math.max(0, order.totalCents - order.totalRefundedCents))}</span>
              </div>
              {order.pennylaneInvoiceUrl && (
                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href={order.pennylaneInvoiceUrl} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, background: "#fff", border: "1.5px solid #FCA5A5", borderRadius: 8, color: "#991B1B", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                    📄 Facture originale
                  </a>
                </div>
              )}
            </section>
          )}

          {/* Invoice */}
          {(order.pennylaneInvoiceUrl ?? order.pennylaneInvoiceId) && order.totalRefundedCents === 0 && (
            <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 12px" }}>🧾 Facture</h2>
              {order.pennylaneInvoiceUrl ? (
                <a href={order.pennylaneInvoiceUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, background: "#F3F4F6", border: "1.5px solid #E5E7EB", borderRadius: 8, color: "#0A0E27", textDecoration: "none" }}>
                  📄 Télécharger la facture
                </a>
              ) : (
                <p style={{ fontSize: 13, color: "#6B7280" }}>Votre facture est en cours de génération, elle sera disponible sous peu.</p>
              )}
            </section>
          )}

          {/* Addresses & Delivery */}
          {(order.shippingAddress ?? order.deliveryMethod) && (
            <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px" }}>📦 Livraison</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {order.shippingAddress && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Adresse de livraison</div>
                    <AddressBlock address={order.shippingAddress} />
                  </div>
                )}
                {order.billingAddress && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Adresse de facturation</div>
                    <AddressBlock address={order.billingAddress} />
                  </div>
                )}
              </div>
              {order.deliveryMethod && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{order.deliveryMethod === "express" ? "⚡" : "🚚"}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {order.deliveryMethod === "express" ? "Chronopost Express" : "Colissimo Standard"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                      {order.deliveryMethod === "express" ? "Livraison sous 24h" : "2-3 jours ouvrés"}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Tracking */}
          {order.trackingNumber && (
            <section style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: "#14532D", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                🚚 Suivi de livraison
              </h2>
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
                <span style={{ color: "#6B7280" }}>Transporteur : </span>
                <strong>{order.trackingCarrier ?? "Colissimo"}</strong>
                <span style={{ marginLeft: 16, color: "#6B7280" }}>N° : </span>
                <strong style={{ fontFamily: "monospace", fontSize: 14 }}>{order.trackingNumber}</strong>
              </div>
              <a
                href={
                  order.trackingCarrier?.toLowerCase().includes("chronopost")
                    ? `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${order.trackingNumber}`
                    : `https://www.laposte.fr/outils/suivre-vos-envois?code=${order.trackingNumber}`
                }
                target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, background: "#16A34A", color: "#fff", border: "2px solid #14532D", borderRadius: 8, textDecoration: "none" }}
              >
                📍 Suivre mon colis →
              </a>
            </section>
          )}

          {/* Customer notes */}
          {order.notes && (
            <section style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>Note transmise</div>
              <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.6 }}>{order.notes}</p>
            </section>
          )}
        </div>

        {/* Right column — Timeline */}
        <div>
          <section style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px" }}>
              Historique
            </h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {events.filter((ev) => ev.type in EVENT_LABELS).map((ev, i, arr) => (
                <div key={ev.id} style={{ display: "flex", gap: 12, position: "relative" }}>
                  {/* Line */}
                  {i < arr.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 15,
                        top: 30,
                        bottom: -4,
                        width: 2,
                        background: "#E5E7EB",
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "#F3F4F6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      flexShrink: 0,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {EVENT_ICONS[ev.type] ?? "•"}
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0A0E27" }}>
                      {EVENT_LABELS[ev.type] ?? ev.type}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                      {formatDate(ev.createdAt)}
                    </div>
                    {/* Card last4 on payment received */}
                    {ev.type === "payment.received" && order.cardLast4 && (
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <span>💳</span> Carte se terminant par <strong>{order.cardLast4}</strong>
                      </div>
                    )}
                    {/* Refund amount */}
                    {(ev.type === "order.partial_refund" || ev.type === "order.refunded" || ev.type === "payment.refunded") && (
                      (() => {
                        const p = ev.payload as Record<string, unknown> | null;
                        const amt = typeof p?.amountCents === "number" ? p.amountCents : typeof p?.amountRefunded === "number" ? p.amountRefunded : null;
                        return amt ? (
                          <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginTop: 4 }}>
                            Montant : {euros(amt)}
                            {typeof p?.reason === "string" && p.reason && (
                              <span style={{ fontWeight: 400, color: "#6B7280", marginLeft: 6 }}>— {p.reason}</span>
                            )}
                          </div>
                        ) : null;
                      })()
                    )}
                    {ev.type === "proof.revision_requested" && ev.payload && typeof ev.payload === "object" && (ev.payload as Record<string, unknown>).message ? (
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6, fontStyle: "italic", borderLeft: "2px solid #E5E7EB", paddingLeft: 8 }}>
                        &ldquo;{String((ev.payload as Record<string, unknown>).message)}&rdquo;
                      </div>
                    ) : null}
                    {ev.type === "admin.revision_reply" && ev.payload && typeof ev.payload === "object" && (ev.payload as Record<string, unknown>).reply ? (
                      <div style={{ marginTop: 6, padding: "8px 12px", background: "#EDE9FE", border: "1px solid #C4B5FD", borderRadius: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#5B21B6", marginBottom: 2 }}>Message de notre équipe :</div>
                        <div style={{ fontSize: 12, color: "#4C1D95", whiteSpace: "pre-wrap" }}>{String((ev.payload as Record<string, unknown>).reply)}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AddressBlock({ address }: {
  address: { firstName: string | null; lastName: string | null; line1: string; line2: string | null; postalCode: string; city: string; countryCode: string; phone: string | null };
}) {
  return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
      {(address.firstName ?? address.lastName) && (
        <div style={{ fontWeight: 600 }}>{[address.firstName, address.lastName].filter(Boolean).join(" ")}</div>
      )}
      <div>{address.line1}</div>
      {address.line2 && <div>{address.line2}</div>}
      <div>{address.postalCode} {address.city}</div>
      {address.phone && <div style={{ color: "#6B7280" }}>{address.phone}</div>}
    </div>
  );
}
