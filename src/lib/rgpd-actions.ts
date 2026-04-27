"use server";

import { db } from "@/db";
import { orders, orderItems, orderEvents, addresses, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return session.user;
}

// ─── Export user data (RGPD droit à la portabilité) ───────────────────────────

export async function exportUserData(): Promise<Result<object>> {
  const user = await requireSession();
  if (!user) return { ok: false, error: "Non authentifié" };

  const [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const userAddresses = await db.select().from(addresses).where(eq(addresses.userId, user.id));
  const userOrders = await db.select().from(orders).where(eq(orders.userId, user.id));
  const orderIds = userOrders.map((o) => o.id);

  const allItems = orderIds.length > 0
    ? await db.select().from(orderItems).where(
        orderIds.length === 1
          ? eq(orderItems.orderId, orderIds[0]!)
          : orderIds.reduce((acc, id, i) => i === 0 ? eq(orderItems.orderId, id) : acc, eq(orderItems.orderId, orderIds[0]!))
      )
    : [];

  // Build sanitised export (no password_hash)
  const export_ = {
    exportedAt: new Date().toISOString(),
    user: {
      id: userRow?.id,
      email: userRow?.email,
      name: userRow?.name,
      phone: userRow?.phone,
      role: userRow?.role,
      createdAt: userRow?.createdAt,
    },
    addresses: userAddresses.map((a) => ({
      id: a.id,
      label: a.label,
      firstName: a.firstName,
      lastName: a.lastName,
      line1: a.line1,
      line2: a.line2,
      postalCode: a.postalCode,
      city: a.city,
      countryCode: a.countryCode,
      phone: a.phone,
      isDefault: a.isDefault,
    })),
    orders: userOrders.map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      currency: o.currency,
      createdAt: o.createdAt,
    })),
  };

  return { ok: true, data: export_ };
}

// ─── Delete account (RGPD droit à l'effacement) ────────────────────────────────

export async function deleteUserAccount(): Promise<Result> {
  const user = await requireSession();
  if (!user) return { ok: false, error: "Non authentifié" };

  const now = new Date();
  const anonEmail = `deleted+${user.id}@msadhesif.invalid`;
  const anonName = "Compte supprimé";

  try {
    // 1. Anonymise user PII (soft-delete, preserve orders for legal obligation)
    await db
      .update(users)
      .set({
        email: anonEmail,
        name: anonName,
        phone: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // 2. Detach addresses from user (keep for order history, anonymise)
    await db
      .update(addresses)
      .set({
        userId: null,
        firstName: "Supprimé",
        lastName: "Supprimé",
        phone: null,
        updatedAt: now,
      })
      .where(eq(addresses.userId, user.id));

    // 3. Orders remain (10-year legal retention) but guest_email is anonymised
    await db
      .update(orders)
      .set({ guestEmail: null, updatedAt: now })
      .where(eq(orders.userId, user.id));

    // 4. Sign out the user session (Better-Auth)
    await auth.api.revokeSessions({ headers: await headers() });

    return { ok: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return { ok: false, error: msg };
  }
}
