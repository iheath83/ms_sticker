"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteDiscount, updateDiscount } from "@/lib/discount-actions";
import type { Discount } from "@/db/schema";
import {
  AdminTopbar,
  AdminPage,
  AdminTableWrapper,
  AdminTableHead,
  AdminEmptyState,
  StatusBadge,
  PrimaryBtn,
  SecondaryBtn,
  DangerBtn,
  T,
} from "@/components/admin/admin-ui";
import type { BadgeVariant } from "@/components/admin/admin-ui";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE:              "success",
  SCHEDULED:           "info",
  EXPIRED:             "neutral",
  DISABLED:            "danger",
  DRAFT:               "warning",
  USAGE_LIMIT_REACHED: "warning",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:              "Actif",
  SCHEDULED:           "Planifié",
  EXPIRED:             "Expiré",
  DISABLED:            "Désactivé",
  DRAFT:               "Brouillon",
  USAGE_LIMIT_REACHED: "Limite atteinte",
};

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
      setDiscounts((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: newStatus } : x)));
    });
  }

  return (
    <>
      <AdminTopbar
        title="Réductions"
        subtitle={`${discounts.length} réduction${discounts.length !== 1 ? "s" : ""}`}
      >
        <PrimaryBtn href="/admin/discounts/new">+ Créer</PrimaryBtn>
      </AdminTopbar>

      <AdminPage>
        <AdminTableWrapper>
          {discounts.length === 0 ? (
            <AdminEmptyState
              icon="🏷️"
              title="Aucune réduction"
              subtitle="Créez votre premier code promo."
            />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <AdminTableHead cols={["Titre", "Code", "Type", "Valeur", "Utilisations", "Validité", "Statut", ""]} />
              <tbody>
                {discounts.map((d, i) => (
                  <tr
                    key={d.id}
                    style={{ borderBottom: i < discounts.length - 1 ? `1px solid ${T.borderSubtle}` : "none" }}
                    className="admin-table-row"
                  >
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ fontWeight: 700, color: T.textPrimary }}>{d.title}</div>
                      {d.internalName && (
                        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{d.internalName}</div>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      {d.code ? (
                        <code
                          style={{
                            background: T.bg,
                            border: `1.5px solid ${T.border}`,
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontFamily: "monospace",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {d.code}
                        </code>
                      ) : (
                        <span style={{ color: T.textDisabled, fontStyle: "italic", fontSize: 12 }}>Automatique</span>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px", color: T.textSecondary, fontSize: 12 }}>{d.type}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 700, color: T.textPrimary }}>
                      {d.type === "PERCENTAGE" && `${d.value ?? 0} %`}
                      {d.type === "FIXED_AMOUNT" && `${((d.value ?? 0) / 100).toFixed(2)} €`}
                      {d.type === "FREE_SHIPPING" && "Livraison offerte"}
                    </td>
                    <td style={{ padding: "13px 16px", color: T.textSecondary }}>
                      <span style={{ fontWeight: 700, color: T.textPrimary }}>{d.usageCount}</span>
                      {d.globalUsageLimit != null && (
                        <span style={{ color: T.textSecondary }}> / {d.globalUsageLimit}</span>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: T.textSecondary }}>
                      {formatDate(d.startsAt)}
                      {d.endsAt && <> → {formatDate(d.endsAt)}</>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <StatusBadge
                        label={STATUS_LABELS[d.status] ?? d.status}
                        variant={STATUS_VARIANT[d.status] ?? "neutral"}
                      />
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <SecondaryBtn
                          href={`/admin/discounts/${d.id}`}
                          style={{ padding: "5px 10px", fontSize: 12 }}
                        >
                          Modifier
                        </SecondaryBtn>
                        <SecondaryBtn
                          onClick={() => handleToggle(d)}
                          disabled={isPending}
                          style={{
                            padding: "5px 10px",
                            fontSize: 12,
                            color: d.status === "ACTIVE" ? T.danger : T.success,
                            borderColor: d.status === "ACTIVE" ? "#FCA5A5" : "#A7F3D0",
                          }}
                        >
                          {d.status === "ACTIVE" ? "Désactiver" : "Activer"}
                        </SecondaryBtn>
                        <DangerBtn
                          onClick={() => handleDelete(d.id)}
                          disabled={isPending}
                          style={{ padding: "5px 10px", fontSize: 12 }}
                        >
                          Suppr.
                        </DangerBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AdminTableWrapper>
      </AdminPage>
    </>
  );
}
