"use server";

import { db } from "@/db";
import { orders, orderItems, orderFiles } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";
import type { Cart, CartItem, CartItemFile, AddToCartResult, StickerConfigSnapshot } from "@/lib/cart-types";

export type { Cart, CartItem, CartItemFile, AddToCartResult } from "@/lib/cart-types";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const DRAFT_ORDER_COOKIE = "ms_draft_order";

// ─── Cookie helpers ───────────────────────────────────────────────────────────

async function getDraftOrderId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(DRAFT_ORDER_COOKIE)?.value;
}

async function setDraftOrderId(orderId: string): Promise<void> {
  const jar = await cookies();
  jar.set(DRAFT_ORDER_COOKIE, orderId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function clearDraftOrderCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DRAFT_ORDER_COOKIE);
}

// ─── Session helper ───────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id;
}

// ─── Get or create the draft order ───────────────────────────────────────────

export async function getOrCreateDraftOrder(userId?: string): Promise<string> {
  const existingId = await getDraftOrderId();

  if (existingId) {
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, existingId), eq(orders.status, "draft")))
      .limit(1);
    if (existing[0]) return existing[0].id;
  }

  if (userId) {
    const userDraft = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, "draft")))
      .limit(1);
    if (userDraft[0]) {
      await setDraftOrderId(userDraft[0].id);
      return userDraft[0].id;
    }
  }

  const [newOrder] = await db
    .insert(orders)
    .values({ userId: userId ?? null, status: "draft" })
    .returning({ id: orders.id });

  await setDraftOrderId(newOrder!.id);
  return newOrder!.id;
}

// ─── Recompute order totals ───────────────────────────────────────────────────

async function recomputeOrderTotals(orderId: string): Promise<void> {
  const [currentOrder, items] = await Promise.all([
    db.select({ discountCents: orders.discountCents, shippingCents: orders.shippingCents })
      .from(orders).where(eq(orders.id, orderId)).limit(1),
    db.select({ lineTotalCents: orderItems.lineTotalCents })
      .from(orderItems).where(eq(orderItems.orderId, orderId)),
  ]);

  const subtotal = items.reduce((acc, i) => acc + i.lineTotalCents, 0);
  const discountCents = currentOrder[0]?.discountCents ?? 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountCents);
  const vat = Math.ceil(subtotalAfterDiscount * 0.20);
  const shipping = currentOrder[0]?.shippingCents ?? 0;
  const total = subtotalAfterDiscount + vat + shipping;

  await db
    .update(orders)
    .set({ subtotalCents: subtotal, taxAmountCents: vat, totalCents: total, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

// ─── Add to cart ──────────────────────────────────────────────────────────────

const addToCartSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  customizationNote: z.string().optional(),
  stickerConfig: z.any(),
});

export async function addToCart(input: {
  productId?: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  customizationNote?: string;
  stickerConfig: StickerConfigSnapshot;
}): Promise<Result<AddToCartResult>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const data = parsed.data;
  const userId = await getCurrentUserId();
  const orderId = await getOrCreateDraftOrder(userId);

  const lineTotalCents = data.unitPriceCents * data.quantity +
    (data.stickerConfig?.pricingSnapshot?.setupFeeCents ?? 0);

  const cfg: StickerConfigSnapshot | undefined = data.stickerConfig;

  const [insertedItem] = await db.insert(orderItems).values({
    orderId,
    productId: data.productId ?? null,
    quantity: data.quantity,
    options: { productName: data.productName },
    unitPriceCents: data.unitPriceCents,
    lineTotalCents,
    customizationNote: data.customizationNote,
    stickerConfig: cfg,
    widthMm: cfg?.widthMm ?? null,
    heightMm: cfg?.heightMm ?? null,
    shape: cfg?.shapeCode ?? null,
    finish: cfg?.laminationName ?? null,
  }).returning({ id: orderItems.id });

  if (!insertedItem) return { ok: false, error: "Erreur lors de l'ajout au panier" };

  await recomputeOrderTotals(orderId);
  return { ok: true, data: { cart: await getCart(), itemId: insertedItem.id, orderId } };
}

// ─── Get cart ─────────────────────────────────────────────────────────────────

export async function getCart(): Promise<Cart> {
  const orderId = await getDraftOrderId();

  if (!orderId) {
    return { orderId: "", items: [], subtotalCents: 0, taxAmountCents: 0, shippingCents: 0, discountCents: 0, discountCode: null, totalCents: 0, itemCount: 0 };
  }

  const order = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "draft")))
    .limit(1);

  if (!order[0]) {
    return { orderId: "", items: [], subtotalCents: 0, taxAmountCents: 0, shippingCents: 0, discountCents: 0, discountCode: null, totalCents: 0, itemCount: 0 };
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  const itemIds = items.map((i) => i.id);
  const files = itemIds.length > 0
    ? await db
        .select()
        .from(orderFiles)
        .where(and(
          eq(orderFiles.orderId, orderId),
          eq(orderFiles.type, "customer_upload"),
          inArray(orderFiles.orderItemId, itemIds),
        ))
    : [];

  const fileByItem = new Map<string, typeof files[0]>();
  for (const f of files) {
    if (!f.orderItemId) continue;
    const prev = fileByItem.get(f.orderItemId);
    if (!prev || f.createdAt > prev.createdAt) fileByItem.set(f.orderItemId, f);
  }

  const cartItems: CartItem[] = items.map((item) => {
    const opts = (item.options ?? {}) as Record<string, unknown>;
    const f = fileByItem.get(item.id);
    return {
      id: item.id,
      productId: item.productId,
      productName: String(opts["productName"] ?? item.stickerConfig?.materialName ?? "Sticker"),
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      ...(item.customizationNote ? { customizationNote: item.customizationNote } : {}),
      ...(item.stickerConfig ? { stickerConfig: item.stickerConfig as StickerConfigSnapshot } : {}),
      file: f ? { id: f.id, key: f.storageKey, filename: f.originalFilename ?? null, mimeType: f.mimeType ?? null } : null,
    };
  });

  return {
    orderId,
    items: cartItems,
    subtotalCents: order[0].subtotalCents,
    taxAmountCents: order[0].taxAmountCents,
    shippingCents: order[0].shippingCents,
    discountCents: order[0].discountCents,
    discountCode: order[0].discountCode ?? null,
    totalCents: order[0].totalCents,
    itemCount: cartItems.reduce((acc, i) => acc + i.quantity, 0),
  };
}

// ─── Update item quantity ─────────────────────────────────────────────────────

export async function updateCartItemQty(
  itemId: string,
  quantity: number,
): Promise<Result<Cart>> {
  if (quantity < 1) return removeCartItem(itemId);

  const orderId = await getDraftOrderId();
  if (!orderId) return { ok: false, error: "Panier introuvable" };

  const item = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .limit(1);

  if (!item[0]) return { ok: false, error: "Article introuvable" };

  const lineTotalCents = item[0].unitPriceCents * quantity +
    (item[0].stickerConfig?.pricingSnapshot?.setupFeeCents ?? 0);

  await db
    .update(orderItems)
    .set({ quantity, lineTotalCents, updatedAt: new Date() })
    .where(eq(orderItems.id, itemId));

  await recomputeOrderTotals(orderId);
  return { ok: true, data: await getCart() };
}

// ─── Remove item ──────────────────────────────────────────────────────────────

export async function removeCartItem(itemId: string): Promise<Result<Cart>> {
  const orderId = await getDraftOrderId();
  if (!orderId) return { ok: false, error: "Panier introuvable" };

  await db
    .delete(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));

  await recomputeOrderTotals(orderId);
  return { ok: true, data: await getCart() };
}

// ─── Clear cart (after checkout) ─────────────────────────────────────────────

export async function clearDraftOrder(): Promise<void> {
  await clearDraftOrderCookie();
}
