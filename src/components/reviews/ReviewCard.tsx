import type { ReviewRow, ReviewMediaRow, ReviewReplyRow } from "@/lib/reviews/review-types";
import { ReviewStars } from "./ReviewStars";

interface ReviewCardProps {
  review: ReviewRow & {
    media?: ReviewMediaRow[];
    reply?: ReviewReplyRow | null;
  };
  showVerifiedBadge?: boolean;
}

export function ReviewCard({ review, showVerifiedBadge = true }: ReviewCardProps) {
  const rawDisplayName = review.displayName ?? review.customerName ?? review.customerEmail.split("@")[0];
  const displayName = rawDisplayName ?? review.customerEmail;
  const isVerified = review.verificationStatus === "verified_purchase";

  return (
    <article className="py-6 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900">{displayName}</p>
            {showVerifiedBadge && isVerified && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span>✓</span> Achat vérifié
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <ReviewStars rating={review.rating} size="sm" />
          <p className="text-xs text-gray-400 mt-0.5">
            {review.publishedAt
              ? new Date(review.publishedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })
              : new Date(review.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      {review.title && (
        <h3 className="font-semibold text-gray-900 mt-3 text-sm">{review.title}</h3>
      )}
      {review.body && (
        <p className="text-gray-600 text-sm mt-2 leading-relaxed">{review.body}</p>
      )}

      {/* Media */}
      {review.media && review.media.length > 0 && (
        <div className="flex gap-2 mt-3">
          {review.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={m.thumbnailUrl ?? m.url}
              alt={m.altText ?? "Photo avis"}
              className="w-16 h-16 rounded-lg object-cover border border-gray-100"
            />
          ))}
        </div>
      )}

      {/* Merchant reply */}
      {review.reply && (
        <div className="mt-4 bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">Réponse de MS Adhésif</p>
          <p className="text-sm text-gray-600">{review.reply.body}</p>
        </div>
      )}

      {/* Helpful */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        {review.helpfulCount > 0 && (
          <span>{review.helpfulCount} personne{review.helpfulCount > 1 ? "s" : ""} ont trouvé cet avis utile</span>
        )}
      </div>
    </article>
  );
}
