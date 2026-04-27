"use server";

import { db } from "@/db";
import { addresses, orders } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedAddress {
  id: string;
  label: string | null;
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
}

// ─── Get user saved addresses ─────────────────────────────────────────────────

export async function getUserAddresses(): Promise<SavedAddress[]> {
  const user = await requireUser();
  if (!user) return [];

  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt))
    .limit(10);

  return rows.map((r) => ({
    id: r.id,
    label: r.label ?? null,
    firstName: r.firstName ?? null,
    lastName: r.lastName ?? null,
    line1: r.line1,
    line2: r.line2 ?? null,
    postalCode: r.postalCode,
    city: r.city,
    countryCode: r.countryCode,
    phone: r.phone ?? null,
    isDefault: r.isDefault,
  }));
}

// ─── Save a new address ───────────────────────────────────────────────────────

const saveAddressSchema = z.object({
  label: z.string().max(50).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  line1: z.string().min(3).max(255),
  line2: z.string().max(255).optional(),
  postalCode: z.string().regex(/^\d{5}$/),
  city: z.string().min(1).max(100),
  countryCode: z.string().length(2).default("FR"),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function saveAddress(
  input: z.infer<typeof saveAddressSchema>,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Non connecté" };

  const parsed = saveAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Données invalides" };

  const data = parsed.data;

  // If setting as default, unset previous default
  if (data.isDefault) {
    await db
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(addresses.userId, user.id), eq(addresses.isDefault, true)));
  }

  const [inserted] = await db
    .insert(addresses)
    .values({
      userId: user.id,
      label: data.label ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      line1: data.line1,
      line2: data.line2 ?? null,
      postalCode: data.postalCode,
      city: data.city,
      countryCode: data.countryCode,
      phone: data.phone ?? null,
      isDefault: data.isDefault,
    })
    .returning({ id: addresses.id });

  if (!inserted) return { ok: false, error: "Erreur lors de la sauvegarde" };

  return { ok: true, data: { id: inserted.id } };
}

// ─── Set default address ──────────────────────────────────────────────────────

export async function setDefaultAddress(addressId: string): Promise<Result<void>> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Non connecté" };

  // Unset all defaults for this user
  await db
    .update(addresses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(addresses.userId, user.id));

  // Set the new default
  await db
    .update(addresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)));

  return { ok: true, data: undefined };
}

// ─── Delete address ───────────────────────────────────────────────────────────

export async function deleteAddress(addressId: string): Promise<Result<void>> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Non connecté" };

  await db
    .delete(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)));

  return { ok: true, data: undefined };
}

// ─── Get address pre-fill from latest order ───────────────────────────────────
// Used to auto-suggest when user has no saved addresses

export async function getLastOrderAddress(): Promise<SavedAddress | null> {
  const user = await requireUser();
  if (!user) return null;

  // Find the most recent order with a shipping address
  const [lastOrder] = await db
    .select({ shippingAddressId: orders.shippingAddressId })
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!lastOrder?.shippingAddressId) return null;

  const [addr] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.id, lastOrder.shippingAddressId))
    .limit(1);

  if (!addr) return null;

  return {
    id: addr.id,
    label: addr.label ?? null,
    firstName: addr.firstName ?? null,
    lastName: addr.lastName ?? null,
    line1: addr.line1,
    line2: addr.line2 ?? null,
    postalCode: addr.postalCode,
    city: addr.city,
    countryCode: addr.countryCode,
    phone: addr.phone ?? null,
    isDefault: addr.isDefault,
  };
}
