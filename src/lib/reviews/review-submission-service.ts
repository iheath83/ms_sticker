import { db } from "@/db";
import {
  reviews,
  reviewMedia,
  reviewRequestItems,
  reviewRequests,
  reviewSettings,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { SubmitReviewPayload } from "./review-types";
import { getInitialStatus } from "./review-moderation-service";
import { recalculateForProduct, recalculateForStore } from "./review-aggregate-service";
import { markAsSubmitted } from "./review-request-service";
import { sendThankYouEmail } from "./review-email-service";

export async function submitReviewFromToken(
  tokenHash: string,
  payload: SubmitReviewPayload[],
): Promise<{ ok: boolean; error?: string }> {
  const [request] = await db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.tokenHash, tokenHash));

  if (!request) return { ok: false, error: "Token invalide" };
  if (request.status === "submitted") return { ok: false, error: "Avis déjà soumis" };
  if (request.status === "expired") return { ok: false, error: "Lien expiré" };
  if (request.expiresAt < new Date()) return { ok: false, error: "Lien expiré" };

  const [settings] = await db.select().from(reviewSettings).where(eq(reviewSettings.id, 1));

  const createdProductIds = new Set<string>();
  let storeReviewCreated = false;

  for (const item of payload) {
    const hasMedia = (item.mediaKeys?.length ?? 0) > 0;
    const status = getInitialStatus(item.rating, hasMedia, {
      autoPublish: settings?.autoPublish ?? false,
      autoPublishMinRating: settings?.autoPublishMinRating ?? null,
      requireModerationForMedia: settings?.requireModerationForMedia ?? true,
      requireModerationForLowRating: settings?.requireModerationForLowRating ?? true,
      lowRatingThreshold: settings?.lowRatingThreshold ?? 3,
    });

    if (item.type === "product" && item.productId) {
      const insertedReviews = await db
        .insert(reviews)
        .values({
          type: "product",
          rating: item.rating,
          title: item.title ?? null,
          body: item.body ?? null,
          status,
          verificationStatus: "verified_purchase",
          productId: item.productId,
          orderId: request.orderId ?? null,
          orderItemId: item.orderItemId ?? null,
          customerId: request.customerId ?? null,
          customerEmail: request.customerEmail,
          displayName: item.displayName ?? null,
          source: "post_purchase_email",
          locale: request.locale ?? "fr",
        })
        .returning();

      const review = insertedReviews[0];
      if (!review) continue;

      // Attach media
      if (item.mediaKeys && item.mediaKeys.length > 0 && settings?.collectMedia) {
        await db.insert(reviewMedia).values(
          item.mediaKeys.map((key) => ({
            reviewId: review.id,
            type: "image" as const,
            url: buildMediaUrl(key),
            storageKey: key,
            consentForMarketing: item.consentForMarketing ?? false,
          })),
        );
      }

      // Link request item
      if (item.orderItemId) {
        await db
          .update(reviewRequestItems)
          .set({ status: "submitted", reviewId: review.id, updatedAt: new Date() })
          .where(
            and(
              eq(reviewRequestItems.reviewRequestId, request.id),
              eq(reviewRequestItems.orderItemId, item.orderItemId),
            ),
          );
      }

      if (status === "published") {
        createdProductIds.add(item.productId);
      }
    } else if (item.type === "store") {
      await db.insert(reviews).values({
        type: "store",
        rating: item.rating,
        title: item.title ?? null,
        body: item.body ?? null,
        status,
        verificationStatus: "verified_purchase",
        orderId: request.orderId ?? null,
        customerId: request.customerId ?? null,
        customerEmail: request.customerEmail,
        displayName: item.displayName ?? null,
        source: "post_purchase_email",
        locale: request.locale ?? "fr",
      });

      if (status === "published") storeReviewCreated = true;
    }
  }

  await markAsSubmitted(request.id);

  // Recalculate aggregates
  for (const productId of createdProductIds) {
    await recalculateForProduct(productId);
  }
  if (storeReviewCreated) await recalculateForStore();

  // Send thank-you email
  try {
    await sendThankYouEmail(request.customerEmail);
  } catch {
    // Non-blocking
  }

  return { ok: true };
}

function buildMediaUrl(storageKey: string): string {
  const endpoint = process.env.MINIO_ENDPOINT ?? "https://minio.msadhesif.fr";
  const bucket = process.env.MINIO_BUCKET ?? "ms-sticker";
  return `${endpoint}/${bucket}/${storageKey}`;
}
