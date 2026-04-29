import { db } from "@/db";
import { discounts } from "@/db/schema";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";
import type {
  DiscountRow,
  CartSummary,
  CalculateDiscountsInput,
  CalculateDiscountsResult,
  AppliedDiscount,
  RejectedDiscount,
} from "./discount-types";
import { validateDiscount } from "./discount-validation";
import { computeDiscountAmount } from "./discount-calculation";

// ─── DB queries ───────────────────────────────────────────────────────────────

async function getActiveAutomaticDiscounts(now: Date): Promise<DiscountRow[]> {
  return db
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.method, "AUTOMATIC"),
        eq(discounts.status, "ACTIVE"),
        lte(discounts.startsAt, now),
        or(isNull(discounts.endsAt), gte(discounts.endsAt, now)),
      ),
    ) as Promise<DiscountRow[]>;
}

async function getDiscountsByCode(codes: string[]): Promise<DiscountRow[]> {
  if (codes.length === 0) return [];
  const normalised = codes.map((c) => c.trim().toUpperCase());
  const rows = await db
    .select()
    .from(discounts)
    .where(eq(discounts.method, "CODE"));
  return rows.filter(
    (r) => r.code && normalised.includes(r.code.toUpperCase()),
  ) as DiscountRow[];
}

// ─── Combination resolution ───────────────────────────────────────────────────

function resolveDiscountCombinations(eligible: AppliedDiscount[]): AppliedDiscount[] {
  if (eligible.length <= 1) return eligible;

  const orderDiscounts  = eligible.filter((d) => d.target !== "SHIPPING");
  const shippingDiscounts = eligible.filter((d) => d.target === "SHIPPING");

  const bestOrder  = orderDiscounts.reduce<AppliedDiscount | null>(
    (best, d) => (!best || d.amountCents > best.amountCents ? d : best),
    null,
  );
  const bestShipping = shippingDiscounts.reduce<AppliedDiscount | null>(
    (best, d) => (!best || d.amountCents > best.amountCents ? d : best),
    null,
  );

  return [bestOrder, bestShipping].filter((d): d is AppliedDiscount => d !== null);
}

// ─── Main engine function ─────────────────────────────────────────────────────

export async function calculateDiscounts(
  input: CalculateDiscountsInput,
): Promise<CalculateDiscountsResult> {
  const { cart, customerId, manualCodes = [], now = new Date() } = input;

  const [automaticDiscounts, codeDiscounts] = await Promise.all([
    getActiveAutomaticDiscounts(now),
    getDiscountsByCode(manualCodes),
  ]);

  // Avoid duplicates if a code was also set as automatic
  const seen = new Set<string>();
  const candidates: DiscountRow[] = [];
  for (const d of [...automaticDiscounts, ...codeDiscounts]) {
    if (!seen.has(d.id)) { seen.add(d.id); candidates.push(d); }
  }

  // Handle codes not found
  const foundCodes = new Set(codeDiscounts.map((d) => d.code?.toUpperCase()));
  const rejectedDiscounts: RejectedDiscount[] = manualCodes
    .filter((c) => !foundCodes.has(c.trim().toUpperCase()))
    .map((c) => ({ code: c, reason: "NOT_FOUND" as const, message: "Ce code promo n'existe pas." }));

  const eligibleDiscounts: AppliedDiscount[] = [];

  for (const discount of candidates) {
    const result = await validateDiscount(discount, cart, customerId, now);
    if (!result.valid) {
      rejectedDiscounts.push(result.rejection);
      continue;
    }
    eligibleDiscounts.push(computeDiscountAmount(discount, cart));
  }

  const resolved = resolveDiscountCombinations(eligibleDiscounts);

  const orderDiscountCents   = resolved.filter((d) => d.target !== "SHIPPING").reduce((s, d) => s + d.amountCents, 0);
  const shippingDiscountCents = resolved.filter((d) => d.target === "SHIPPING").reduce((s, d) => s + d.amountCents, 0);
  const totalDiscountCents   = orderDiscountCents + shippingDiscountCents;

  return {
    subtotalBeforeDiscountCents: cart.subtotalCents,
    orderDiscountCents,
    shippingDiscountCents,
    totalDiscountCents,
    appliedDiscounts: resolved,
    rejectedDiscounts,
  };
}
