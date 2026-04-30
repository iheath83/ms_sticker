"use client";

import { useState, useEffect } from "react";
import { ReviewCard } from "./ReviewCard";
import type { ReviewRow, ReviewMediaRow, ReviewReplyRow, ReviewAggregateRow } from "@/lib/reviews/review-types";

type ReviewWithExtras = ReviewRow & { media: ReviewMediaRow[]; reply: ReviewReplyRow | null };

interface Props {
  productId: string;
}

export function ProductReviews({ productId }: Props) {
  const [reviews, setReviews] = useState<ReviewWithExtras[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [aggregate, setAggregate] = useState<ReviewAggregateRow | null>(null);

  async function load(p: number, s: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "10", sort: s });
      const res = await fetch(`/api/products/${productId}/reviews?${params}`);
      const data = await res.json();
      setReviews(data.reviews);
      setTotal(data.total);
      setPage(data.page);
      if (data.aggregate) setAggregate(data.aggregate);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, sort);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!loading && total === 0) return null;

  const totalPages = Math.ceil(total / 10);

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Avis clients {total > 0 && <span className="text-gray-400 font-normal text-sm">({total})</span>}
        </h2>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            load(1, e.target.value);
          }}
        >
          <option value="recent">Plus récents</option>
          <option value="helpful">Plus utiles</option>
          <option value="rating_desc">Meilleures notes</option>
          <option value="rating_asc">Moins bonnes notes</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-24" />
          ))}
        </div>
      ) : (
        <>
          <div>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-3 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1, sort)}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="px-4 py-2 text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => load(page + 1, sort)}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
