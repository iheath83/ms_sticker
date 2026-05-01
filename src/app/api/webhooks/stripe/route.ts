import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { orders, orderEvents, orderItems, webhookEvents, users, products } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { validateTransition } from "@/lib/order-state";
import type { OrderStatus } from "@/lib/order-state";
import { sendTemplatedEmail, sendEmail } from "@/lib/mail";
import {
  getOrCreateCustomer,
  createAndFinalizeInvoice,
  vatRateToCode,
  centsToEuroString,
} from "@/lib/pennylane";

// Stripe webhooks send raw body — disable Next.js body parsing
export const runtime = "nodejs";

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check — skip if already processed
  const alreadyProcessed = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, event.id))
    .limit(1);

  if (alreadyProcessed.length > 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Record webhook event immediately (idempotency key)
  await db.insert(webhookEvents).values({
    provider: "stripe",
    eventId: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    // Return 200 anyway to avoid Stripe retry loops for non-critical errors
    // The event is already in webhookEvents for manual reprocessing
    return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}

// ─── checkout.session.completed ──────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error("[stripe-webhook] checkout.session.completed: missing orderId in metadata");
    return;
  }

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      subtotalCents: orders.subtotalCents,
      taxAmountCents: orders.taxAmountCents,
      shippingCents: orders.shippingCents,
      vatRate: orders.vatRate,
      userId: orders.userId,
      guestEmail: orders.guestEmail,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    console.error("[stripe-webhook] Order not found:", orderId);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Persist Stripe IDs
  await db
    .update(orders)
    .set({
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // Transition proof_pending → paid (new flow: pay first, then BAT)
  const allowedFromStatuses: OrderStatus[] = ["proof_pending", "approved"];
  if (allowedFromStatuses.includes(order.status as OrderStatus)) {
    const transition = validateTransition(order.status as OrderStatus, "paid");
    if (transition.ok) {
      await db
        .update(orders)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      await db.insert(orderEvents).values({
        orderId,
        type: transition.eventType,
        actorId: null,
        payload: {
          from: order.status,
          to: "paid",
          stripeSessionId: session.id,
          paymentIntentId,
          amountTotal: session.amount_total,
          currency: session.currency,
        },
      });
    }
  }

  // ── Pennylane invoice creation (non-blocking, error logged) ─────────────────
  createPennylaneInvoice(orderId, order, session).catch((err) =>
    console.error("[stripe-webhook] Pennylane error:", err),
  );

  // Auto-create SendCloud order when payment is confirmed
  import("@/lib/sendcloud")
    .then(({ autoCreateSendCloudOrder }) => autoCreateSendCloudOrder(orderId))
    .catch((err) => console.error("[stripe-webhook] SendCloud auto-create error:", err));

  // Email confirmation to customer
  const email = session.customer_email ?? order.guestEmail;
  if (email) {
    const appUrl = process.env["BETTER_AUTH_URL"] ?? process.env["APP_URL"] ?? "";
    await sendTemplatedEmail("payment-received", email, {
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      orderTotal: euros(session.amount_total ?? order.totalCents),
      orderUrl: `${appUrl}/account/orders/${orderId}`,
    }).catch((err) => console.error("[stripe-webhook] Email error:", err));
  }

  // Notify admin
  const adminEmail = process.env["BREVO_ADMIN_EMAIL"] ?? process.env["BREVO_FROM_EMAIL"];
  if (adminEmail) {
    const appUrl = process.env["BETTER_AUTH_URL"] ?? "";
    await sendTemplatedEmail("admin-new-order", adminEmail, {
      customerEmail: email ?? "—",
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      orderTotal: euros(session.amount_total ?? order.totalCents),
      orderUrl: `${appUrl}/admin/orders/${orderId}`,
    }).catch((err) => console.error("[stripe-webhook] Admin email error:", err));
  }
}

// ─── Pennylane invoice creation ───────────────────────────────────────────────

async function createPennylaneInvoice(
  orderId: string,
  order: {
    userId: string | null;
    guestEmail: string | null;
    totalCents: number;
    subtotalCents: number;
    taxAmountCents: number;
    shippingCents: number;
    vatRate: string | null;
  },
  session: Stripe.Checkout.Session,
) {
  // Load user info
  let customerEmail: string | null = session.customer_email ?? order.guestEmail;
  let customerName: string | null = null;

  if (order.userId) {
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);
    customerEmail = user?.email ?? customerEmail;
    customerName = user?.name ?? null;
  }

  if (!customerEmail) {
    console.warn("[pennylane] No customer email — skipping invoice creation for order", orderId);
    return;
  }

  // Get or create Pennylane customer
  const customerRes = await getOrCreateCustomer({
    email: customerEmail,
    name: customerName,
  });

  if (!customerRes.ok) {
    console.error("[pennylane] Failed to get/create customer:", customerRes.error);
    await db.insert(orderEvents).values({
      orderId,
      type: "pennylane.error",
      actorId: null,
      payload: { step: "get_or_create_customer", error: customerRes.error, timestamp: new Date().toISOString() },
    });
    return;
  }

  const pennylaneCustomerId = customerRes.data.id;

  // Store Pennylane customer ID on order
  await db
    .update(orders)
    .set({ pennylaneCustomerId: String(pennylaneCustomerId), updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  // Load order items for invoice lines
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      widthMm: orderItems.widthMm,
      heightMm: orderItems.heightMm,
      shape: orderItems.shape,
      unitPriceCents: orderItems.unitPriceCents,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const vatRate = parseFloat(order.vatRate ?? "0.2");
  const vatCode = vatRateToCode(vatRate);

  const invoiceLines = await Promise.all(
    items.map(async (item) => {
      let label = `Sticker ${item.widthMm}×${item.heightMm}mm (${item.shape})`;
      if (item.productId) {
        const [p] = await db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);
        if (p) label = `${p.name} — ${item.widthMm}×${item.heightMm}mm (${item.shape})`;
      }
      // unitPriceCents is already excl. tax — do NOT divide by (1 + vatRate)
      return {
        label,
        quantity: item.quantity,
        raw_currency_unit_price: centsToEuroString(item.unitPriceCents),
        vat_rate: vatCode,
        unit: "unité",
      };
    }),
  );

  // Add shipping line if applicable — shippingCents is TTC
  if (order.shippingCents > 0) {
    const shippingExclTax = Math.round(order.shippingCents / (1 + vatRate));
    invoiceLines.push({
      label: "Frais de livraison",
      quantity: 1,
      raw_currency_unit_price: centsToEuroString(shippingExclTax),
      vat_rate: vatCode,
      unit: "forfait",
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  // Payment terms: immediate (already paid)
  const deadline = today;

  const invoiceRes = await createAndFinalizeInvoice({
    customerId: pennylaneCustomerId,
    date: today,
    deadline,
    lines: invoiceLines,
    externalReference: orderId,
    subject: `Commande MS Adhésif #${orderId.slice(0, 8).toUpperCase()}`,
    description: `Stickers personnalisés — commande du ${today}`,
  });

  if (!invoiceRes.ok) {
    console.error("[pennylane] Failed to create invoice:", invoiceRes.error);
    await db.insert(orderEvents).values({
      orderId,
      type: "pennylane.error",
      actorId: null,
      payload: { step: "create_invoice", error: invoiceRes.error, timestamp: new Date().toISOString() },
    });
    return;
  }

  const invoice = invoiceRes.data;

  // Persist invoice details
  await db
    .update(orders)
    .set({
      pennylaneInvoiceId: String(invoice.id),
      pennylaneInvoiceUrl: invoice.pdf_invoice_url ?? invoice.file_url ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    type: "pennylane.invoice_created",
    actorId: null,
    payload: {
      pennylaneInvoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceUrl: invoice.pdf_invoice_url ?? invoice.file_url,
    },
  });

  console.info(`[pennylane] Invoice ${invoice.invoice_number} created for order ${orderId}`);

  // Email customer with invoice link
  if (customerEmail && (invoice.pdf_invoice_url ?? invoice.file_url)) {
    const invoiceUrl = invoice.pdf_invoice_url ?? invoice.file_url;
    await sendEmail({
      to: customerEmail,
      subject: `Votre facture — commande #${orderId.slice(0, 8).toUpperCase()}`,
      html: `
        <p>Bonjour,</p>
        <p>Votre facture pour la commande <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> est disponible.</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${invoiceUrl}" style="display:inline-block;padding:12px 28px;background:#0A0E27;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
            Télécharger la facture PDF →
          </a>
        </p>
        <p>Numéro de facture : <strong>${invoice.invoice_number}</strong></p>
        <p>Merci pour votre commande,<br/>L'équipe MS Adhésif</p>
      `,
    }).catch((err) => console.error("[pennylane] Invoice email error:", err));
  }
}

// ─── payment_intent.succeeded ────────────────────────────────────────────────

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) {
    console.error("[stripe-webhook] payment_intent.succeeded: missing orderId in metadata");
    return;
  }

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      subtotalCents: orders.subtotalCents,
      taxAmountCents: orders.taxAmountCents,
      shippingCents: orders.shippingCents,
      vatRate: orders.vatRate,
      userId: orders.userId,
      guestEmail: orders.guestEmail,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    console.error("[stripe-webhook] Order not found:", orderId);
    return;
  }

  // Update PI ID on order (might already be set)
  await db
    .update(orders)
    .set({ stripePaymentIntentId: paymentIntent.id, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  // Transition proof_pending → paid, then check if BAT needed
  const allowedFromStatuses: OrderStatus[] = ["proof_pending", "approved"];
  if (allowedFromStatuses.includes(order.status as OrderStatus)) {
    const transition = validateTransition(order.status as OrderStatus, "paid");
    if (transition.ok) {
      await db
        .update(orders)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      await db.insert(orderEvents).values({
        orderId,
        type: transition.eventType,
        actorId: null,
        payload: {
          from: order.status,
          to: "paid",
          paymentIntentId: paymentIntent.id,
          amountReceived: paymentIntent.amount_received,
          currency: paymentIntent.currency,
        },
      });

      // All sticker orders require customization (file upload / BAT)
      const needsCustomization = true;
      if (!needsCustomization) {
        const directTransition = validateTransition("paid", "in_production");
        if (directTransition.ok) {
          await db
            .update(orders)
            .set({ status: "in_production", updatedAt: new Date() })
            .where(eq(orders.id, orderId));
          await db.insert(orderEvents).values({
            orderId,
            type: directTransition.eventType,
            actorId: null,
            payload: { auto: true, reason: "no_customization_required" },
          });
        }
      }
    }
  }

  // Build a fake session-like object for Pennylane reuse
  const fakeSession = {
    id: null,
    customer_email: order.guestEmail ?? null,
    amount_total: paymentIntent.amount_received,
    currency: paymentIntent.currency,
  };

  createPennylaneInvoice(orderId, order, fakeSession as unknown as Stripe.Checkout.Session).catch((err) =>
    console.error("[stripe-webhook] Pennylane error:", err),
  );

  // Auto-create SendCloud order when payment is confirmed
  import("@/lib/sendcloud")
    .then(({ autoCreateSendCloudOrder }) => autoCreateSendCloudOrder(orderId))
    .catch((err) => console.error("[stripe-webhook] SendCloud auto-create error:", err));

  const email = order.guestEmail ?? (order.userId
    ? await db.select({ email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1).then(r => r[0]?.email ?? null)
    : null);

  const appUrl = process.env["BETTER_AUTH_URL"] ?? process.env["APP_URL"] ?? "";
  if (email) {
    sendTemplatedEmail("payment-received", email, {
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      orderTotal: euros(paymentIntent.amount_received),
      orderUrl: `${appUrl}/account/orders/${orderId}`,
    }).catch(() => { /* non-blocking */ });
  }

  const adminEmail = process.env["BREVO_ADMIN_EMAIL"] ?? process.env["BREVO_FROM_EMAIL"];
  if (adminEmail) {
    sendTemplatedEmail("admin-new-order", adminEmail, {
      customerEmail: email ?? "—",
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      orderTotal: euros(paymentIntent.amount_received),
      orderUrl: `${appUrl}/admin/orders/${orderId}`,
    }).catch(() => { /* non-blocking */ });
  }
}

// ─── payment_intent.payment_failed ───────────────────────────────────────────

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId;
  if (!orderId) return;

  await db.insert(orderEvents).values({
    orderId,
    type: "payment.failed",
    actorId: null,
    payload: {
      stripePaymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error?.message ?? "Unknown error",
    },
  });

  // Email the customer
  const [order] = await db
    .select({ guestEmail: orders.guestEmail, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  const email = order?.guestEmail;
  const appUrl = process.env["BETTER_AUTH_URL"] ?? process.env["APP_URL"] ?? "";

  if (email) {
    await sendEmail({
      to: email,
      subject: `Échec de paiement — commande #${orderId.slice(0, 8).toUpperCase()}`,
      html: `
        <p>Bonjour,</p>
        <p>Le paiement de votre commande <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> a échoué.</p>
        <p>Vous pouvez réessayer en accédant à votre commande :</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${appUrl}/account/orders/${orderId}" style="display:inline-block;padding:12px 28px;background:#DC2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
            Réessayer le paiement →
          </a>
        </p>
        <p>L'équipe MS Adhésif</p>
      `,
    }).catch(() => { /* non-blocking */ });
  }
}

// ─── charge.refunded ─────────────────────────────────────────────────────────
// Note: we don't insert a separate event here — the admin refundOrder action
// already inserts order.partial_refund or order.cancelled.
// This webhook is only useful for refunds initiated directly from the Stripe dashboard.

async function handleChargeRefunded(charge: Stripe.Charge) {
  const orderId =
    typeof charge.payment_intent === "string"
      ? undefined
      : (charge.metadata?.orderId ?? undefined);

  // Try to find order by payment intent
  let resolvedOrderId = orderId;
  if (!resolvedOrderId && typeof charge.payment_intent === "string") {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.stripePaymentIntentId, charge.payment_intent))
      .limit(1);
    resolvedOrderId = order?.id;
  }

  if (!resolvedOrderId) return;

  // Check if we already have a matching refund event (inserted by admin action)
  // to avoid duplicates — only insert if it looks like a dashboard-initiated refund
  const recentEvents = await db
    .select({ type: orderEvents.type, createdAt: orderEvents.createdAt })
    .from(orderEvents)
    .where(eq(orderEvents.orderId, resolvedOrderId))
    .orderBy(desc(orderEvents.createdAt))
    .limit(5);

  const hasRecentRefundEvent = recentEvents.some(
    (e) =>
      (e.type === "order.partial_refund" || e.type === "order.cancelled") &&
      Date.now() - new Date(e.createdAt).getTime() < 30_000, // within last 30s
  );

  if (hasRecentRefundEvent) return; // already logged by admin action

  // Dashboard-initiated refund — log it
  await db.insert(orderEvents).values({
    orderId: resolvedOrderId,
    type: "order.partial_refund",
    actorId: null,
    payload: {
      chargeId: charge.id,
      amountCents: charge.amount_refunded,
      reason: "Via tableau de bord Stripe",
    },
  });
}
