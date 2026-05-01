"use server";

import { db } from "@/db";
import { orders, orderItems, orderEvents, addresses, orderShippingSnapshots } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validateTransition } from "@/lib/order-state";
import { sendTemplatedEmail } from "@/lib/mail";
import { z } from "zod";
import { clearDraftOrder } from "@/lib/cart-actions";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteSettingsQuery } from "@/lib/settings-queries";
import { calculateDiscounts } from "@/lib/discounts/discount-engine";
import { recordDiscountUsages } from "@/lib/discount-actions";
import type { AppliedDiscountSnapshot } from "@/lib/discounts/discount-types";
import { computeShippingQuote, buildContextFromOrder } from "@/lib/shipping/engine";

// ─── Types ────────────────────────────────────────────────────────────────────

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── Shipping address schema ──────────────────────────────────────────────────

const billingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  line1: z.string().min(3),
  line2: z.string().optional(),
  postalCode: z.string().regex(/^\d{5}$/),
  city: z.string().min(1),
  countryCode: z.string().length(2).default("FR"),
});

const shippingSchema = z.object({
  firstName: z.string().min(1, "Requis"),
  lastName: z.string().min(1, "Requis"),
  email: z.string().email("Email invalide"),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Téléphone 10 chiffres")
    .transform((v) => v.replace(/\s/g, "")),
  line1: z.string().min(3, "Adresse requise"),
  line2: z.string().optional(),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal 5 chiffres"),
  city: z.string().min(1, "Ville requise"),
  countryCode: z.string().length(2).default("FR"),
  deliveryMethod: z.string().default("standard"),
  selectedMethodName: z.string().optional(),
  selectedMethodPriceCents: z.number().int().optional(),
  billing: billingAddressSchema.optional(),
  selectedShippingAddressId: z.string().uuid().optional(),
  // B2B / VAT fields
  isProfessional: z.boolean().default(false),
  vatNumber: z.string().optional(),
  companyName: z.string().optional(),
});

export type ShippingInput = z.input<typeof shippingSchema>;

// ─── Validate VAT number (server action for real-time VIES check) ─────────────

export async function validateVatAction(vatNumber: string): Promise<{
  ok: boolean;
  valid: boolean;
  companyName?: string | undefined;
  reverseCharge: boolean;
  error?: string | undefined;
}> {
  try {
    const { validateVatNumber } = await import("@/lib/vat");
    const result = await validateVatNumber(vatNumber);
    const reverseCharge = result.valid && result.countryCode !== "FR";
    const res: { ok: true; valid: boolean; companyName?: string | undefined; reverseCharge: boolean } = { ok: true, valid: result.valid, reverseCharge };
    if (result.companyName) res.companyName = result.companyName;
    return res;
  } catch {
    return { ok: false, valid: false, reverseCharge: false, error: "Erreur de validation" };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDraftOrderId(jar: Awaited<ReturnType<typeof cookies>>): string | undefined {
  return jar.get("ms_draft_order")?.value;
}

function formatOrderNumber(orderId: string): string {
  return "MS-" + orderId.replace(/-/g, "").substring(0, 8).toUpperCase();
}

// ─── submitOrder ──────────────────────────────────────────────────────────────

/**
 * Validates the cart, attaches a shipping address, transitions the order
 * from `draft` → `proof_pending`, records the event, and sends emails.
 */
export async function submitOrder(
  input: ShippingInput,
): Promise<Result<{ orderId: string; orderNumber: string; totalCents: number; clientSecret: string }>> {
  // 1. Validate shipping input
  const parsed = shippingSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Formulaire invalide" };
  }
  const shipping = parsed.data;

  // 2. Get authenticated user (optional — order can be placed as guest)
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user.id ?? null;

  // 3. Rate limit: 5 order submissions / hour per user or per email
  const rateLimitKey = `submit-order:${userId ?? shipping.email}`;
  const rl = await checkRateLimit(rateLimitKey, 5, 60 * 60);
  if (!rl.allowed) {
    return { ok: false, error: "Trop de commandes soumises. Réessayez dans une heure." };
  }

  // 3. Get the draft order from cookie
  const jar = await cookies();
  const orderId = getDraftOrderId(jar);
  if (!orderId) {
    return { ok: false, error: "Panier introuvable. Veuillez reconfigurer votre commande." };
  }

  // 4. Load and validate the order
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "draft")))
    .limit(1);

  if (!order) {
    return { ok: false, error: "Commande introuvable ou déjà soumise." };
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  if (items.length === 0) {
    return { ok: false, error: "Votre panier est vide." };
  }

  // 5. Validate state transition
  const transition = validateTransition("draft", "proof_pending");
  if (!transition.ok) {
    return { ok: false, error: transition.error };
  }

  // 6. Compute VAT rate (B2B reverse charge if valid EU VAT number)
  let vatRate = 0.20;
  let vatReverseCharge = false;
  if (shipping.isProfessional && shipping.vatNumber && shipping.countryCode !== "FR") {
    const { computeVatRate } = await import("@/lib/vat");
    const vatResult = await computeVatRate({
      customerCountryCode: shipping.countryCode,
      vatNumber: shipping.vatNumber,
      isProfessional: true,
    });
    vatRate = vatResult.rate;
    vatReverseCharge = vatResult.reverseCharge;
  } else if (shipping.countryCode !== "FR") {
    const { computeVatRate } = await import("@/lib/vat");
    const vatResult = await computeVatRate({ customerCountryCode: shipping.countryCode });
    vatRate = vatResult.rate;
    vatReverseCharge = vatResult.reverseCharge;
  }

  // Recalculate discounts server-side (never trust client totals)
  const shopSettings = await getSiteSettingsQuery();

  // Try to compute shipping via engine; fallback to siteSettings
  let shippingCents: number;
  let shippingSnapshot: {
    selectedMethodId: string;
    selectedMethodName: string;
    basePriceCents: number;
    appliedRules: Record<string, unknown>[];
    hiddenMethods: Record<string, unknown>[];
  } | null = null;

  try {
    const ctx = buildContextFromOrder({
      subtotalCents: order.subtotalCents,
      totalDiscountCents: 0,
      items: items.map((i) => ({
        productId: i.productId ?? "unknown",
        name: "Produit",
        quantity: i.quantity,
        lineTotalCents: i.lineTotalCents,
        weightGrams: 100,
      })),
      destination: {
        country: shipping.countryCode,
        postalCode: shipping.postalCode,
        city: shipping.city,
        addressLine1: shipping.line1,
      },
      customer: userId ? { id: userId } : null,
      couponCode: order.discountCode,
    });

    const quote = await computeShippingQuote(ctx);
    const selectedMethod = quote.methods.find((m) => m.id === shipping.deliveryMethod)
      ?? quote.methods[0];

    if (selectedMethod) {
      shippingCents = Math.round(selectedMethod.price * 100);
      shippingSnapshot = {
        selectedMethodId: selectedMethod.id,
        selectedMethodName: selectedMethod.publicName,
        basePriceCents: Math.round(selectedMethod.originalPrice * 100),
        appliedRules: selectedMethod.appliedRules.map((r) => ({ name: r })),
        hiddenMethods: quote.hiddenMethods.map((h) => ({ id: h.id, reason: h.reason })),
      };
    } else {
      // Fallback to siteSettings if engine returns no methods
      shippingCents = shipping.deliveryMethod === "express"
        ? shopSettings.expressShippingCents
        : order.subtotalCents >= shopSettings.freeShippingThresholdCents
          ? 0
          : shopSettings.standardShippingCents;
    }
  } catch {
    // Fallback on engine error
    shippingCents = shipping.deliveryMethod === "express"
      ? shopSettings.expressShippingCents
      : order.subtotalCents >= shopSettings.freeShippingThresholdCents
        ? 0
        : shopSettings.standardShippingCents;
  }

  const discountResult = await calculateDiscounts({
    cart: {
      orderId,
      subtotalCents: order.subtotalCents,
      itemCount: items.length,
      shippingCents,
    },
    customerId: userId,
    manualCodes: order.discountCode ? [order.discountCode] : [],
  });

  const orderDiscountCents   = discountResult.orderDiscountCents;
  const shippingDiscountCents = discountResult.shippingDiscountCents;
  const subtotalAfterDiscount = Math.max(0, order.subtotalCents - orderDiscountCents);
  const effectiveShippingCents = Math.max(0, shippingCents - shippingDiscountCents);

  // Recalculate totals with the actual VAT rate
  const taxAmountCents = Math.ceil(subtotalAfterDiscount * vatRate);
  const shippingVat = Math.ceil(effectiveShippingCents * vatRate);
  const shippingTotalCents = effectiveShippingCents + shippingVat;
  const totalDiscountCents = orderDiscountCents + shippingDiscountCents;
  const totalCents = subtotalAfterDiscount + taxAmountCents + shippingTotalCents;

  const appliedDiscounts: AppliedDiscountSnapshot[] = discountResult.appliedDiscounts.map((d) => {
    const snap: AppliedDiscountSnapshot = { discountId: d.discountId, title: d.title, type: d.type, amountCents: d.amountCents };
    if (d.code) snap.code = d.code;
    return snap;
  });

  // 7. Persist addresses and update order
  let shippingAddressId: string | undefined;
  let billingAddressId: string | undefined;
  try {
    // If user selected an existing address, reuse it directly
    if (shipping.selectedShippingAddressId) {
      shippingAddressId = shipping.selectedShippingAddressId;
    } else {
      const [addr] = await db
        .insert(addresses)
        .values({
          userId: userId ?? null,
          firstName: shipping.firstName,
          lastName: shipping.lastName,
          line1: shipping.line1,
          line2: shipping.line2 ?? null,
          postalCode: shipping.postalCode,
          city: shipping.city,
          countryCode: shipping.countryCode,
          phone: shipping.phone,
        })
        .returning({ id: addresses.id });
      shippingAddressId = addr?.id;
    }

    // Billing address: separate or same as shipping
    if (shipping.billing) {
      const [bAddr] = await db
        .insert(addresses)
        .values({
          userId: userId ?? null,
          firstName: shipping.billing.firstName,
          lastName: shipping.billing.lastName,
          line1: shipping.billing.line1,
          line2: shipping.billing.line2 ?? null,
          postalCode: shipping.billing.postalCode,
          city: shipping.billing.city,
          countryCode: shipping.billing.countryCode,
        })
        .returning({ id: addresses.id });
      billingAddressId = bAddr?.id;
    } else {
      billingAddressId = shippingAddressId;
    }
  } catch {
    // Non-blocking — order can proceed without address save
  }

  // 8. Transition order status
  await db
    .update(orders)
    .set({
      status: "proof_pending",
      userId: userId ?? order.userId,
      guestEmail: userId ? null : shipping.email,
      shippingCents: shippingTotalCents,
      taxAmountCents,
      discountCents: totalDiscountCents,
      appliedDiscounts: appliedDiscounts,
      totalCents,
      vatRate: String(vatRate),
      vatReverseCharge,
      deliveryMethod: shipping.deliveryMethod,
      shippingAddressId: shippingAddressId ?? null,
      billingAddressId: billingAddressId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // 8b. Persist shipping snapshot
  if (shippingSnapshot) {
    try {
      await db.insert(orderShippingSnapshots).values({
        orderId,
        selectedMethodId: shippingSnapshot.selectedMethodId,
        selectedMethodName: shippingSnapshot.selectedMethodName,
        basePriceCents: shippingSnapshot.basePriceCents,
        finalPriceCents: shippingTotalCents,
        currency: "EUR",
        appliedRulesJson: shippingSnapshot.appliedRules,
        hiddenMethodsJson: shippingSnapshot.hiddenMethods,
        destinationJson: {
          country: shipping.countryCode,
          postalCode: shipping.postalCode,
          city: shipping.city,
          line1: shipping.line1,
        } as Record<string, unknown>,
        cartSnapshotJson: {
          subtotalCents: order.subtotalCents,
          totalQuantity: items.reduce((acc, i) => acc + i.quantity, 0),
        } as Record<string, unknown>,
      });
    } catch {
      // Non-blocking
    }
  }

  // 9. Record audit event
  await db.insert(orderEvents).values({
    orderId,
    type: transition.eventType,
    actorId: userId,
    payload: {
      customerEmail: shipping.email,
      customerName: `${shipping.firstName} ${shipping.lastName}`,
      deliveryMethod: shipping.deliveryMethod,
      shippingCents,
      totalCents,
    },
  });

  // 10. Clear the draft order cookie
  await clearDraftOrder();

  // 11. Record discount usages (non-blocking)
  if (appliedDiscounts.length > 0) {
    recordDiscountUsages(orderId, userId).catch((err) =>
      console.error("[order] discount usage recording failed", err),
    );
  }

  // 12. Send emails (non-blocking — don't fail the order if email fails)
  const orderNumber = formatOrderNumber(orderId);
  const appUrl = process.env["APP_URL"] ?? "http://localhost:3000";
  const customerName = `${shipping.firstName} ${shipping.lastName}`;
  const totalEuros = (totalCents / 100).toFixed(2);

  const itemsForEmail = items.map((item) => {
    const opts = (item.options ?? {}) as Record<string, unknown>;
    return {
      name: String(opts["productName"] ?? "Sticker"),
      quantity: item.quantity,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      shape: item.shape,
      material: String(opts["material"] ?? "vinyl"),
      lineTotalEuros: (item.lineTotalCents / 100).toFixed(2),
    };
  });

  // Client email
  sendTemplatedEmail("order-received", shipping.email, {
    customerName: shipping.firstName,
    orderNumber,
    orderTotal: `${totalEuros} €`,
    orderUrl: `${appUrl}/account/orders/${orderId}`,
  }, customerName).catch((err) => console.error("[order] client email failed", err));

  // Admin email
  const adminEmail =
    process.env["BREVO_ADMIN_EMAIL"] ??
    process.env["BREVO_FROM_EMAIL"] ??
    "hello@msadhesif.fr";
  sendTemplatedEmail("admin-new-order", adminEmail, {
    customerName,
    customerEmail: shipping.email,
    orderNumber,
    orderTotal: `${totalEuros} €`,
    orderUrl: `${appUrl}/admin/orders/${orderId}`,
  }, "MS Adhésif Admin").catch((err) => console.error("[order] admin email failed", err));

  // Create Stripe PaymentIntent immediately after order submission
  const { createPaymentIntent } = await import("@/lib/checkout-actions");
  const piResult = await createPaymentIntent(orderId);
  if (!piResult.ok) {
    console.error("[submitOrder] Stripe PI creation failed:", piResult.error);
    return { ok: true, data: { orderId, orderNumber, totalCents, clientSecret: "" } };
  }

  return { ok: true, data: { orderId, orderNumber, totalCents, clientSecret: piResult.data.clientSecret } };
}
