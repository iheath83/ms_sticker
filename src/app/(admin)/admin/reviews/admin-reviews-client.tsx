"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { publishReview, rejectReview } from "@/lib/review-actions";
import type { ReviewRow, ReviewStatus } from "@/lib/reviews/review-types";

interface Props {
  initial: { reviews: ReviewRow[]; total: number; page: number; limit: number };
}

const STATUS_META: Record<ReviewStatus, { label: string; color: string; bg: string; dot: string }> = {
  pending:  { label: "En attente", color: "#92400E", bg: "#FEF3C7", dot: "#F59E0B" },
  published:{ label: "Publié",     color: "#065F46", bg: "#D1FAE5", dot: "#10B981" },
  rejected: { label: "Rejeté",     color: "#991B1B", bg: "#FEE2E2", dot: "#EF4444" },
  archived: { label: "Archivé",    color: "#374151", bg: "#F3F4F6", dot: "#9CA3AF" },
};

const STARS = (n: number) => (
  <span style={{ letterSpacing: -1 }}>
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
  const [pendingId, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async (
    opts: { status?: ReviewStatus | ""; type?: "" | "product" | "store"; q?: string; p?: number } = {}
  ) => {
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
  }, [statusFilter, typeFilter, search]);

  async function handlePublish(id: string) {
    setActionId(id);
    startTransition(async () => {
      await publishReview(id);
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: "published" as ReviewStatus } : r));
      setActionId(null);
    });
  }

  async function handleReject(id: string) {
    setActionId(id);
    startTransition(async () => {
      await rejectReview(id);
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: "rejected" as ReviewStatus } : r));
      setActionId(null);
    });
  }

  const totalPages = Math.ceil(total / 20);
  const pendingCount = reviews.filter((r) => r.status === "pending").length;

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: "#F5F2EC" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0A0E27", letterSpacing: "-0.02em", margin: 0 }}>
            Avis clients
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
            {total} avis au total
            {pendingCount > 0 && (
              <span style={{ marginLeft: 10, background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                {pendingCount} en attente de modération
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/admin/reviews/requests"
            style={{
              padding: "9px 18px", borderRadius: 8, background: "#fff", border: "1.5px solid #E5E7EB",
              fontSize: 13, fontWeight: 600, color: "#374151", textDecoration: "none",
            }}
          >
            📨 Demandes d&apos;avis
          </Link>
          <Link
            href="/admin/reviews/settings"
            style={{
              padding: "9px 18px", borderRadius: 8, background: "#fff", border: "1.5px solid #E5E7EB",
              fontSize: 13, fontWeight: 600, color: "#374151", textDecoration: "none",
            }}
          >
            ⚙️ Paramètres
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {(Object.keys(STATUS_META) as ReviewStatus[]).map((s) => {
          const count = initial.reviews.filter((r) => r.status === s).length;
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => {
                const next = statusFilter === s ? "" : s;
                setStatusFilter(next);
                load({ status: next, p: 1 });
              }}
              style={{
                background: statusFilter === s ? meta.bg : "#fff",
                border: `1.5px solid ${statusFilter === s ? meta.dot : "#E5E7EB"}`,
                borderRadius: 12, padding: "16px 20px", cursor: "pointer", textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot, display: "inline-block" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0A0E27", letterSpacing: "-0.03em" }}>{count}</div>
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12,
        padding: "16px 20px", marginBottom: 20,
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
      }}>
        {/* Search */}
        <div style={{ flex: "1 1 260px", position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 15 }}>🔍</span>
          <input
            type="text"
            placeholder="Rechercher (auteur, email, contenu…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load({ q: search, p: 1 })}
            style={{
              width: "100%", padding: "9px 12px 9px 34px", borderRadius: 8,
              border: "1.5px solid #E5E7EB", fontSize: 13, color: "#0A0E27",
              background: "#F9FAFB", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", whiteSpace: "nowrap" }}>Statut</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value as ReviewStatus | "";
              setStatusFilter(v);
              load({ status: v, p: 1 });
            }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, background: "#F9FAFB" }}
          >
            <option value="">Tous</option>
            <option value="pending">En attente</option>
            <option value="published">Publiés</option>
            <option value="rejected">Rejetés</option>
            <option value="archived">Archivés</option>
          </select>
        </div>

        {/* Type */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Type</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              const v = e.target.value as "" | "product" | "store";
              setTypeFilter(v);
              load({ type: v, p: 1 });
            }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, background: "#F9FAFB" }}
          >
            <option value="">Tous</option>
            <option value="product">Produit</option>
            <option value="store">Boutique</option>
          </select>
        </div>

        {/* Reset */}
        {(statusFilter || typeFilter || search) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setTypeFilter("");
              setSearch("");
              load({ status: "", type: "", q: "", p: 1 });
            }}
            style={{
              padding: "8px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#fff", fontSize: 12, color: "#6B7280", cursor: "pointer", fontWeight: 600,
            }}
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Chargement…</div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: "72px 0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Aucun avis trouvé</div>
            <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Modifiez les filtres ou attendez les premières soumissions.</div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2.5fr 1fr 120px 120px 110px 160px",
              padding: "12px 20px",
              background: "#F9FAFB",
              borderBottom: "1.5px solid #E5E7EB",
              fontSize: 11,
              fontWeight: 700,
              color: "#9CA3AF",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              <div>Avis</div>
              <div>Note</div>
              <div>Type</div>
              <div>Statut</div>
              <div>Date</div>
              <div style={{ textAlign: "right" }}>Actions</div>
            </div>

            {/* Rows */}
            {reviews.map((review) => {
              const meta = STATUS_META[review.status];
              const isActing = actionId === review.id;
              return (
                <div
                  key={review.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.5fr 1fr 120px 120px 110px 160px",
                    padding: "16px 20px",
                    borderBottom: "1px solid #F3F4F6",
                    alignItems: "center",
                    background: isActing ? "#F9FAFB" : "#fff",
                    transition: "background 0.1s",
                    opacity: isActing ? 0.6 : 1,
                  }}
                >
                  {/* Avis */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0A0E27", marginBottom: 2 }}>
                      {review.displayName ?? review.customerName ?? "Anonyme"}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: review.title || review.body ? 6 : 0 }}>
                      {review.customerEmail}
                    </div>
                    {review.title && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 2 }}>
                        {review.title}
                      </div>
                    )}
                    {review.body && (
                      <div style={{
                        fontSize: 12, color: "#6B7280",
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                      }}>
                        {review.body}
                      </div>
                    )}
                  </div>

                  {/* Note */}
                  <div>
                    {STARS(review.rating)}
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{review.rating}/5</div>
                  </div>

                  {/* Type */}
                  <div>
                    <span style={{
                      padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      background: review.type === "product" ? "#EFF6FF" : "#F5F3FF",
                      color: review.type === "product" ? "#1D4ED8" : "#6D28D9",
                    }}>
                      {review.type === "product" ? "Produit" : "Boutique"}
                    </span>
                  </div>

                  {/* Statut */}
                  <div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                      background: meta.bg, color: meta.color,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot, display: "inline-block" }} />
                      {meta.label}
                    </span>
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    {new Date(review.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                    <Link
                      href={`/admin/reviews/${review.id}`}
                      style={{
                        padding: "6px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB",
                        fontSize: 12, fontWeight: 600, color: "#374151", textDecoration: "none",
                        background: "#fff",
                      }}
                    >
                      Voir →
                    </Link>
                    {review.status === "pending" && (
                      <>
                        <button
                          disabled={isActing}
                          onClick={() => handlePublish(review.id)}
                          style={{
                            padding: "6px 12px", borderRadius: 7, border: "none",
                            fontSize: 12, fontWeight: 700, color: "#065F46",
                            background: "#D1FAE5", cursor: "pointer",
                          }}
                        >
                          ✓ Publier
                        </button>
                        <button
                          disabled={isActing}
                          onClick={() => handleReject(review.id)}
                          style={{
                            padding: "6px 12px", borderRadius: 7, border: "none",
                            fontSize: 12, fontWeight: 700, color: "#991B1B",
                            background: "#FEE2E2", cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 24 }}>
          <button
            disabled={page <= 1}
            onClick={() => load({ p: page - 1 })}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151",
              cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            ← Précédent
          </button>
          <span style={{ fontSize: 13, color: "#6B7280", padding: "0 12px" }}>
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => load({ p: page + 1 })}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151",
              cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1,
            }}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
