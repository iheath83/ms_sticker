"use server";

import { db } from "@/db";
import { orders, orderItems, orderEvents, users, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validateTransition } from "@/lib/order-state";
import type { OrderStatus } from "@/lib/order-state";
import { getStripe } from "@/lib/stripe";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireSession() {
  return auth.api.getSession({ headers: await headers() });
}

// ─── Create Stripe Payment Intent (embedded checkout) ────────────────────────

export async function createPaymentIntent(
  orderId: string,
): Promise<Result<{ clientSecret: string }>> {
  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      totalCents: orders.totalCents,
      stripePaymentIntentId: orders.stripePaymentIntentId,
      guestEmail: orders.guestEmail,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Commande introuvable" };

  if (!["proof_pending", "approved"].includes(order.status)) {
    return { ok: false, error: "Cette commande ne peut pas être payée maintenant" };
  }

  // Reuse existing PI if still valid
  if (order.stripePaymentIntentId) {
    try {
      const stripe = getStripe();
      const existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      if (existing.status !== "succeeded" && existing.status !== "canceled" && existing.client_secret) {
        // Update amount if it changed
        if (existing.amount !== order.totalCents) {
          await stripe.paymentIntents.update(order.stripePaymentIntentId, { amount: order.totalCents });
        }
        return { ok: true, data: { clientSecret: existing.client_secret } };
      }
    } catch { /* create a new PI */ }
  }

  // Load user email
  let customerEmail: string | undefined;
  if (order.userId) {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1);
    customerEmail = user?.email ?? undefined;
  }
  customerEmail = customerEmail ?? order.guestEmail ?? undefined;

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: "eur",
    metadata: { orderId },
    description: `Commande MS Adhésif #${orderId.slice(0, 8).toUpperCase()}`,
    automatic_payment_methods: { enabled: true },
    ...(customerEmail ? { receipt_email: customerEmail } : {}),
  });

  if (!paymentIntent.client_secret) {
    return { ok: false, error: "Impossible de créer le PaymentIntent Stripe" };
  }

  // Persist PI ID on the order
  await db
    .update(orders)
    .set({ stripePaymentIntentId: paymentIntent.id, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  return { ok: true, data: { clientSecret: paymentIntent.client_secret } };
}

// ─── Create Stripe Checkout session ──────────────────────────────────────────

export async function createCheckoutSession(
  orderId: string,
): Promise<Result<{ url: string }>> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Non connecté" };

  // Load order and verify ownership + status
  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      totalCents: orders.totalCents,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  // Allow both owner and guest orders (userId null = guest)
  if (!order || (order.userId !== null && order.userId !== session.user.id)) {
    return { ok: false, error: "Commande introuvable" };
  }

  if (!["proof_pending", "approved"].includes(order.status)) {
    return { ok: false, error: "Cette commande ne peut pas être payée maintenant" };
  }

  // If a session already exists and not expired, reuse it
  if (order.stripeCheckoutSessionId) {
    try {
      const stripe = getStripe();
      const existing = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
      if (existing.status === "open" && existing.url) {
        return { ok: true, data: { url: existing.url } };
      }
    } catch { /* session expired or invalid — create a new one */ }
  }

  // Load order items for line items
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      widthMm: orderItems.widthMm,
      heightMm: orderItems.heightMm,
      shape: orderItems.shape,
      unitPriceCents: orderItems.unitPriceCents,
      lineTotalCents: orderItems.lineTotalCents,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Load user info
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const appUrl = process.env["BETTER_AUTH_URL"] ?? process.env["APP_URL"] ?? "http://localhost:3000";

  // Build Stripe line items
  const lineItems = await Promise.all(
    items.map(async (item) => {
      let productName = `Sticker ${item.widthMm}×${item.heightMm}mm`;
      if (item.productId) {
        const [p] = await db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);
        if (p) productName = `${p.name} — ${item.widthMm}×${item.heightMm}mm (${item.shape})`;
      }

      return {
        price_data: {
          currency: "eur",
          unit_amount: item.unitPriceCents,
          product_data: {
            name: productName,
            metadata: { orderItemId: item.id },
          },
        },
        quantity: item.quantity,
      };
    }),
  );

  const stripe = getStripe();

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "payment",
    payment_method_types: ["card", "sepa_debit"],
    line_items: lineItems,
    metadata: { orderId },
    success_url: `${appUrl}/confirmation?payment=success&order_id=${orderId}`,
    cancel_url: `${appUrl}/checkout?payment=cancelled`,
    locale: "fr",
    payment_intent_data: {
      metadata: { orderId },
      description: `Commande MS Adhésif #${orderId.slice(0, 8).toUpperCase()}`,
    },
  };

  if (user?.email) {
    sessionParams.customer_email = user.email;
  }

  const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

  if (!checkoutSession.url) {
    return { ok: false, error: "Impossible de créer la session Stripe" };
  }

  // Persist session ID
  await db
    .update(orders)
    .set({
      stripeCheckoutSessionId: checkoutSession.id,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return { ok: true, data: { url: checkoutSession.url } };
}
