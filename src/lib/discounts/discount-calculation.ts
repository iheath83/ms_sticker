import type { DiscountRow, CartSummary, AppliedDiscount } from "./discount-types";

export function computeDiscountAmount(
  discount: DiscountRow,
  cart: CartSummary,
): AppliedDiscount {
  let amountCents = 0;

  switch (discount.type) {
    case "PERCENTAGE": {
      const pct = discount.value ?? 0;
      amountCents = Math.round(cart.subtotalCents * pct / 100);
      break;
    }
    case "FIXED_AMOUNT": {
      const fixed = discount.value ?? 0;
      amountCents = Math.min(fixed, cart.subtotalCents);
      break;
    }
    case "FREE_SHIPPING": {
      amountCents = cart.shippingCents;
      break;
    }
  }

  const result: AppliedDiscount = {
    discountId: discount.id,
    title: discount.title,
    type: discount.type,
    target: discount.target,
    amountCents,
  };
  if (discount.code) result.code = discount.code;
  return result;
}
