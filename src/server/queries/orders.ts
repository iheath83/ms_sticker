/**
 * Data Access Layer — orders (read-only).
 * Pure DB queries, no mutation, no auth guard.
 * Auth guards live in the Server Actions that call these.
 */

import { db } from "@/db";
import { orders, orderItems, orderEvents, orderFiles, users, addresses, products } from "@/db/schema";
import { eq, desc, count, ne, inArray, and, notInArray } from "drizzle-orm";
import type { OrderStatus } from "@/lib/order-state";

// ─── Admin: dashboard stats ───────────────────────────────────────────────────

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

export async function queryDashboardStats(): Promise<DashboardStats> {
  const statusRows = await db
    .select({ status: orders.status, count: count() })
    .from(orders)
    .where(ne(orders.status, "draft"))
    .groupBy(orders.status);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = Number(row.count);
  }

  const urgentOrders = await db
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
    .where(inArray(orders.status, ["paid", "proof_revision_requested"]))
    .orderBy(desc(orders.createdAt))
    .limit(10);

  return { byStatus, urgentOrders };
}

// ─── Admin: orders list ───────────────────────────────────────────────────────

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

export async function queryAdminOrders(status?: string): Promise<AdminOrderRow[]> {
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

  return Promise.all(
    rows.map(async (row) => {
      const counts = await db
        .select({ value: count() })
        .from(orderItems)
        .where(eq(orderItems.orderId, row.id));
      return { ...row, itemCount: Number(counts[0]?.value ?? 0) };
    }),
  );
}

// ─── Admin: order detail ──────────────────────────────────────────────────────

export type AddressSnapshot = {
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
  shippingAddress: AddressSnapshot;
  billingAddress: AddressSnapshot;
  items: Array<typeof orderItems.$inferSelect>;
  events: Array<typeof orderEvents.$inferSelect>;
  files: Array<typeof orderFiles.$inferSelect>;
  nextStatuses: OrderStatus[];
}

export async function queryAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const rows = await db
    .select({ order: orders, customerName: users.name, customerEmail: users.email })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!rows[0]) return null;

  const order = {
    ...rows[0].order,
    customerName: rows[0].customerName,
    customerEmail: rows[0].customerEmail,
  };

  const fetchAddr = async (id: string | null): Promise<AddressSnapshot> => {
    if (!id) return null;
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
    if (!addr) return null;
    return { line1: addr.line1, line2: addr.line2 ?? null, postalCode: addr.postalCode, city: addr.city, countryCode: addr.countryCode, phone: addr.phone ?? null };
  };

  const [shippingAddress, billingAddress, items, events, files] = await Promise.all([
    fetchAddr(order.shippingAddressId),
    order.billingAddressId !== order.shippingAddressId
      ? fetchAddr(order.billingAddressId)
      : fetchAddr(order.shippingAddressId),
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(desc(orderEvents.createdAt)),
    db.select().from(orderFiles).where(eq(orderFiles.orderId, orderId)).orderBy(desc(orderFiles.createdAt)),
  ]);

  const { nextStatuses } = await import("@/lib/order-state");

  return {
    order: order as AdminOrderDetail["order"],
    shippingAddress,
    billingAddress,
    items,
    events,
    files,
    nextStatuses: nextStatuses(order.status as OrderStatus),
  };
}

// ─── Customer: invoices list ──────────────────────────────────────────────────

export interface CustomerInvoiceRow {
  orderId: string;
  createdAt: Date;
  totalCents: number;
  pennylaneInvoiceId: string;
  pennylaneInvoiceUrl: string | null;
  status: string;
}

export async function queryMyInvoices(userId: string): Promise<CustomerInvoiceRow[]> {
  const rows = await db
    .select({
      orderId: orders.id,
      createdAt: orders.createdAt,
      totalCents: orders.totalCents,
      pennylaneInvoiceId: orders.pennylaneInvoiceId,
      pennylaneInvoiceUrl: orders.pennylaneInvoiceUrl,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        ne(orders.status, "draft"),
        ne(orders.status, "cancelled"),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return rows
    .filter((r) => r.pennylaneInvoiceId !== null)
    .map((r) => ({
      orderId: r.orderId,
      createdAt: r.createdAt,
      totalCents: r.totalCents,
      pennylaneInvoiceId: r.pennylaneInvoiceId!,
      pennylaneInvoiceUrl: r.pennylaneInvoiceUrl,
      status: r.status,
    }));
}
