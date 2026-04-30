import { db } from "@/db";
import { reviewAggregates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ReviewStars } from "./ReviewStars";

interface Props {
  productId: string;
}

export async function ProductRatingSummary({ productId }: Props) {
  const [aggregate] = await db
    .select()
    .from(reviewAggregates)
    .where(and(eq(reviewAggregates.targetType, "product"), eq(reviewAggregates.targetId, productId)));

  if (!aggregate || aggregate.reviewCount === 0) return null;

  const pct = (count: number) =>
    aggregate.reviewCount > 0 ? Math.round((count / aggregate.reviewCount) * 100) : 0;

  const bars = [
    { label: "5 ★", count: aggregate.rating5Count },
    { label: "4 ★", count: aggregate.rating4Count },
    { label: "3 ★", count: aggregate.rating3Count },
    { label: "2 ★", count: aggregate.rating2Count },
    { label: "1 ★", count: aggregate.rating1Count },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-6 py-6">
      {/* Score */}
      <div className="flex flex-col items-center justify-center gap-1 min-w-[120px]">
        <span className="text-5xl font-bold text-gray-900">{aggregate.averageRating.toFixed(1)}</span>
        <ReviewStars rating={aggregate.averageRating} size="lg" />
        <span className="text-sm text-gray-400">{aggregate.reviewCount} avis</span>
      </div>

      {/* Bars */}
      <div className="flex-1 space-y-1.5">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3 text-sm">
            <span className="w-8 text-gray-500 shrink-0">{bar.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-yellow-400 h-2 rounded-full"
                style={{ width: `${pct(bar.count)}%` }}
              />
            </div>
            <span className="w-8 text-right text-gray-400">{bar.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
