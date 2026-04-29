"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteDiscount, updateDiscount } from "@/lib/discount-actions";
import type { Discount } from "@/db/schema";

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  ACTIVE:              { bg: "#D1FAE5", text: "#065F46" },
  SCHEDULED:           { bg: "#DBEAFE", text: "#1E40AF" },
  EXPIRED:             { bg: "#F3F4F6", text: "#6B7280" },
  DISABLED:            { bg: "#FEE2E2", text: "#991B1B" },
  DRAFT:               { bg: "#FEF3C7", text: "#92400E" },
  USAGE_LIMIT_REACHED: { bg: "#FEF3C7", text: "#92400E" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLOR[status] ?? { bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: colors.bg, color: colors.text }}>
      {status}
    </span>
  );
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export function DiscountListClient({ initialDiscounts }: { initialDiscounts: Discount[] }) {
  const [discounts, setDiscounts] = useState(initialDiscounts);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette réduction ?")) return;
    startTransition(async () => {
      await deleteDiscount(id);
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
    });
  }

  function handleToggle(d: Discount) {
    const newStatus = d.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    startTransition(async () => {
      await updateDiscount(d.id, { status: newStatus as "ACTIVE" | "DISABLED" });
      setDiscounts((prev) => prev.map((x) => x.id === d.id ? { ...x, status: newStatus } : x));
    });
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 24, fontWeight: 900, color: "#0A0E27", margin: "0 0 4px" }}>
            Réductions
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
            {discounts.length} réduction{discounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/discounts/new"
          style={{ padding: "10px 20px", background: "#0B3D91", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: "var(--font-archivo), monospace" }}
        >
          + Créer
        </Link>
      </div>

      {discounts.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "48px 24px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
          Aucune réduction. Créez votre premier code promo.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                {["Titre", "Code", "Type", "Valeur", "Utilisations", "Validité", "Statut", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {discounts.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < discounts.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0A0E27" }}>
                    {d.title}
                    {d.internalName && <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400 }}>{d.internalName}</div>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {d.code ? (
                      <code style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}>{d.code}</code>
                    ) : (
                      <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>Automatique</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#374151" }}>{d.type}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                    {d.type === "PERCENTAGE" && `${d.value ?? 0} %`}
                    {d.type === "FIXED_AMOUNT" && `${((d.value ?? 0) / 100).toFixed(2)} €`}
                    {d.type === "FREE_SHIPPING" && "Livraison offerte"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {d.usageCount}
                    {d.globalUsageLimit != null && ` / ${d.globalUsageLimit}`}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>
                    {formatDate(d.startsAt)}
                    {d.endsAt && <> → {formatDate(d.endsAt)}</>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={d.status} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/admin/discounts/${d.id}`}
                        style={{ padding: "4px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, color: "#374151", textDecoration: "none" }}
                      >
                        Modifier
                      </Link>
                      <button
                        onClick={() => handleToggle(d)}
                        disabled={isPending}
                        style={{ padding: "4px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, background: "transparent", cursor: "pointer", color: d.status === "ACTIVE" ? "#DC2626" : "#059669" }}
                      >
                        {d.status === "ACTIVE" ? "Désactiver" : "Activer"}
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        disabled={isPending}
                        style={{ padding: "4px 10px", border: "1px solid #FCA5A5", borderRadius: 6, fontSize: 12, background: "transparent", cursor: "pointer", color: "#DC2626" }}
                      >
                        Suppr.
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
