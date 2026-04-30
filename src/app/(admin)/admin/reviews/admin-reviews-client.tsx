"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { publishReview, rejectReview } from "@/lib/review-actions";
import type { ReviewRow, ReviewStatus } from "@/lib/reviews/review-types";
import {
  AdminTopbar,
  AdminPage,
  AdminCard,
  AdminTableWrapper,
  AdminTableHead,
  AdminEmptyState,
  StatusBadge,
  PrimaryBtn,
  SecondaryBtn,
  DangerBtn,
  KpiCard,
  T,
} from "@/components/admin/admin-ui";
import type { BadgeVariant } from "@/components/admin/admin-ui";

interface Props {
  initial: { reviews: ReviewRow[]; total: number; page: number; limit: number };
}

const STATUS_META: Record<ReviewStatus, { label: string; variant: BadgeVariant }> = {
  pending:   { label: "En attente", variant: "warning"  },
  published: { label: "Publié",     variant: "success"  },
  rejected:  { label: "Rejeté",     variant: "danger"   },
  archived:  { label: "Archivé",    variant: "neutral"  },
};

const STARS = (n: number) => (
  <span style={{ letterSpacing: 0 }}>
    {Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < n ? "#F59E0B" : "#E5E7EB", fontSize: 14 }}>★</span>
    ))}
  </span>
);

export default function AdminReviewsClient({ initial }: Props) {
  const [reviews, setReviews] = useState(initial.reviews);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<"" | "product" | "store">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { status?: ReviewStatus | ""; type?: "" | "product" | "store"; q?: string; p?: number } = {}) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const s = opts.status ?? statusFilter;
        const t = opts.type ?? typeFilter;
        const q = opts.q ?? search;
        const pg = opts.p ?? 1;
        if (s) params.set("status", s);
        if (t) params.set("type", t);
        if (q) params.set("q", q);
        params.set("page", String(pg));
        params.set("limit", "20");
        const res = await fetch(`/api/admin/reviews?${params}`);
        const data = await res.json();
        setReviews(data.reviews);
        setTotal(data.total);
        setPage(data.page);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, typeFilter, search],
  );

  async function handlePublish(id: string) {
    setActionId(id);
    startTransition(async () => {
      await publishReview(id);
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "published" as ReviewStatus } : r)));
      setActionId(null);
    });
  }

  async function handleReject(id: string) {
    setActionId(id);
    startTransition(async () => {
      await rejectReview(id);
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" as ReviewStatus } : r)));
      setActionId(null);
    });
  }

  const totalPages = Math.ceil(total / 20);

  // Counts from initial data (static)
  const counts: Record<ReviewStatus, number> = { pending: 0, published: 0, rejected: 0, archived: 0 };
  for (const r of initial.reviews) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const pendingCount = counts.pending;

  return (
    <>
      <AdminTopbar
        title="Avis clients"
        subtitle={`${total} avis`}
      >
        {pendingCount > 0 && (
          <span
            style={{
              background: T.warningBg,
              color: T.warning,
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 99,
            }}
          >
            {pendingCount} en attente
          </span>
        )}
        <SecondaryBtn href="/admin/reviews/requests" style={{ fontSize: 12 }}>
          📨 Demandes
        </SecondaryBtn>
        <SecondaryBtn href="/admin/reviews/settings" style={{ fontSize: 12 }}>
          ⚙️ Paramètres
        </SecondaryBtn>
      </AdminTopbar>

      <AdminPage>
        {/* KPI stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {(["pending", "published", "rejected", "archived"] as ReviewStatus[]).map((s) => {
            const meta = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => {
                  const next = active ? ("" as const) : s;
                  setStatusFilter(next);
                  load({ status: next, p: 1 });
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <AdminCard
                  padding="14px 18px"
                  style={{
                    border: active ? `2px solid ${T.brand}` : undefined,
                    transition: "box-shadow 0.15s",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.03em" }}>
                    {counts[s]}
                  </div>
                </AdminCard>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <AdminCard padding="12px 16px" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: T.textSecondary }}>🔍</span>
              <input
                type="text"
                placeholder="Rechercher auteur, email, contenu…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load({ q: search, p: 1 })}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 30px",
                  borderRadius: T.radiusSm,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 13,
                  background: T.bg,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Statut */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>Statut</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  const v = e.target.value as ReviewStatus | "";
                  setStatusFilter(v);
                  load({ status: v, p: 1 });
                }}
                style={{ padding: "7px 10px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 13, background: T.bg }}
              >
                <option value="">Tous</option>
                <option value="pending">En attente</option>
                <option value="published">Publiés</option>
                <option value="rejected">Rejetés</option>
                <option value="archived">Archivés</option>
              </select>
            </div>

            {/* Type */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>Type</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  const v = e.target.value as "" | "product" | "store";
                  setTypeFilter(v);
                  load({ type: v, p: 1 });
                }}
                style={{ padding: "7px 10px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 13, background: T.bg }}
              >
                <option value="">Tous</option>
                <option value="product">Produit</option>
                <option value="store">Boutique</option>
              </select>
            </div>

            {(statusFilter || typeFilter || search) && (
              <SecondaryBtn
                onClick={() => {
                  setStatusFilter("");
                  setTypeFilter("");
                  setSearch("");
                  load({ status: "", type: "", q: "", p: 1 });
                }}
                style={{ padding: "6px 12px", fontSize: 12 }}
              >
                ✕ Réinitialiser
              </SecondaryBtn>
            )}
          </div>
        </AdminCard>

        {/* Table */}
        <AdminTableWrapper>
          {loading ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: T.textSecondary, fontSize: 14 }}>
              Chargement…
            </div>
          ) : reviews.length === 0 ? (
            <AdminEmptyState icon="💬" title="Aucun avis trouvé" subtitle="Modifiez les filtres ou attendez les premières soumissions." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Avis", "Note", "Type", "Statut", "Date", ""]} />
              <tbody>
                {reviews.map((review, i) => {
                  const meta = STATUS_META[review.status];
                  const isActing = actionId === review.id;
                  return (
                    <tr
                      key={review.id}
                      style={{
                        borderBottom: i < reviews.length - 1 ? `1px solid ${T.borderSubtle}` : "none",
                        opacity: isActing ? 0.5 : 1,
                      }}
                      className="admin-table-row"
                    >
                      {/* Avis */}
                      <td style={{ padding: "14px 16px", maxWidth: 380 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary, marginBottom: 1 }}>
                          {review.displayName ?? review.customerName ?? "Anonyme"}
                        </div>
                        <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: review.title || review.body ? 5 : 0 }}>
                          {review.customerEmail}
                        </div>
                        {review.title && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 2 }}>{review.title}</div>
                        )}
                        {review.body && (
                          <div style={{
                            fontSize: 12,
                            color: T.textSecondary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical" as const,
                          }}>
                            {review.body}
                          </div>
                        )}
                      </td>

                      {/* Note */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {STARS(review.rating)}
                        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{review.rating}/5</div>
                      </td>

                      {/* Type */}
                      <td style={{ padding: "14px 16px" }}>
                        <StatusBadge
                          label={review.type === "product" ? "Produit" : "Boutique"}
                          variant={review.type === "product" ? "info" : "purple"}
                          dot={false}
                        />
                      </td>

                      {/* Statut */}
                      <td style={{ padding: "14px 16px" }}>
                        <StatusBadge label={meta.label} variant={meta.variant} />
                      </td>

                      {/* Date */}
                      <td style={{ padding: "14px 16px", fontSize: 12, color: T.textSecondary, whiteSpace: "nowrap" }}>
                        {new Date(review.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <SecondaryBtn
                            href={`/admin/reviews/${review.id}`}
                            style={{ padding: "5px 10px", fontSize: 12 }}
                          >
                            Voir →
                          </SecondaryBtn>
                          {review.status === "pending" && (
                            <>
                              <PrimaryBtn
                                onClick={() => handlePublish(review.id)}
                                disabled={isActing}
                                style={{ padding: "5px 10px", fontSize: 12, background: T.success }}
                              >
                                ✓ Publier
                              </PrimaryBtn>
                              <DangerBtn
                                onClick={() => handleReject(review.id)}
                                disabled={isActing}
                                style={{ padding: "5px 10px", fontSize: 12 }}
                              >
                                ✕
                              </DangerBtn>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </AdminTableWrapper>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 }}>
            <SecondaryBtn onClick={() => load({ p: page - 1 })} disabled={page <= 1}>
              ← Précédent
            </SecondaryBtn>
            <span style={{ fontSize: 13, color: T.textSecondary, padding: "0 8px" }}>
              Page {page} / {totalPages}
            </span>
            <SecondaryBtn onClick={() => load({ p: page + 1 })} disabled={page >= totalPages}>
              Suivant →
            </SecondaryBtn>
          </div>
        )}
      </AdminPage>
    </>
  );
}
