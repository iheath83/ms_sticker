"use server";

import { db } from "@/db";
import { orders, orderEvents, orderItems, orderFiles, users, addresses, products } from "@/db/schema";
import { eq, desc, count, ne, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validateTransition } from "@/lib/order-state";
import type { OrderStatus } from "@/lib/order-state";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Always do a fresh DB lookup to bypass cookie cache (role may have changed)
  const [dbUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return dbUser?.role === "admin" ? session : null;
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  byStatus: Record<string, number>;
  urgentOrders: Array<{
    id: string;
    status: string;
    totalCents: number;
    guestEmail: string | null;
    createdAt: Date;
    customerName: string | null;
    customerEmail: string | null;
  }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // Count by status (exclude draft)
  const statusRows = await db
    .select({ status: orders.status, count: count() })
    .from(orders)
    .where(ne(orders.status, "draft"))
    .groupBy(orders.status);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = Number(row.count);
  }

  // Orders needing action: paid (payment received → need to prepare BAT)
  // Also include proof_revision_requested (customer asked for changes)
  const urgent = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      guestEmail: orders.guestEmail,
      createdAt: orders.createdAt,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(
      inArray(orders.status, ["paid", "proof_revision_requested"]),
    )
    .orderBy(desc(orders.createdAt))
    .limit(10);

  return { byStatus, urgentOrders: urgent };
}

// ─── Orders list ──────────────────────────────────────────────────────────────

export interface AdminOrderRow {
  id: string;
  status: string;
  totalCents: number;
  shippingCents: number;
  guestEmail: string | null;
  createdAt: Date;
  customerName: string | null;
  customerEmail: string | null;
  itemCount: number;
}

export async function getAdminOrders(
  status?: string,
): Promise<AdminOrderRow[]> {
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      shippingCents: orders.shippingCents,
      guestEmail: orders.guestEmail,
      createdAt: orders.createdAt,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(
      status && status !== "all"
        ? eq(orders.status, status as OrderStatus)
        : ne(orders.status, "draft"),
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);

  // Get item counts
  const result: AdminOrderRow[] = await Promise.all(
    rows.map(async (row) => {
      const counts = await db
        .select({ value: count() })
        .from(orderItems)
        .where(eq(orderItems.orderId, row.id));
      const itemCount = Number(counts[0]?.value ?? 0);
      return { ...row, itemCount };
    }),
  );

  return result;
}

// ─── Order detail ─────────────────────────────────────────────────────────────

export type AddressData = {
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string | null;
} | null;

export interface AdminOrderDetail {
  order: typeof orders.$inferSelect & {
    customerName: string | null;
    customerEmail: string | null;
  };
  shippingAddress: AddressData;
  billingAddress: AddressData;
  items: Array<typeof orderItems.$inferSelect>;
  events: Array<typeof orderEvents.$inferSelect>;
  files: Array<typeof orderFiles.$inferSelect>;
  nextStatuses: OrderStatus[];
}

export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetail | null> {
  const rows = await db
    .select({
      order: orders,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!rows[0]) return null;

  const order = { ...rows[0].order, customerName: rows[0].customerName, customerEmail: rows[0].customerEmail };

  // Fetch addresses separately
  let shippingAddress: AddressData = null;
  let billingAddress: AddressData = null;

  if (order.shippingAddressId) {
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, order.shippingAddressId)).limit(1);
    if (addr) shippingAddress = { line1: addr.line1, line2: addr.line2 ?? null, postalCode: addr.postalCode, city: addr.city, countryCode: addr.countryCode, phone: addr.phone ?? null };
  }

  if (order.billingAddressId && order.billingAddressId !== order.shippingAddressId) {
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, order.billingAddressId)).limit(1);
    if (addr) billingAddress = { line1: addr.line1, line2: addr.line2 ?? null, postalCode: addr.postalCode, city: addr.city, countryCode: addr.countryCode, phone: addr.phone ?? null };
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const events = await db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.createdAt));

  const files = await db
    .select()
    .from(orderFiles)
    .where(eq(orderFiles.orderId, orderId))
    .orderBy(desc(orderFiles.createdAt));

  const { nextStatuses } = await import("@/lib/order-state");
  const next = nextStatuses(order.status as OrderStatus);

  return {
    order: order as AdminOrderDetail["order"],
    shippingAddress,
    billingAddress,
    items,
    events,
    files,
    nextStatuses: next,
  };
}

// ─── Upload BAT (proof) ───────────────────────────────────────────────────────

const uploadProofSchema = z.object({
  orderId: z.string().uuid(),
  // storageKey: MinIO object key (after upload via presigned URL)
  storageKey: z.string().min(1),
  filename: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
});

export async function uploadProof(
  input: z.infer<typeof uploadProofSchema>,
): Promise<Result<void>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };

  const parsed = uploadProofSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };

  const { orderId, storageKey, filename, mimeType } = parsed.data;

  // Verify order exists
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Commande introuvable" };

  // Determine next version number
  const existingProofs = await db
    .select({ version: orderFiles.version })
    .from(orderFiles)
    .where(and(eq(orderFiles.orderId, orderId), eq(orderFiles.type, "proof")));

  const nextVersion = existingProofs.length > 0
    ? Math.max(...existingProofs.map((p) => p.version)) + 1
    : 1;

  // Insert the proof file record
  await db.insert(orderFiles).values({
    orderId,
    type: "proof",
    version: nextVersion,
    storageKey,
    mimeType: mimeType ?? "application/pdf",
    originalFilename: filename ?? `BAT-v${nextVersion}.pdf`,
    uploadedById: admin.user.id,
  });

  // Transition to proof_sent (from paid or proof_revision_requested)
  const canTransitionToProofSent = ["paid", "proof_revision_requested"].includes(order.status);
  if (canTransitionToProofSent) {
    const transition = validateTransition(order.status as OrderStatus, "proof_sent");
    if (transition.ok) {
      await db
        .update(orders)
        .set({ status: "proof_sent", updatedAt: new Date() })
        .where(eq(orders.id, orderId));
    }
  }

  await db.insert(orderEvents).values({
    orderId,
    type: "proof.uploaded",
    actorId: admin.user.id,
    payload: { version: nextVersion, filename: filename ?? `BAT-v${nextVersion}.pdf`, storageKey },
  });

  // Send email notification to customer
  const [orderWithUser] = await db
    .select({ userId: orders.userId, guestEmail: orders.guestEmail })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (orderWithUser?.userId) {
    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, orderWithUser.userId))
      .limit(1);

    if (user?.email) {
      const { sendTemplatedEmail } = await import("@/lib/mail");
      const appUrl = process.env.BETTER_AUTH_URL ?? "";

      await sendTemplatedEmail("proof-ready", user.email, {
        customerName: user.name ?? "",
        orderNumber: orderId.slice(0, 8).toUpperCase(),
        orderUrl: `${appUrl}/account/orders/${orderId}`,
      }, user.name ?? undefined).catch(() => {/* non-blocking */});
    }
  }

  return { ok: true, data: undefined };
}

import { and } from "drizzle-orm";

// ─── Change order status ──────────────────────────────────────────────────────

const changeStatusSchema = z.object({
  orderId: z.string().uuid(),
  toStatus: z.string(),
  note: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingCarrier: z.string().optional(),
});

export async function changeOrderStatus(
  input: z.infer<typeof changeStatusSchema>,
): Promise<Result<void>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };

  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const { orderId, toStatus, note, trackingNumber, trackingCarrier } = parsed.data;

  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Commande introuvable" };

  const transition = validateTransition(order.status as OrderStatus, toStatus as OrderStatus);
  if (!transition.ok) return { ok: false, error: transition.error };

  await db
    .update(orders)
    .set({
      status: toStatus as OrderStatus,
      ...(trackingNumber ? { trackingNumber } : {}),
      ...(trackingCarrier ? { trackingCarrier } : {}),
      ...(note ? { internalNotes: note } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    type: transition.eventType,
    actorId: admin.user.id,
    payload: {
      from: order.status,
      to: toStatus,
      ...(note ? { note } : {}),
      ...(trackingNumber ? { trackingNumber, trackingCarrier } : {}),
    },
  });

  // Shipping notification — send email to customer when order is shipped
  if (toStatus === "shipped") {
    sendShippingEmail(orderId, trackingNumber, trackingCarrier).catch((err) =>
      console.error("[admin] shipping email failed:", err),
    );
  }

  return { ok: true, data: undefined };
}

async function sendShippingEmail(
  orderId: string,
  trackingNumber: string | undefined,
  trackingCarrier: string | undefined,
): Promise<void> {
  const [row] = await db
    .select({ userId: orders.userId, guestEmail: orders.guestEmail, totalCents: orders.totalCents })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return;

  let customerEmail: string | null = row.guestEmail ?? null;
  let customerName: string | null = null;

  if (row.userId) {
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    customerEmail = user?.email ?? customerEmail;
    customerName = user?.name ?? null;
  }

  if (!customerEmail) return;

  const { sendTemplatedEmail } = await import("@/lib/mail");
  const appUrl = process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "";

  await sendTemplatedEmail(
    "order-shipped",
    customerEmail,
    {
      customerName: customerName ?? customerEmail,
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      orderTotal: `${(row.totalCents / 100).toFixed(2)} €`,
      orderUrl: `${appUrl}/account/orders/${orderId}`,
      ...(trackingNumber ? { trackingNumber } : {}),
      ...(trackingCarrier ? { trackingCarrier } : {}),
    },
    customerName ?? undefined,
  );
}

// ─── Add internal note ────────────────────────────────────────────────────────

export async function addInternalNote(
  orderId: string,
  note: string,
): Promise<Result<void>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };
  if (!note.trim()) return { ok: false, error: "Note vide" };

  await db
    .update(orders)
    .set({ internalNotes: note.trim(), updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    type: "admin.note_added",
    actorId: admin.user.id,
    payload: { note: note.trim() },
  });

  return { ok: true, data: undefined };
}

// ─── Reply to proof revision ──────────────────────────────────────────────────

export async function replyToRevision(
  orderId: string,
  reply: string,
): Promise<Result<void>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };
  if (!reply.trim()) return { ok: false, error: "Réponse vide" };

  const [order] = await db
    .select({ userId: orders.userId, guestEmail: orders.guestEmail, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Commande introuvable" };

  // Fetch customer info
  let customerEmail: string | null = order.guestEmail ?? null;
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

  if (!customerEmail) return { ok: false, error: "Email client introuvable" };

  // Log the reply event
  await db.insert(orderEvents).values({
    orderId,
    type: "admin.revision_reply",
    actorId: admin.user.id,
    payload: { reply: reply.trim() },
  });

  // Send email to customer
  const { sendTemplatedEmail } = await import("@/lib/mail");
  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  await sendTemplatedEmail("bat-reply", customerEmail, {
    customerName: customerName ?? "",
    orderNumber: orderId.slice(0, 8).toUpperCase(),
    replyMessage: reply.trim(),
    orderUrl: `${appUrl}/account/orders/${orderId}`,
  }, customerName ?? undefined);

  return { ok: true, data: undefined };
}

// ─── SendCloud — get shipping methods ─────────────────────────────────────────

export async function getSendCloudShippingMethods(countryCode = "FR") {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Non autorisé" };
  const { getShippingMethods } = await import("@/lib/sendcloud");
  return getShippingMethods(countryCode);
}

// ─── SendCloud — create shipment ──────────────────────────────────────────────

export async function createShipment(
  orderId: string,
  input: {
    shippingOptionCode: string;
    weightGrams: number;
  },
): Promise<Result<{ parcelId: string; trackingNumber: string; labelUrl: string | null }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };

  // Fetch order + address + customer
  const [row] = await db
    .select({
      order: orders,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return { ok: false, error: "Commande introuvable" };
  if (row.order.sendcloudParcelId) return { ok: false, error: "Un colis SendCloud existe déjà pour cette commande" };

  const { order } = row;

  // Fetch shipping address
  let addr: typeof addresses.$inferSelect | null = null;
  if (order.shippingAddressId) {
    const [a] = await db.select().from(addresses).where(eq(addresses.id, order.shippingAddressId)).limit(1);
    addr = a ?? null;
  }

  if (!addr) return { ok: false, error: "Adresse de livraison manquante" };

  const email = row.customerEmail ?? order.guestEmail ?? "";
  if (!email) return { ok: false, error: "Email client manquant" };

  const name = [addr.firstName, addr.lastName].filter(Boolean).join(" ") || row.customerName || email;
  const fromAddressId = process.env.SENDCLOUD_FROM_ADDRESS_ID
    ? Number(process.env.SENDCLOUD_FROM_ADDRESS_ID)
    : undefined;

  const { createParcel } = await import("@/lib/sendcloud");
  const parcelRes = await createParcel({
    name,
    address: addr.line1,
    houseNumber: addr.line2 ?? "",
    city: addr.city,
    postalCode: addr.postalCode,
    countryCode: addr.countryCode,
    phone: addr.phone ?? "",
    email,
    orderNumber: orderId.slice(0, 8).toUpperCase(),
    weightGrams: input.weightGrams,
    shippingOptionCode: input.shippingOptionCode,
    fromAddressId,
  });

  if (!parcelRes.ok) {
    await db.insert(orderEvents).values({
      orderId,
      type: "sendcloud.error",
      actorId: admin.user.id,
      payload: { error: parcelRes.error, timestamp: new Date().toISOString() },
    });
    return { ok: false, error: parcelRes.error };
  }

  const parcel = parcelRes.data;
  const labelUrl = parcel.label_url || `https://panel.sendcloud.sc/api/v3/parcels/${parcel.id}/documents/label`;
  const trackingNumber = parcel.tracking_number ?? "";
  const trackingCarrier = parcel.carrier_code ?? "";

  // Persist in DB
  await db
    .update(orders)
    .set({
      sendcloudParcelId: String(parcel.id),
      shippingLabelUrl: labelUrl,
      trackingNumber: trackingNumber || null,
      trackingCarrier: trackingCarrier || null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    type: "sendcloud.parcel_created",
    actorId: admin.user.id,
    payload: {
      parcelId: parcel.id,
      trackingNumber,
      carrier: trackingCarrier,
      labelUrl,
    },
  });

  return {
    ok: true,
    data: { parcelId: String(parcel.id), trackingNumber, labelUrl },
  };
}

// ─── Products CRUD ────────────────────────────────────────────────────────────

const ALLOWED_SHAPES = ["die-cut", "circle", "square", "rectangle", "kiss-cut"] as const;

const pricingTierSchema = z.object({
  minQty: z.number().int().min(1),
  discountPct: z.number().min(0).max(0.99),
});

const ALLOWED_FINISHES = ["gloss", "matte", "uv-laminated"] as const;
const ALLOWED_SIZES = ["2x2", "3x3", "4x4", "5x5", "7x7", "custom"] as const;
const ALLOWED_MATERIALS = ["vinyl", "holographic", "glitter", "transparent", "kraft"] as const;

const updateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  tagline: z.string().max(500).optional(),
  features: z.array(z.string().min(1)).optional(),
  tiers: z.array(pricingTierSchema).min(1).optional(),
  availableFinishes: z.array(z.enum(ALLOWED_FINISHES)).min(1).optional(),
  availableSizes: z.array(z.enum(ALLOWED_SIZES)).min(1).optional(),
  availableMaterials: z.array(z.enum(ALLOWED_MATERIALS)).min(1).optional(),
  sizePrices: z.record(z.string(), z.number().int().min(0)).optional(),
  customPresets: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    widthMm: z.number().int().min(5).max(500),
    heightMm: z.number().int().min(5).max(500),
  })).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  basePriceCents: z.number().int().min(1),
  minQty: z.number().int().min(1).default(1),
  minWidthMm: z.number().int().min(5),
  maxWidthMm: z.number().int().max(500),
  minHeightMm: z.number().int().min(5),
  maxHeightMm: z.number().int().max(500),
  shapes: z.array(z.enum(ALLOWED_SHAPES)).min(1),
  active: z.boolean(),
  sortOrder: z.number().int().default(0),
});

export async function updateProduct(
  input: z.infer<typeof updateProductSchema>,
): Promise<Result<void>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides : " + parsed.error.issues[0]?.message };

  const { id, tagline, features, tiers, availableFinishes, availableSizes, availableMaterials, sizePrices, customPresets, ...data } = parsed.data;

  // Merge dynamic options into JSONB
  const [current] = await db.select({ options: products.options }).from(products).where(eq(products.id, id)).limit(1);
  const currentOptions = (current?.options ?? {}) as Record<string, unknown>;
  const newOptions = {
    ...currentOptions,
    ...(tagline !== undefined ? { tagline: tagline || null } : {}),
    ...(features !== undefined ? { features } : {}),
    ...(tiers !== undefined ? { tiers } : {}),
    ...(availableFinishes !== undefined ? { availableFinishes } : {}),
    ...(availableSizes !== undefined ? { availableSizes } : {}),
    ...(availableMaterials !== undefined ? { availableMaterials } : {}),
    ...(sizePrices !== undefined ? { sizePrices } : {}),
    ...(customPresets !== undefined ? { customPresets } : {}),
  };

  await db
    .update(products)
    .set({
      ...data,
      shapes: data.shapes as string[],
      imageUrl: data.imageUrl || null,
      options: newOptions,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  return { ok: true, data: undefined };
}

export async function getProduct(id: string) {
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return p ?? null;
}

// ─── Customer detail ──────────────────────────────────────────────────────────

export async function getCustomerDetail(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const customerOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return { user, orders: customerOrders };
}

// ─── Stripe refund ────────────────────────────────────────────────────────────

const refundSchema = z.object({
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(), // undefined = full refund
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).default("requested_by_customer"),
});

export async function refundOrder(
  input: z.infer<typeof refundSchema>,
): Promise<Result<{ refundId: string; amountCents: number }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };

  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const { orderId, amountCents, reason } = parsed.data;

  const [order] = await db
    .select({
      stripePaymentIntentId: orders.stripePaymentIntentId,
      totalCents: orders.totalCents,
      status: orders.status,
      pennylaneInvoiceId: orders.pennylaneInvoiceId,
      pennylaneCustomerId: orders.pennylaneCustomerId,
      vatRate: orders.vatRate,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Commande introuvable" };
  if (!order.stripePaymentIntentId) return { ok: false, error: "Aucun paiement Stripe associé à cette commande" };
  if (order.status === "cancelled") return { ok: false, error: "Cette commande est déjà annulée" };

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      ...(amountCents ? { amount: amountCents } : {}),
      reason,
    });

    // Transition order to cancelled if full refund
    if (!amountCents || amountCents >= order.totalCents) {
      await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
      await db.insert(orderEvents).values({
        orderId,
        type: "order.cancelled",
        actorId: admin.user.id,
        payload: { reason: "refund", stripeRefundId: refund.id, amountCents: refund.amount },
      });
    } else {
      await db.insert(orderEvents).values({
        orderId,
        type: "order.partial_refund",
        actorId: admin.user.id,
        payload: { stripeRefundId: refund.id, amountCents: refund.amount, reason: parsed.data.reason ?? null },
      });
    }

    // Create Pennylane credit note if invoice exists
    if (order.pennylaneInvoiceId && order.pennylaneCustomerId) {
      const { createCreditNote } = await import("@/lib/pennylane");
      const vatRate = parseFloat(order.vatRate ?? "0.2");
      const creditRes = await createCreditNote({
        customerId: Number(order.pennylaneCustomerId),
        creditedInvoiceId: order.pennylaneInvoiceId,
        amountCentsTTC: refund.amount,
        vatRate,
        date: new Date().toISOString().slice(0, 10),
        description: reason === "fraudulent" ? "Remboursement — fraude" : reason === "duplicate" ? "Remboursement — doublon" : "Remboursement",
      });
      if (creditRes.ok) {
        await db.insert(orderEvents).values({
          orderId,
          type: "admin.note_added",
          actorId: admin.user.id,
          payload: {
            note: `Avoir Pennylane émis (#${creditRes.data.invoice_number}) — ${(refund.amount / 100).toFixed(2)} €`,
            creditNoteId: creditRes.data.id,
            creditNoteUrl: creditRes.data.public_file_url,
          },
        });
      } else {
        await db.insert(orderEvents).values({
          orderId,
          type: "pennylane.error",
          actorId: admin.user.id,
          payload: { step: "create_credit_note", error: creditRes.error, timestamp: new Date().toISOString() },
        });
      }
    }

    return { ok: true, data: { refundId: refund.id, amountCents: refund.amount } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur Stripe inconnue";
    return { ok: false, error: msg };
  }
}

// ─── Generate Pennylane invoice ───────────────────────────────────────────────

export async function generateInvoice(
  orderId: string,
): Promise<Result<{ invoiceUrl: string | null }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };

  const [order] = await db
    .select({
      id: orders.id,
      totalCents: orders.totalCents,
      subtotalCents: orders.subtotalCents,
      taxAmountCents: orders.taxAmountCents,
      shippingCents: orders.shippingCents,
      vatRate: orders.vatRate,
      pennylaneInvoiceId: orders.pennylaneInvoiceId,
      pennylaneInvoiceUrl: orders.pennylaneInvoiceUrl,
      userId: orders.userId,
      guestEmail: orders.guestEmail,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Commande introuvable" };
  if (order.pennylaneInvoiceId) return { ok: false, error: "Une facture existe déjà pour cette commande" };

  // Get customer email
  let customerEmail: string | null = order.guestEmail ?? null;
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

  if (!customerEmail) return { ok: false, error: "Email client introuvable" };

  const {
    getOrCreateCustomer,
    createAndFinalizeInvoice,
    vatRateToCode,
    centsToEuroString,
  } = await import("@/lib/pennylane");

  const customerRes = await getOrCreateCustomer({ email: customerEmail, name: customerName });
  if (!customerRes.ok) {
    await db.insert(orderEvents).values({
      orderId,
      type: "pennylane.error",
      actorId: admin.user.id,
      payload: { step: "get_or_create_customer", error: customerRes.error, timestamp: new Date().toISOString() },
    });
    return { ok: false, error: customerRes.error };
  }

  const pennylaneCustomerId = customerRes.data.id;

  const items = await db
    .select({
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
      let label = `Sticker ${item.shape} ${item.widthMm}×${item.heightMm} mm`;
      if (item.productId) {
        const [p] = await db.select({ name: products.name }).from(products).where(eq(products.id, item.productId)).limit(1);
        if (p) label = `${p.name} — ${item.shape} ${item.widthMm}×${item.heightMm} mm`;
      }
      // unitPriceCents is already excl. tax — do NOT divide by (1 + vatRate)
      return { label, quantity: item.quantity, raw_currency_unit_price: centsToEuroString(item.unitPriceCents), vat_rate: vatCode, unit: "unité" };
    }),
  );

  if (order.shippingCents > 0) {
    // shippingCents is TTC — divide by (1 + vatRate) to get HT
    const shippingExclTax = Math.round(order.shippingCents / (1 + vatRate));
    invoiceLines.push({ label: "Frais de livraison", quantity: 1, raw_currency_unit_price: centsToEuroString(shippingExclTax), vat_rate: vatCode, unit: "forfait" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const invoiceRes = await createAndFinalizeInvoice({
    customerId: pennylaneCustomerId,
    date: today,
    deadline: today,
    lines: invoiceLines,
    externalReference: orderId,
    subject: `Commande MS Adhésif #${orderId.slice(0, 8).toUpperCase()}`,
    description: `Stickers personnalisés — commande du ${today}`,
  });

  if (!invoiceRes.ok) {
    await db.insert(orderEvents).values({
      orderId,
      type: "pennylane.error",
      actorId: admin.user.id,
      payload: { step: "create_invoice", error: invoiceRes.error, timestamp: new Date().toISOString() },
    });
    return { ok: false, error: invoiceRes.error };
  }

  const invoice = invoiceRes.data;
  const invoiceUrl = invoice.pdf_invoice_url ?? invoice.file_url ?? null;

  await db.update(orders).set({
    pennylaneCustomerId: String(pennylaneCustomerId),
    pennylaneInvoiceId: String(invoice.id),
    pennylaneInvoiceUrl: invoiceUrl,
    updatedAt: new Date(),
  }).where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    type: "admin.note_added",
    actorId: admin.user.id,
    payload: { note: `Facture Pennylane générée manuellement (#${invoice.invoice_number})` },
  });

  return { ok: true, data: { invoiceUrl } };
}

// ─── Refresh Pennylane invoice URL ────────────────────────────────────────────

export async function refreshInvoiceUrl(
  orderId: string,
): Promise<Result<{ invoiceUrl: string | null }>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Non autorisé" };

  const [order] = await db
    .select({ pennylaneInvoiceId: orders.pennylaneInvoiceId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, error: "Commande introuvable" };
  if (!order.pennylaneInvoiceId) return { ok: false, error: "Aucune facture associée à cette commande" };

  const { getInvoicePdfUrl } = await import("@/lib/pennylane");

  const res = await getInvoicePdfUrl(order.pennylaneInvoiceId);
  if (!res.ok) return { ok: false, error: res.error };

  const invoiceUrl = res.data.invoiceUrl;

  if (invoiceUrl) {
    await db.update(orders).set({ pennylaneInvoiceUrl: invoiceUrl, updatedAt: new Date() }).where(eq(orders.id, orderId));
  }

  return { ok: true, data: { invoiceUrl } };
}
