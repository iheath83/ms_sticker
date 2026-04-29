import type { DiscountRow, CartSummary, RejectedDiscount } from "./discount-types";
import { db } from "@/db";
import { discountUsages } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface ValidationResult {
  valid: true;
  discount: DiscountRow;
}
export interface ValidationFailure {
  valid: false;
  rejection: RejectedDiscount;
}

export async function validateDiscount(
  discount: DiscountRow,
  cart: CartSummary,
  customerId: string | null | undefined,
  now: Date,
): Promise<ValidationResult | ValidationFailure> {
  const reject = (reason: RejectedDiscount["reason"], message: string): ValidationFailure => {
    const rejection: RejectedDiscount = { reason, message };
    rejection.discountId = discount.id;
    if (discount.code) rejection.code = discount.code;
    return { valid: false, rejection };
  };

  // Status check
  if (discount.status === "DISABLED") return reject("DISABLED", "Ce code promo est désactivé.");
  if (discount.status === "DRAFT")    return reject("DISABLED", "Ce code promo n'est pas encore actif.");

  // Date check
  if (now < new Date(discount.startsAt)) {
    return reject("NOT_STARTED", "Ce code promo n'est pas encore actif.");
  }
  if (discount.endsAt && now > new Date(discount.endsAt)) {
    return reject("EXPIRED", "Ce code promo a expiré.");
  }

  // Global usage limit
  if (discount.globalUsageLimit != null && discount.usageCount >= discount.globalUsageLimit) {
    return reject("USAGE_LIMIT_REACHED", "Ce code promo a atteint sa limite d'utilisation.");
  }

  // Per-customer usage limit
  if (customerId && discount.usageLimitPerCustomer != null) {
    const usages = await db
      .select({ id: discountUsages.id })
      .from(discountUsages)
      .where(and(
        eq(discountUsages.discountId, discount.id),
        eq(discountUsages.customerId, customerId),
      ));
    if (usages.length >= discount.usageLimitPerCustomer) {
      return reject("CUSTOMER_USAGE_LIMIT_REACHED", "Vous avez déjà utilisé ce code promo.");
    }
  }

  // Minimum subtotal
  const cond = discount.conditions;
  if (cond.minimumSubtotal != null && cart.subtotalCents < cond.minimumSubtotal) {
    const min = (cond.minimumSubtotal / 100).toFixed(2);
    return reject(
      "MINIMUM_SUBTOTAL_NOT_REACHED",
      `Le montant minimum requis est ${min} €.`,
    );
  }

  // Minimum quantity
  if (cond.minimumQuantity != null && cart.itemCount < cond.minimumQuantity) {
    return reject(
      "MINIMUM_QUANTITY_NOT_REACHED",
      `Minimum ${cond.minimumQuantity} article(s) requis.`,
    );
  }

  return { valid: true, discount };
}
