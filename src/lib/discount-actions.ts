"use server";

import { db } from "@/db";
import { discounts, discountUsages, orders } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { calculateDiscounts } from "@/lib/discounts/discount-engine";
import type { DiscountFormInput, AppliedDiscountSnapshot, DiscountEligibility } from "@/lib/discounts/discount-types";

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") throw new Error("Non autorisé");
  return session;
}

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

export async function getAdminDiscounts() {
  await requireAdmin();
  return db.select().from(discounts).orderBy(desc(discounts.createdAt));
}

export async function getAdminDiscount(id: string) {
  await requireAdmin();
  const [row] = await db.select().from(discounts).where(eq(discounts.id, id)).limit(1);
  return row ?? null;
}

export async function createDiscount(input: DiscountFormInput) {
  await requireAdmin();

  const code = input.code ? input.code.trim().toUpperCase() : undefined;

  const [row] = await db
    .insert(discounts)
    .values({
      title:                 input.title,
      internalName:          input.internalName ?? null,
      code:                  code ?? null,
      method:                input.method,
      type:                  input.type,
      target:                input.target,
      value:                 input.value ?? null,
      status:                input.status,
      startsAt:              new Date(input.startsAt),
      endsAt:                input.endsAt ? new Date(input.endsAt) : null,
      priority:              input.priority,
      globalUsageLimit:      input.globalUsageLimit ?? null,
      usageLimitPerCustomer: input.usageLimitPerCustomer ?? null,
      conditions:            input.conditions,
      eligibility:           input.eligibility,
      combinationRules:      input.combinationRules,
    })
    .returning();

  revalidatePath("/admin/discounts");
  return { ok: true, data: row };
}

export async function updateDiscount(id: string, input: Partial<DiscountFormInput>) {
  await requireAdmin();

  const code = input.code !== undefined
    ? (input.code ? input.code.trim().toUpperCase() : null)
    : undefined;

  await db
    .update(discounts)
    .set({
      ...(input.title !== undefined         && { title: input.title }),
      ...(input.internalName !== undefined   && { internalName: input.internalName }),
      ...(code !== undefined                 && { code }),
      ...(input.method !== undefined         && { method: input.method }),
      ...(input.type !== undefined           && { type: input.type }),
      ...(input.target !== undefined         && { target: input.target }),
      ...(input.value !== undefined          && { value: input.value }),
      ...(input.status !== undefined         && { status: input.status }),
      ...(input.startsAt !== undefined       && { startsAt: new Date(input.startsAt) }),
      ...(input.endsAt !== undefined         && { endsAt: input.endsAt ? new Date(input.endsAt) : null }),
      ...(input.priority !== undefined       && { priority: input.priority }),
      ...(input.globalUsageLimit !== undefined && { globalUsageLimit: input.globalUsageLimit ?? null }),
      ...(input.usageLimitPerCustomer !== undefined && { usageLimitPerCustomer: input.usageLimitPerCustomer ?? null }),
      ...(input.conditions !== undefined      && { conditions: input.conditions }),
      ...(input.eligibility !== undefined     && { eligibility: input.eligibility }),
      ...(input.combinationRules !== undefined && { combinationRules: input.combinationRules }),
      updatedAt: new Date(),
    })
    .where(eq(discounts.id, id));

  revalidatePath("/admin/discounts");
  revalidatePath(`/admin/discounts/${id}`);
  return { ok: true };
}

export async function deleteDiscount(id: string) {
  await requireAdmin();
  await db.delete(discounts).where(eq(discounts.id, id));
  revalidatePath("/admin/discounts");
  return { ok: true };
}

// ─── Cart: apply / remove discount code ──────────────────────────────────────

export async function applyDiscountCode(code: string): Promise<
  { ok: true; discountCents: number; discountTitle: string } |
  { ok: false; error: string; reason?: string }
> {
  const jar = await cookies();
  const orderId = jar.get("ms_draft_order")?.value;
  if (!orderId) return { ok: false, error: "Panier introuvable." };

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "draft")))
    .limit(1);

  if (!order) return { ok: false, error: "Panier introuvable." };

  const customerId = await getCurrentUserId();
  const shippingCents = 490; // default before checkout

  const result = await calculateDiscounts({
    cart: {
      orderId,
      subtotalCents: order.subtotalCents,
      itemCount: 0,
      shippingCents,
    },
    customerId,
    manualCodes: [code],
  });

  if (result.rejectedDiscounts.length > 0 && result.appliedDiscounts.length === 0) {
    const first = result.rejectedDiscounts[0]!;
    return { ok: false, error: first.message, reason: first.reason };
  }

  const applied = result.appliedDiscounts[0];
  if (!applied) return { ok: false, error: "Ce code promo n'est pas applicable à votre panier." };

  const discountCents = result.totalDiscountCents;
  const newTotal = Math.max(0, order.subtotalCents - discountCents) + (order.taxAmountCents ?? 0) + (order.shippingCents ?? 0);

  const snapshots: AppliedDiscountSnapshot[] = result.appliedDiscounts.map((d) => {
    const snap: AppliedDiscountSnapshot = { discountId: d.discountId, title: d.title, type: d.type, amountCents: d.amountCents };
    if (d.code) snap.code = d.code;
    return snap;
  });

  await db
    .update(orders)
    .set({
      discountCents,
      discountCode: code.trim().toUpperCase(),
      appliedDiscounts: snapshots,
      totalCents: newTotal,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return { ok: true, discountCents, discountTitle: applied.title };
}

export async function removeDiscountCode(): Promise<{ ok: true }> {
  const jar = await cookies();
  const orderId = jar.get("ms_draft_order")?.value;
  if (!orderId) return { ok: true };

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "draft")))
    .limit(1);

  if (!order) return { ok: true };

  const newTotal = order.subtotalCents + (order.taxAmountCents ?? 0) + (order.shippingCents ?? 0);

  await db
    .update(orders)
    .set({
      discountCents: 0,
      discountCode: null,
      appliedDiscounts: [],
      totalCents: newTotal,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return { ok: true };
}

// ─── Record discount usage (called after payment confirmed) ──────────────────

export async function recordDiscountUsages(
  orderId: string,
  customerId: string | null,
): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !order.appliedDiscounts || order.appliedDiscounts.length === 0) return;

  const snapshots = order.appliedDiscounts as AppliedDiscountSnapshot[];

  for (const snap of snapshots) {
    await db.insert(discountUsages).values({
      discountId:    snap.discountId,
      customerId:    customerId ?? null,
      orderId,
      code:          snap.code ?? null,
      discountCents: snap.amountCents,
    });

    // Increment usage count
    const [current] = await db
      .select({ usageCount: discounts.usageCount })
      .from(discounts)
      .where(eq(discounts.id, snap.discountId))
      .limit(1);

    if (current) {
      await db
        .update(discounts)
        .set({ usageCount: current.usageCount + 1, updatedAt: new Date() })
        .where(eq(discounts.id, snap.discountId));
    }
  }
}
