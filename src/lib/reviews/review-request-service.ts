import crypto from "crypto";
import { db } from "@/db";
import {
  reviewRequests,
  reviewRequestItems,
  reviewSettings,
  reviewEmailPreferences,
  orders,
  orderItems,
  products,
} from "@/db/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import type { ReviewRequestRow } from "./review-types";

function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export async function createReviewRequestForOrder(orderId: string): Promise<{ raw: string; request: ReviewRequestRow } | null> {
  // Load settings
  const [settings] = await db.select().from(reviewSettings).where(eq(reviewSettings.id, 1));
  const delayDays = settings?.requestDelayDaysAfterFulfillment ?? 7;
  const expiresDays = settings?.requestExpiresAfterDays ?? 60;

  // Check if a request already exists for this order
  const existing = await db.select({ id: reviewRequests.id }).from(reviewRequests).where(eq(reviewRequests.orderId, orderId));
  if (existing.length > 0) return null;

  // Load order info
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const customerEmail = order.guestEmail;
  if (!customerEmail) return null;

  // Check opt-out
  const [pref] = await db
    .select()
    .from(reviewEmailPreferences)
    .where(and(eq(reviewEmailPreferences.customerEmail, customerEmail), eq(reviewEmailPreferences.optedOut, true)));
  if (pref) return null;

  const { raw, hash } = generateToken();
  const now = new Date();
  const sendAt = new Date(now.getTime() + delayDays * 86400_000);
  const expiresAt = new Date(now.getTime() + expiresDays * 86400_000);

  const inserted = await db
    .insert(reviewRequests)
    .values({
      orderId,
      customerId: order.userId ?? null,
      customerEmail,
      type: "combined",
      tokenHash: hash,
      status: "scheduled",
      sendAt,
      expiresAt,
      locale: "fr",
    })
    .returning();

  const request = inserted[0];
  if (!request) return null;

  // Create items for each product in the order
  const items = await db
    .select({ id: orderItems.id, productId: orderItems.productId, variantId: orderItems.variantId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const eligibleProductIds = items.filter((i) => i.productId).map((i) => i.productId as string);

  if (eligibleProductIds.length > 0) {
    const productRows = await db
      .select({ id: products.id, reviewsEnabled: products.reviewsEnabled })
      .from(products)
      .where(inArray(products.id, eligibleProductIds));

    const enabledIds = new Set(productRows.filter((p) => p.reviewsEnabled).map((p) => p.id));

    const itemsToInsert = items
      .filter((i) => i.productId && enabledIds.has(i.productId))
      .map((i) => ({
        reviewRequestId: request.id,
        productId: i.productId,
        productVariantId: i.variantId,
        orderItemId: i.id,
        status: "pending" as const,
      }));

    if (itemsToInsert.length > 0) {
      await db.insert(reviewRequestItems).values(itemsToInsert);
    }
  }

  return { raw, request: request as ReviewRequestRow };
}

export async function markAsClicked(tokenHash: string): Promise<void> {
  await db
    .update(reviewRequests)
    .set({
      status: "clicked",
      firstClickedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(reviewRequests.tokenHash, tokenHash), eq(reviewRequests.status, "sent")));
}

export async function markAsOpened(tokenHash: string): Promise<void> {
  const [current] = await db.select({ status: reviewRequests.status }).from(reviewRequests).where(eq(reviewRequests.tokenHash, tokenHash));
  if (!current || current.status !== "sent") return;
  await db
    .update(reviewRequests)
    .set({ status: "opened", firstOpenedAt: new Date(), updatedAt: new Date() })
    .where(eq(reviewRequests.tokenHash, tokenHash));
}

export async function markAsSubmitted(requestId: string): Promise<void> {
  await db
    .update(reviewRequests)
    .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(reviewRequests.id, requestId));
}

export async function expireOldRequests(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(reviewRequests)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        lt(reviewRequests.expiresAt, now),
        inArray(reviewRequests.status, ["scheduled", "sent", "opened", "clicked"]),
      ),
    )
    .returning({ id: reviewRequests.id });
  return result.length;
}

export async function getRequestByTokenHash(tokenHash: string): Promise<ReviewRequestRow | null> {
  const [row] = await db.select().from(reviewRequests).where(eq(reviewRequests.tokenHash, tokenHash));
  return row ?? null;
}
