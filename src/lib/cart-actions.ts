"use server";

import { db } from "@/db";
import { orders, orderItems, orderFiles } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { computePrice, type PricingInput } from "@/lib/pricing";
import type { PricingShape, PricingMaterial, PricingFinish } from "@/lib/pricing";
import { z } from "zod";
import type { Cart, CartItem, CartItemFile, AddToCartResult } from "@/lib/cart-types";

// Re-export types for backward compatibility (consumers should import from cart-types directly)
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
    maxAge: 60 * 60 * 24 * 30, // 30 days
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

async function getOrCreateDraftOrder(userId?: string): Promise<string> {
  const cookieOrderId = await getDraftOrderId();

  if (cookieOrderId) {
    // Verify it still exists and is in draft status
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, cookieOrderId), eq(orders.status, "draft")))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      // If user just logged in, associate the order with them
      if (userId) {
        await db
          .update(orders)
          .set({ userId, updatedAt: new Date() })
          .where(eq(orders.id, existing[0].id));
      }
      return existing[0].id;
    }
  }

  // No valid draft — create one
  const [newOrder] = await db
    .insert(orders)
    .values({
      userId: userId ?? null,
      status: "draft",
      subtotalCents: 0,
      taxAmountCents: 0,
      shippingCents: 0,
      totalCents: 0,
    })
    .returning({ id: orders.id });

  if (!newOrder) throw new Error("Failed to create draft order");

  await setDraftOrderId(newOrder.id);
  return newOrder.id;
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
  widthMm: z.number().int().positive(),
  heightMm: z.number().int().positive(),
  shape: z.string(),
  finish: z.string(),
  material: z.string(),
  basePriceCents: z.number().int().positive(),
  options: z.record(z.string(), z.boolean()).default({}),
  customizationNote: z.string().optional(),
  // For non-customizable products: bypass computePrice multipliers and use this unit price directly (HT, in cents)
  directUnitPriceCents: z.number().int().positive().optional(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export async function addToCart(input: AddToCartInput): Promise<Result<AddToCartResult>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Données invalides" };
  }

  const data = parsed.data;
  const userId = await getCurrentUserId();
  const orderId = await getOrCreateDraftOrder(userId);

  // Compute pricing
  const pricingInput: PricingInput = {
    product: {
      basePriceCents: data.basePriceCents,
      material: data.material as PricingMaterial,
    },
    widthMm: data.widthMm,
    heightMm: data.heightMm,
    quantity: data.quantity,
    shape: data.shape as PricingShape,
    finish: (data.finish as PricingFinish) ?? "gloss",
    options: {
      holographic: data.options["holographic"] ?? false,
      glitter: data.options["glitter"] ?? false,
      uvLaminated: data.options["uvLaminated"] ?? false,
    },
    vatRate: 0.20,
  };

  // For non-customizable (direct) products: bypass the shape/area/material multipliers
  const unitPriceCents = data.directUnitPriceCents ?? computePrice(pricingInput).unitPriceCents;
  const lineTotalCents = data.directUnitPriceCents
    ? data.directUnitPriceCents * data.quantity
    : (() => { const p = computePrice(pricingInput); return p.subtotalCents + p.optionsUpchargeCents; })();

  // Insert the item
  const [insertedItem] = await db.insert(orderItems).values({
    orderId,
    productId: data.productId ?? null,
    quantity: data.quantity,
    widthMm: data.widthMm,
    heightMm: data.heightMm,
    shape: data.shape,
    finish: data.finish ?? "gloss",
    options: {
      ...data.options,
      productName: data.productName,
      material: data.material,
      basePriceCents: data.basePriceCents,
    },
    unitPriceCents,
    lineTotalCents,
    customizationNote: data.customizationNote,
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

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Fetch most recent customer_upload file per item
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

  // Map: itemId → most recent file
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
      productName: String(opts["productName"] ?? "Sticker"),
      quantity: item.quantity,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      shape: item.shape,
      finish: item.finish,
      material: String(opts["material"] ?? "vinyl"),
      options: Object.fromEntries(
        Object.entries(opts)
          .filter(([, v]) => typeof v === "boolean")
          .map(([k, v]) => [k, v as boolean]),
      ),
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      customizationNote: item.customizationNote ?? undefined,
      file: f ? { id: f.id, key: f.storageKey, filename: f.originalFilename ?? null, mimeType: f.mimeType ?? null } : null,
    };
  });

  return {
    orderId,
    items: cartItems,
    subtotalCents:  order[0].subtotalCents,
    taxAmountCents: order[0].taxAmountCents,
    shippingCents:  order[0].shippingCents,
    discountCents:  order[0].discountCents,
    discountCode:   order[0].discountCode ?? null,
    totalCents:     order[0].totalCents,
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

  const opts = (item[0].options ?? {}) as Record<string, unknown>;
  const pricingInput: PricingInput = {
    product: {
      basePriceCents: Number(opts["basePriceCents"] ?? 2490),
      material: String(opts["material"] ?? "vinyl") as PricingMaterial,
    },
    widthMm: item[0].widthMm,
    heightMm: item[0].heightMm,
    quantity,
    shape: item[0].shape as PricingShape,
    finish: (item[0].finish as PricingFinish) ?? "gloss",
    options: {
      holographic: Boolean(opts["holographic"]),
      glitter: Boolean(opts["glitter"]),
      uvLaminated: Boolean(opts["uvLaminated"]),
    },
    vatRate: 0.20,
  };

  const pricing = computePrice(pricingInput);
  const lineTotalCents = pricing.subtotalCents + pricing.optionsUpchargeCents;

  await db
    .update(orderItems)
    .set({
      quantity,
      unitPriceCents: pricing.unitPriceCents,
      lineTotalCents,
      updatedAt: new Date(),
    })
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
