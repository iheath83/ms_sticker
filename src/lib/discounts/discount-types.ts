// ─── Core enums ───────────────────────────────────────────────────────────────

export type DiscountMethod = "CODE" | "AUTOMATIC";
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
export type DiscountTarget = "ORDER" | "SHIPPING";
export type DiscountStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SCHEDULED"
  | "EXPIRED"
  | "DISABLED"
  | "USAGE_LIMIT_REACHED";

export type RejectionReason =
  | "NOT_FOUND"
  | "DISABLED"
  | "EXPIRED"
  | "NOT_STARTED"
  | "MINIMUM_SUBTOTAL_NOT_REACHED"
  | "MINIMUM_QUANTITY_NOT_REACHED"
  | "CUSTOMER_NOT_ELIGIBLE"
  | "PRODUCTS_NOT_ELIGIBLE"
  | "USAGE_LIMIT_REACHED"
  | "CUSTOMER_USAGE_LIMIT_REACHED"
  | "NOT_COMBINABLE";

// ─── DB-stored JSON blobs ──────────────────────────────────────────────────────

export interface DiscountConditions {
  minimumSubtotal?: number;    // in cents
  minimumQuantity?: number;    // item count
}

export type CustomerEligibility = "ALL" | "LOGGED_IN" | "SPECIFIC_CUSTOMERS";

export interface DiscountEligibility {
  customerEligibility: CustomerEligibility;
  customerIds?: string[];      // only when customerEligibility === "SPECIFIC_CUSTOMERS"
}

export interface DiscountCombinationRules {
  combinableWithOrderDiscounts: boolean;
  combinableWithOtherCodes: boolean;
  combinableWithShippingDiscounts: boolean;
  combinableWithAutomaticDiscounts: boolean;
}

// ─── Discount domain object (mirrors DB row) ──────────────────────────────────

export interface DiscountRow {
  id: string;
  title: string;
  internalName: string | null;
  code: string | null;
  method: string;
  type: string;
  target: string;
  value: number | null;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  priority: number;
  usageCount: number;
  globalUsageLimit: number | null;
  usageLimitPerCustomer: number | null;
  conditions: DiscountConditions;
  eligibility: DiscountEligibility;
  combinationRules: DiscountCombinationRules;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Engine input/output ──────────────────────────────────────────────────────

export interface CartSummary {
  orderId: string;
  subtotalCents: number;
  itemCount: number;
  shippingCents: number;
}

export interface CalculateDiscountsInput {
  cart: CartSummary;
  customerId?: string | null;
  manualCodes?: string[];
  now?: Date;
}

export interface AppliedDiscount {
  discountId: string;
  title: string;
  code?: string;
  type: string;
  target: string;
  amountCents: number;
}

export interface RejectedDiscount {
  code?: string;
  discountId?: string;
  reason: RejectionReason;
  message: string;
}

export interface CalculateDiscountsResult {
  subtotalBeforeDiscountCents: number;
  orderDiscountCents: number;
  shippingDiscountCents: number;
  totalDiscountCents: number;
  appliedDiscounts: AppliedDiscount[];
  rejectedDiscounts: RejectedDiscount[];
}

// ─── Snapshot stored in orders.applied_discounts ──────────────────────────────

export interface AppliedDiscountSnapshot {
  discountId: string;
  title: string;
  code?: string;
  type: string;
  amountCents: number;
}

// ─── Admin form input ──────────────────────────────────────────────────────────

export interface DiscountFormInput {
  title: string;
  internalName?: string;
  code?: string;
  method: DiscountMethod;
  type: DiscountType;
  target: DiscountTarget;
  value?: number;
  status: DiscountStatus;
  startsAt: string;          // ISO string from form input
  endsAt?: string;
  priority: number;
  globalUsageLimit?: number;
  usageLimitPerCustomer?: number;
  conditions: DiscountConditions;
  eligibility: DiscountEligibility;
  combinationRules: DiscountCombinationRules;
}
