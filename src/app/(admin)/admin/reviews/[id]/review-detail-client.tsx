"use client";

import { useState } from "react";
import Link from "next/link";
import { publishReview, rejectReview, archiveReview, replyToReview } from "@/lib/review-actions";
import type { ReviewRow, ReviewReplyRow } from "@/lib/reviews/review-types";

interface ReviewDetail extends ReviewRow {
  reply: ReviewReplyRow | null;
  product: { id: string; name: string; slug: string; imageUrl: string | null } | null;
  orderRef: string | null;
}

export default function ReviewDetailClient({ review: initial }: { review: ReviewDetail }) {
  const [review, setReview] = useState(initial);
  const [replyBody, setReplyBody] = useState(initial.reply?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(initial.status);

  async function handlePublish() {
    await publishReview(review.id);
    setStatus("published");
  }
  async function handleReject() {
    const reason = prompt("Raison du rejet (facultatif)") ?? undefined;
    await rejectReview(review.id, reason);
    setStatus("rejected");
  }
  async function handleArchive() {
    await archiveReview(review.id);
    setStatus("archived");
  }
  async function handleReply() {
    setSaving(true);
    try {
      await replyToReview(review.id, replyBody);
      setReview((r) => ({ ...r, reply: { id: "", reviewId: r.id, body: replyBody, status: "published", createdAt: new Date(), updatedAt: new Date() } }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/reviews" className="text-gray-400 hover:text-gray-900">← Retour</Link>
        <h1 className="text-xl font-bold text-gray-900">Avis #{review.id.slice(0, 8)}</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{review.customerName ?? review.customerEmail}</p>
            <p className="text-gray-400 text-sm">{review.customerEmail}</p>
            {review.product && (
              <p className="text-sm text-gray-500 mt-1">Produit : {review.product.name}</p>
            )}
            {review.orderRef && (
              <p className="text-sm text-gray-500">Commande : {review.orderRef.slice(0, 8).toUpperCase()}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-yellow-500 text-xl">{"★".repeat(review.rating)}<span className="text-gray-200">{"★".repeat(5 - review.rating)}</span></div>
            <span className={`text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded-full ${status === "published" ? "bg-green-100 text-green-700" : status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
              {status}
            </span>
          </div>
        </div>

        {review.title && <h2 className="font-semibold text-gray-900">{review.title}</h2>}
        {review.body && <p className="text-gray-700 leading-relaxed">{review.body}</p>}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          {status === "pending" && (
            <>
              <button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                Publier
              </button>
              <button onClick={handleReject} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600">
                Rejeter
              </button>
            </>
          )}
          {status === "published" && (
            <button onClick={handleArchive} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Archiver
            </button>
          )}
        </div>

        {/* Reply */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="font-medium text-gray-900 mb-3">Réponse marchand</h3>
          <textarea
            rows={3}
            placeholder="Répondre à cet avis…"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          />
          <button
            onClick={handleReply}
            disabled={saving || !replyBody.trim()}
            className="mt-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : review.reply ? "Mettre à jour la réponse" : "Enregistrer la réponse"}
          </button>
        </div>
      </div>
    </div>
  );
}
