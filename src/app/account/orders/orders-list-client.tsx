"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reorderFromOrder, type CustomerOrderRow } from "@/lib/customer-actions";

const STATUS_LABELS: Record<string, string> = {
  proof_pending: "BAT en attente",
  proof_sent: "BAT envoyé",
  proof_revision_requested: "Révision demandée",
  approved: "Approuvé",
  paid: "Payé",
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

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

interface Props {
  orders: CustomerOrderRow[];
}

export default function OrdersListClient({ orders }: Props) {
  const router = useRouter();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  async function handleReorder(orderId: string) {
    setReorderingId(orderId);
    const res = await reorderFromOrder(orderId);
    setReorderingId(null);
    if (res.ok) {
      router.push("/checkout");
    }
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-archivo), system-ui, sans-serif",
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: "#0A0E27",
          margin: "0 0 8px",
        }}
      >
        Mes commandes
      </h1>
      <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 32 }}>
        Suivez l'avancement de vos commandes et validez vos BAT.
      </p>

      {orders.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1.5px solid #E5E7EB",
            borderRadius: 12,
            padding: "60px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0A0E27", marginBottom: 8 }}>
            Aucune commande
          </h2>
          <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 24 }}>
            Vous n'avez pas encore passé de commande.
          </p>
          <Link
            href="/custom-stickers"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "#DC2626",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Découvrir nos stickers →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.map((order) => {
            const colors = STATUS_COLORS[order.status] ?? STATUS_COLORS["cancelled"]!;
            const needsAction = order.status === "proof_sent";
            const isReordering = reorderingId === order.id;

            return (
              <div
                key={order.id}
                style={{
                  background: "#fff",
                  border: `1.5px solid ${needsAction ? "#DC2626" : "#E5E7EB"}`,
                  borderRadius: 12,
                  padding: "20px 24px",
                  boxShadow: needsAction ? "0 0 0 3px rgba(220,38,38,0.1)" : "none",
                }}
              >
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                      background: order.thumbnail ? "transparent" : "#F3F4F6",
                      border: "1px solid #E5E7EB",
                      overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {order.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.thumbnail}
                        alt="Design"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 28, color: "#D1D5DB" }}>🏷️</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 13, color: "#9CA3AF", fontWeight: 600 }}>
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 999,
                          border: `1px solid ${colors.border}`,
                          background: colors.bg,
                          color: colors.text,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      {needsAction && (
                        <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 700 }}>← Action requise</span>
                      )}
                    </div>

                    <div style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>
                      {order.productName ?? "Commande personnalisée"}
                      {order.itemCount > 1 && (
                        <span style={{ color: "#9CA3AF", fontWeight: 400, marginLeft: 6 }}>
                          + {order.itemCount - 1} autre{order.itemCount > 2 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                      {new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(order.createdAt))}
                    </div>
                  </div>

                  {/* Right: total + actions */}
                  <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0A0E27", letterSpacing: "-0.02em" }}>
                        {euros(order.totalCents)}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>TTC</div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/account/orders/${order.id}`}
                        style={{
                          padding: "7px 14px", background: "transparent",
                          border: "1.5px solid #E5E7EB", borderRadius: 8,
                          fontSize: 12, fontWeight: 700, color: "#374151",
                          textDecoration: "none", fontFamily: "var(--font-archivo), monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Détail →
                      </Link>
                      <button
                        onClick={() => void handleReorder(order.id)}
                        disabled={isReordering}
                        style={{
                          padding: "7px 14px",
                          background: isReordering ? "#E5E7EB" : "#DC2626",
                          color: isReordering ? "#9CA3AF" : "#fff",
                          border: "1.5px solid var(--ink)",
                          borderRadius: 8, fontSize: 12, fontWeight: 700,
                          cursor: isReordering ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-archivo), monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isReordering ? "⏳" : "↺ Recommander"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
