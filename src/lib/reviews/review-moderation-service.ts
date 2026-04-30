import { db } from "@/db";
import { reviews, reviewMedia } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ReviewSettingsRow, ReviewStatus } from "./review-types";
import { recalculateForProduct, recalculateForStore } from "./review-aggregate-service";

export function getInitialStatus(
  rating: number,
  hasMedia: boolean,
  settings: Pick<ReviewSettingsRow, "autoPublish" | "autoPublishMinRating" | "requireModerationForMedia" | "requireModerationForLowRating" | "lowRatingThreshold">,
): ReviewStatus {
  if (!settings.autoPublish) return "pending";
  if (settings.requireModerationForMedia && hasMedia) return "pending";
  if (
    settings.requireModerationForLowRating &&
    settings.lowRatingThreshold !== null &&
    rating <= settings.lowRatingThreshold
  )
    return "pending";
  if (settings.autoPublishMinRating !== null && rating < (settings.autoPublishMinRating ?? 0)) return "pending";
  return "published";
}

export async function publish(id: string): Promise<void> {
  const [review] = await db
    .update(reviews)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(reviews.id, id))
    .returning();

  if (review) {
    await approveReviewMedia(id);
    await triggerRecalculation(review.productId, review.type);
  }
}

export async function reject(id: string, reason?: string): Promise<void> {
  const [review] = await db
    .update(reviews)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectionReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, id))
    .returning();

  if (review) await triggerRecalculation(review.productId, review.type);
}

export async function archive(id: string): Promise<void> {
  const [review] = await db
    .update(reviews)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(reviews.id, id))
    .returning();

  if (review) await triggerRecalculation(review.productId, review.type);
}

async function approveReviewMedia(reviewId: string): Promise<void> {
  await db
    .update(reviewMedia)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(reviewMedia.reviewId, reviewId));
}

async function triggerRecalculation(productId: string | null, type: string): Promise<void> {
  if (type === "product" && productId) {
    await recalculateForProduct(productId);
  } else if (type === "store") {
    await recalculateForStore();
  }
}
