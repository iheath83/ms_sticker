"use server";

import { db } from "@/db";
import { orders, orderItems, orderEvents, orderFiles, products, users, addresses } from "@/db/schema";
import { eq, desc, ne, and, inArray, notInArray } from "drizzle-orm";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { validateTransition } from "@/lib/order-state";
import type { OrderStatus } from "@/lib/order-state";
import { z } from "zod";
import { sendEmail } from "@/lib/mail";
import { getPresignedDownloadUrl } from "@/lib/storage";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireCustomer() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return session;
}

// ─── My orders list ───────────────────────────────────────────────────────────

export interface CustomerOrderRow {
  id: string;
  status: string;
  totalCents: number;
  subtotalCents: number;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  productName: string | null;
  productId: string | null;
  thumbnail: string | null; // presigned URL of first customer_upload
}

export async function getMyOrders(): Promise<CustomerOrderRow[]> {
  const session = await requireCustomer();
  if (!session) return [];

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      subtotalCents: orders.subtotalCents,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.userId, session.user.id),
        ne(orders.status, "draft"),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(50);

  const result: CustomerOrderRow[] = await Promise.all(
    rows.map(async (row) => {
      const items = await db
        .select({
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          id: orderItems.id,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, row.id))
        .limit(5);

      const itemCount = items.length;
      let productName: string | null = null;
      let productId: string | null = null;

      if (items[0]?.productId) {
        productId = items[0].productId;
        const [product] = await db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, items[0].productId))
          .limit(1);
        productName = product?.name ?? null;
      }

      // Fetch thumbnail: first customer_upload file of first item
      let thumbnail: string | null = null;
      const firstItemId = items[0]?.id;
      if (firstItemId) {
        const [file] = await db
          .select({ storageKey: orderFiles.storageKey, mimeType: orderFiles.mimeType })
          .from(orderFiles)
          .where(and(
            eq(orderFiles.orderId, row.id),
            eq(orderFiles.type, "customer_upload"),
            eq(orderFiles.orderItemId, firstItemId),
          ))
          .orderBy(desc(orderFiles.createdAt))
          .limit(1);
        if (file?.mimeType?.startsWith("image/")) {
          // Return proxy URL instead of presigned URL
          thumbnail = `/api/uploads/download?key=${encodeURIComponent(file.storageKey)}&orderId=${row.id}`;
        }
      }

      return { ...row, itemCount, productName, productId, thumbnail };
    }),
  );

  return result;
}

// ─── Order detail ─────────────────────────────────────────────────────────────

export interface CustomerOrderDetail {
  order: {
    id: string;
    status: string;
    totalCents: number;
    subtotalCents: number;
    taxAmountCents: number;
    shippingCents: number;
    vatRate: string | null;
    notes: string | null;
    trackingNumber: string | null;
    trackingCarrier: string | null;
    stripePaymentIntentId: string | null;
    pennylaneInvoiceUrl: string | null;
    pennylaneInvoiceId: string | null;
    deliveryMethod: string | null;
    createdAt: Date;
    updatedAt: Date;
    shippingAddress: {
      firstName: string | null; lastName: string | null;
      line1: string; line2: string | null;
      postalCode: string; city: string; countryCode: string; phone: string | null;
    } | null;
    billingAddress: {
      firstName: string | null; lastName: string | null;
      line1: string; line2: string | null;
      postalCode: string; city: string; countryCode: string; phone: string | null;
    } | null;
    cardLast4: string | null;
    totalRefundedCents: number;
  };
  items: Array<{
    id: string;
    quantity: number;
    widthMm: number;
    heightMm: number;
    shape: string;
    finish: string;
    options: unknown;
    unitPriceCents: number;
    lineTotalCents: number;
    productName: string | null;
    productId: string | null;
    customerFile: { url: string; filename: string | null } | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    createdAt: Date;
    payload: unknown;
  }>;
  proofs: Array<{
    id: string;
    storageKey: string;
    version: number;
    createdAt: Date;
    originalFilename: string | null;
  }>;
  canApprove: boolean;
  canRequestRevision: boolean;
}

export async function getMyOrderDetail(orderId: string): Promise<CustomerOrderDetail | null> {
  const session = await requireCustomer();
  if (!session) return null;

  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      totalCents: orders.totalCents,
      subtotalCents: orders.subtotalCents,
      taxAmountCents: orders.taxAmountCents,
      shippingCents: orders.shippingCents,
      vatRate: orders.vatRate,
      notes: orders.notes,
      trackingNumber: orders.trackingNumber,
      trackingCarrier: orders.trackingCarrier,
      stripePaymentIntentId: orders.stripePaymentIntentId,
      pennylaneInvoiceUrl: orders.pennylaneInvoiceUrl,
      pennylaneInvoiceId: orders.pennylaneInvoiceId,
      deliveryMethod: orders.deliveryMethod,
      shippingAddressId: orders.shippingAddressId,
      billingAddressId: orders.billingAddressId,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.userId !== session.user.id) return null;

  const rawItems = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      widthMm: orderItems.widthMm,
      heightMm: orderItems.heightMm,
      shape: orderItems.shape,
      finish: orderItems.finish,
      options: orderItems.options,
      unitPriceCents: orderItems.unitPriceCents,
      lineTotalCents: orderItems.lineTotalCents,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Fetch customer_upload files per item
  const itemIds = rawItems.map((i) => i.id);
  const uploadFiles = itemIds.length > 0
    ? await db
        .select({
          orderItemId: orderFiles.orderItemId,
          storageKey: orderFiles.storageKey,
          mimeType: orderFiles.mimeType,
          originalFilename: orderFiles.originalFilename,
          createdAt: orderFiles.createdAt,
        })
        .from(orderFiles)
        .where(and(
          eq(orderFiles.orderId, orderId),
          eq(orderFiles.type, "customer_upload"),
          inArray(orderFiles.orderItemId, itemIds),
        ))
        .orderBy(desc(orderFiles.createdAt))
    : [];

  // Latest file per item
  const fileByItem = new Map<string, typeof uploadFiles[0]>();
  for (const f of uploadFiles) {
    if (!f.orderItemId) continue;
    if (!fileByItem.has(f.orderItemId)) fileByItem.set(f.orderItemId, f);
  }

  const items = await Promise.all(
    rawItems.map(async (item) => {
      let productName: string | null = null;
      if (item.productId) {
        const [p] = await db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);
        productName = p?.name ?? null;
      }
      const rawFile = fileByItem.get(item.id) ?? null;
      let customerFile: { url: string; filename: string | null } | null = null;
      if (rawFile) {
        // Use proxy route — never expose MinIO URL directly
        const proxyUrl = `/api/uploads/download?key=${encodeURIComponent(rawFile.storageKey)}&orderId=${orderId}`;
        customerFile = { url: proxyUrl, filename: rawFile.originalFilename ?? null };
      }
      return { ...item, productName, customerFile };
    }),
  );

  // Internal event types not shown to customers
  const INTERNAL_EVENTS = ["pennylane.error", "payment.refunded", "admin.note_added"];

  const events = await db
    .select({
      id: orderEvents.id,
      type: orderEvents.type,
      createdAt: orderEvents.createdAt,
      payload: orderEvents.payload,
    })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, orderId), notInArray(orderEvents.type, INTERNAL_EVENTS)))
    .orderBy(desc(orderEvents.createdAt));

  const rawProofs = await db
    .select({
      id: orderFiles.id,
      storageKey: orderFiles.storageKey,
      version: orderFiles.version,
      createdAt: orderFiles.createdAt,
      originalFilename: orderFiles.originalFilename,
    })
    .from(orderFiles)
    .where(and(eq(orderFiles.orderId, orderId), eq(orderFiles.type, "proof")))
    .orderBy(desc(orderFiles.version));

  // Generate proxy URLs for each proof (no presigned URL exposed)
  const proofs = rawProofs.map((p) => ({
    ...p,
    storageKey: `/api/uploads/download?key=${encodeURIComponent(p.storageKey)}&orderId=${orderId}`,
  }));

  const canApprove = order.status === "proof_sent";
  const canRequestRevision = order.status === "proof_sent";

  // Fetch addresses
  let shippingAddress: CustomerOrderDetail["order"]["shippingAddress"] = null;
  let billingAddress: CustomerOrderDetail["order"]["billingAddress"] = null;

  if (order.shippingAddressId) {
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, order.shippingAddressId)).limit(1);
    if (addr) shippingAddress = { firstName: addr.firstName ?? null, lastName: addr.lastName ?? null, line1: addr.line1, line2: addr.line2 ?? null, postalCode: addr.postalCode, city: addr.city, countryCode: addr.countryCode, phone: addr.phone ?? null };
  }
  if (order.billingAddressId && order.billingAddressId !== order.shippingAddressId) {
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, order.billingAddressId)).limit(1);
    if (addr) billingAddress = { firstName: addr.firstName ?? null, lastName: addr.lastName ?? null, line1: addr.line1, line2: addr.line2 ?? null, postalCode: addr.postalCode, city: addr.city, countryCode: addr.countryCode, phone: addr.phone ?? null };
  }

  // Fetch card last4 from Stripe
  let cardLast4: string | null = null;
  if (order.stripePaymentIntentId) {
    try {
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });
      const pi = await stripeClient.paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ["payment_method"] });
      const pm = pi.payment_method;
      if (pm && typeof pm === "object" && "card" in pm && pm.card) {
        cardLast4 = String(pm.card.last4 ?? "");
      }
    } catch { /* non-blocking */ }
  }

  // Compute total refunded from events
  const totalRefundedCents = events
    .filter((e) => e.type === "order.partial_refund")
    .reduce((acc, e) => {
      const p = e.payload as Record<string, unknown> | null;
      return acc + (typeof p?.amountCents === "number" ? p.amountCents : 0);
    }, 0);

  return {
    order: {
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      subtotalCents: order.subtotalCents,
      taxAmountCents: order.taxAmountCents,
      shippingCents: order.shippingCents,
      vatRate: order.vatRate,
      notes: order.notes,
      trackingNumber: order.trackingNumber,
      trackingCarrier: order.trackingCarrier,
      stripePaymentIntentId: order.stripePaymentIntentId,
      pennylaneInvoiceUrl: order.pennylaneInvoiceUrl ?? null,
      pennylaneInvoiceId: order.pennylaneInvoiceId ?? null,
      deliveryMethod: order.deliveryMethod ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippingAddress,
      billingAddress,
      cardLast4,
      totalRefundedCents,
    },
    items,
    events,
    proofs,
    canApprove,
    canRequestRevision,
  };
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

const DRAFT_ORDER_COOKIE = "ms_draft_order";

export async function reorderFromOrder(
  sourceOrderId: string,
): Promise<Result<{ draftOrderId: string }>> {
  const session = await requireCustomer();
  if (!session) return { ok: false, error: "Non connecté" };

  const [sourceOrder] = await db
    .select({ id: orders.id, userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, sourceOrderId))
    .limit(1);
  if (!sourceOrder || sourceOrder.userId !== session.user.id) {
    return { ok: false, error: "Commande introuvable" };
  }

  const sourceItems = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, sourceOrderId));
  if (sourceItems.length === 0) return { ok: false, error: "Aucun article" };

  const [newOrder] = await db
    .insert(orders)
    .values({ userId: session.user.id, status: "draft", subtotalCents: 0, taxAmountCents: 0, shippingCents: 0, totalCents: 0 })
    .returning({ id: orders.id });
  if (!newOrder) return { ok: false, error: "Erreur création commande" };

  const draftOrderId = newOrder.id;

  const insertedItems = await db
    .insert(orderItems)
    .values(sourceItems.map((item) => ({
      orderId: draftOrderId,
      productId: item.productId,
      quantity: item.quantity,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      shape: item.shape,
      finish: item.finish,
      options: item.options,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      customizationNote: item.customizationNote,
    })))
    .returning({ id: orderItems.id });

  const sourceItemIds = sourceItems.map((i) => i.id);
  const existingFiles = await db
    .select()
    .from(orderFiles)
    .where(and(
      eq(orderFiles.orderId, sourceOrderId),
      eq(orderFiles.type, "customer_upload"),
      inArray(orderFiles.orderItemId, sourceItemIds),
    ));

  const oldToNew = new Map<string, string>();
  sourceItems.forEach((old, idx) => {
    const n = insertedItems[idx];
    if (n) oldToNew.set(old.id, n.id);
  });

  if (existingFiles.length > 0) {
    await db.insert(orderFiles).values(
      existingFiles.map((f) => ({
        orderId: draftOrderId,
        orderItemId: f.orderItemId ? (oldToNew.get(f.orderItemId) ?? null) : null,
        type: f.type,
        version: f.version,
        storageKey: f.storageKey,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        originalFilename: f.originalFilename,
        uploadedById: session.user.id,
      })),
    );
  }

  const subtotal = sourceItems.reduce((acc, i) => acc + i.lineTotalCents, 0);
  const vat = Math.ceil(subtotal * 0.20);
  await db
    .update(orders)
    .set({ subtotalCents: subtotal, taxAmountCents: vat, totalCents: subtotal + vat, updatedAt: new Date() })
    .where(eq(orders.id, draftOrderId));

  const jar = await cookies();
  jar.set(DRAFT_ORDER_COOKIE, draftOrderId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });

  return { ok: true, data: { draftOrderId } };
}


export async function approveProof(orderId: string): Promise<Result<void>> {
  const session = await requireCustomer();
  if (!session) return { ok: false, error: "Non connecté" };

  const [order] = await db
    .select({ userId: orders.userId, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.userId !== session.user.id) {
    return { ok: false, error: "Commande introuvable" };
  }

  // BAT approval now goes directly to in_production (payment was done at order submission)
  const transition = validateTransition(order.status as OrderStatus, "approved");
  if (!transition.ok) return { ok: false, error: transition.error };

  await db
    .update(orders)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    type: transition.eventType,
    actorId: session.user.id,
    payload: { from: order.status, to: "approved" },
  });

  // Notify admin to start production
  const adminEmail = process.env["BREVO_ADMIN_EMAIL"] ?? process.env["BREVO_FROM_EMAIL"];
  if (adminEmail) {
    const appUrl = process.env["BETTER_AUTH_URL"] ?? "";
    await sendEmail({
      to: adminEmail,
      subject: `✅ BAT approuvé — lancer la production #${orderId.slice(0, 8).toUpperCase()}`,
      html: `<p>Le client a approuvé son bon à tirer pour la commande <strong>#${orderId.slice(0, 8).toUpperCase()}</strong>.</p><p><a href="${appUrl}/admin/orders/${orderId}">Voir la commande →</a></p>`,
    }).catch(() => {/* non-blocking */});
  }

  // Confirm to customer
  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user?.email) {
    const { sendTemplatedEmail } = await import("@/lib/mail");
    const appUrl = process.env["BETTER_AUTH_URL"] ?? "";
    await sendTemplatedEmail("proof-revision-acknowledged", user.email, {
      customerName: user.name ?? "",
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      orderUrl: `${appUrl}/account/orders/${orderId}`,
    }, user.name ?? undefined).catch(() => {/* non-blocking */});
  }

  return { ok: true, data: undefined };
}

// ─── Request proof revision ───────────────────────────────────────────────────

const revisionSchema = z.object({
  orderId: z.string().uuid(),
  message: z.string().min(10, "Le message doit faire au moins 10 caractères").max(2000),
});

export async function requestProofRevision(
  input: z.infer<typeof revisionSchema>,
): Promise<Result<void>> {
  const session = await requireCustomer();
  if (!session) return { ok: false, error: "Non connecté" };

  const parsed = revisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };

  const { orderId, message } = parsed.data;

  const [order] = await db
    .select({ userId: orders.userId, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.userId !== session.user.id) {
    return { ok: false, error: "Commande introuvable" };
  }

  const transition = validateTransition(order.status as OrderStatus, "proof_revision_requested");
  if (!transition.ok) return { ok: false, error: transition.error };

  await db
    .update(orders)
    .set({ status: "proof_revision_requested", notes: message, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(orderEvents).values({
    orderId,
    type: "proof.revision_requested",
    actorId: session.user.id,
    payload: { from: order.status, to: "proof_revision_requested", message },
  });

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Notify admin (plain email since no template for admin-revision-notification)
  const adminEmail = process.env.BREVO_FROM_EMAIL ?? "";
  if (adminEmail) {
    const appUrl = process.env.BETTER_AUTH_URL ?? "";
    await sendEmail({
      to: adminEmail,
      subject: `Révision demandée — commande #${orderId.slice(0, 8).toUpperCase()}`,
      html: `<p>Le client <strong>${user?.name ?? user?.email}</strong> a demandé une révision :</p><blockquote style="border-left:3px solid #DC2626;padding-left:12px;color:#666">${message}</blockquote><p><a href="${appUrl}/admin/orders/${orderId}">Voir la commande →</a></p>`,
    }).catch(() => {/* non-blocking */});
  }

  return { ok: true, data: undefined };
}
