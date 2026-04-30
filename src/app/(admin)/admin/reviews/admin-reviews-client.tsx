"use client";

import { useState } from "react";
import Link from "next/link";
import { publishReview, rejectReview } from "@/lib/review-actions";
import type { ReviewRow, ReviewStatus, AdminReviewFilters } from "@/lib/reviews/review-types";

interface Props {
  initial: { reviews: ReviewRow[]; total: number; page: number; limit: number };
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "En attente",
  published: "Publié",
  rejected: "Rejeté",
  archived: "Archivé",
};

const STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-600",
};

export default function AdminReviewsClient({ initial }: Props) {
  const [reviews, setReviews] = useState(initial.reviews);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("");
  const [loading, setLoading] = useState(false);

  async function load(status: ReviewStatus | undefined, p: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("page", String(p));
      params.set("limit", "20");

      const res = await fetch(`/api/admin/reviews?${params}`);
      const data = await res.json();
      setReviews(data.reviews);
      setTotal(data.total);
      setPage(data.page);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(id: string) {
    await publishReview(id);
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "published" as ReviewStatus } : r)));
  }

  async function handleReject(id: string) {
    await rejectReview(id);
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" as ReviewStatus } : r)));
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avis clients</h1>
          <p className="text-gray-500 text-sm mt-1">{total} avis au total</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/reviews/requests" className="text-sm text-gray-600 hover:underline">
            Demandes d&apos;avis
          </Link>
          <Link href="/admin/reviews/settings" className="text-sm text-gray-600 hover:underline">
            Paramètres
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex gap-3 items-center">
        <label className="text-sm text-gray-600">Statut :</label>
        <select
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value as ReviewStatus | "";
            setStatusFilter(v);
            load(v || undefined, 1);
          }}
        >
          <option value="">Tous</option>
          <option value="pending">En attente</option>
          <option value="published">Publiés</option>
          <option value="rejected">Rejetés</option>
          <option value="archived">Archivés</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Chargement…</div>
        ) : reviews.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Aucun avis</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Auteur</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Note</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Statut</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviews.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{review.customerName ?? review.customerEmail}</div>
                    <div className="text-gray-400 text-xs">{review.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-yellow-500">{"★".repeat(review.rating)}</span>
                    <span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{review.type === "product" ? "Produit" : "Boutique"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[review.status]}`}>
                      {STATUS_LABELS[review.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/reviews/${review.id}`} className="text-gray-600 hover:text-gray-900 text-xs underline">
                        Voir
                      </Link>
                      {review.status === "pending" && (
                        <>
                          <button
                            onClick={() => handlePublish(review.id)}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Publier
                          </button>
                          <button
                            onClick={() => handleReject(review.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            Rejeter
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
              disabled={page <= 1}
              onClick={() => load(statusFilter || undefined, page - 1)}
              className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="px-4 py-2 text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => load(statusFilter || undefined, page + 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
