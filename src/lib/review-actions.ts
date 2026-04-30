"use server";

import { db } from "@/db";
import {
  reviews,
  reviewReplies,
  reviewRequests,
  reviewRequestItems,
  reviewSettings,
  reviewAggregates,
  products,
  orders,
} from "@/db/schema";
import { eq, desc, and, gte, lte, ilike, or, count, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { publish, reject, archive } from "@/lib/reviews/review-moderation-service";
import { createReviewRequestForOrder } from "@/lib/reviews/review-request-service";
import type {
  AdminReviewFilters,
  AdminReviewRequestFilters,
  ImportReviewRow,
  ReviewStatus,
} from "@/lib/reviews/review-types";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") throw new Error("Non autorisé");
  return session;
}

// ─── Admin: Reviews list ──────────────────────────────────────────────────────

export async function getAdminReviews(filters: AdminReviewFilters = {}) {
  await requireAdmin();
  const {
    status,
    type,
    rating,
    withMedia,
    productId,
    dateFrom,
    dateTo,
    q,
    page = 1,
    limit = 20,
  } = filters;

  const conditions = [];
  if (status) conditions.push(eq(reviews.status, status));
  if (type) conditions.push(eq(reviews.type, type));
  if (rating) conditions.push(eq(reviews.rating, rating));
  if (productId) conditions.push(eq(reviews.productId, productId));
  if (dateFrom) conditions.push(gte(reviews.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(reviews.createdAt, new Date(dateTo)));
  if (q) {
    conditions.push(
      or(
        ilike(reviews.customerEmail, `%${q}%`),
        ilike(reviews.customerName, `%${q}%`),
        ilike(reviews.title, `%${q}%`),
        ilike(reviews.body, `%${q}%`),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * limit;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(reviews)
      .where(whereClause)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(reviews).where(whereClause),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  return { reviews: rows, total, page, limit };
}

// ─── Admin: Single review ─────────────────────────────────────────────────────

export async function getAdminReview(id: string) {
  await requireAdmin();
  const [row] = await db.select().from(reviews).where(eq(reviews.id, id));
  if (!row) return null;

  const [reply] = await db.select().from(reviewReplies).where(eq(reviewReplies.reviewId, id));
  const product = row.productId
    ? (await db.select({ id: products.id, name: products.name, slug: products.slug, imageUrl: products.imageUrl }).from(products).where(eq(products.id, row.productId)))[0] ?? null
    : null;
  const order = row.orderId
    ? (await db.select({ id: orders.id }).from(orders).where(eq(orders.id, row.orderId)))[0] ?? null
    : null;

  return { ...row, reply: reply ?? null, product, orderRef: order?.id ?? null };
}

// ─── Admin: Publish / Reject / Archive ───────────────────────────────────────

export async function publishReview(id: string) {
  await requireAdmin();
  await publish(id);
  revalidatePath("/admin/reviews");
}

export async function rejectReview(id: string, reason?: string) {
  await requireAdmin();
  await reject(id, reason);
  revalidatePath("/admin/reviews");
}

export async function archiveReview(id: string) {
  await requireAdmin();
  await archive(id);
  revalidatePath("/admin/reviews");
}

// ─── Admin: Reply ─────────────────────────────────────────────────────────────

export async function replyToReview(reviewId: string, body: string) {
  await requireAdmin();

  const existing = await db.select({ id: reviewReplies.id }).from(reviewReplies).where(eq(reviewReplies.reviewId, reviewId));
  if (existing.length > 0) {
    await db.update(reviewReplies).set({ body, updatedAt: new Date() }).where(eq(reviewReplies.reviewId, reviewId));
  } else {
    await db.insert(reviewReplies).values({ reviewId, body });
  }
  revalidatePath(`/admin/reviews/${reviewId}`);
}

// ─── Admin: Review requests list ─────────────────────────────────────────────

export async function getAdminReviewRequests(filters: AdminReviewRequestFilters = {}) {
  await requireAdmin();
  const { status, orderId, q, page = 1, limit = 20 } = filters;

  const conditions = [];
  if (status) conditions.push(eq(reviewRequests.status, status));
  if (orderId) conditions.push(eq(reviewRequests.orderId, orderId));
  if (q) {
    conditions.push(ilike(reviewRequests.customerEmail, `%${q}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * limit;

  const [rows, countRows] = await Promise.all([
    db.select().from(reviewRequests).where(whereClause).orderBy(desc(reviewRequests.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(reviewRequests).where(whereClause),
  ]);

  return { requests: rows, total: Number(countRows[0]?.total ?? 0), page, limit };
}

// ─── Admin: Create manual review request ─────────────────────────────────────

export async function createManualReviewRequest(orderId: string, sendAt?: Date) {
  await requireAdmin();
  const result = await createReviewRequestForOrder(orderId);
  if (!result) throw new Error("Impossible de créer la demande (déjà existante ou commande introuvable)");

  if (sendAt) {
    await db.update(reviewRequests).set({ sendAt, updatedAt: new Date() }).where(eq(reviewRequests.id, result.request.id));
  }

  revalidatePath("/admin/reviews/requests");
  return result;
}

// ─── Admin: Settings ─────────────────────────────────────────────────────────

export async function getReviewSettings() {
  await requireAdmin();
  const [row] = await db.select().from(reviewSettings).where(eq(reviewSettings.id, 1));
  return row ?? null;
}

export async function updateReviewSettings(data: Partial<typeof reviewSettings.$inferInsert>) {
  await requireAdmin();
  await db
    .insert(reviewSettings)
    .values({ id: 1, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: reviewSettings.id,
      set: { ...data, updatedAt: sql`now()` },
    });
  revalidatePath("/admin/reviews/settings");
}

// ─── Admin: Import CSV ────────────────────────────────────────────────────────

export async function importReviewsFromCSV(rows: ImportReviewRow[]) {
  await requireAdmin();
  if (rows.length === 0) return { imported: 0 };

  let imported = 0;
  const affectedProductIds = new Set<string>();
  let storeImported = false;

  for (const row of rows) {
    const [inserted] = await db
      .insert(reviews)
      .values({
        type: row.type,
        rating: Math.max(1, Math.min(5, row.rating)),
        title: row.title ?? null,
        body: row.body ?? null,
        status: "published",
        verificationStatus: "imported",
        productId: row.productId ?? null,
        customerEmail: row.customerEmail,
        customerName: row.customerName ?? null,
        source: "import",
        publishedAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: reviews.id });

    if (inserted) {
      imported++;
      if (row.type === "product" && row.productId) {
        affectedProductIds.add(row.productId);
      } else if (row.type === "store") {
        storeImported = true;
      }
    }
  }

  const { recalculateForProduct, recalculateForStore } = await import("@/lib/reviews/review-aggregate-service");
  for (const productId of affectedProductIds) await recalculateForProduct(productId);
  if (storeImported) await recalculateForStore();

  revalidatePath("/admin/reviews");
  return { imported };
}
