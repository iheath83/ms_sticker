/**
 * Data Access Layer — customers (read-only).
 */

import { db } from "@/db";
import { users, orders, customerProfiles, addresses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function queryCustomerDetail(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);

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

  const customerAddresses = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.createdAt));

  return { user, profile: profile ?? null, orders: customerOrders, addresses: customerAddresses };
}
