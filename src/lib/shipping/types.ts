// ─── Shipping Method ──────────────────────────────────────────────────────────

export type ShippingMethodType =
  | "carrier"
  | "local_delivery"
  | "pickup"
  | "relay_point"
  | "custom"
  | "freight";

export type ShippingMethodDB = {
  id: string;
  name: string;
  publicName: string;
  description: string | null;
  type: ShippingMethodType;
  isActive: boolean;
  isDefault: boolean;
  basePriceCents: number;
  currency: string;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  carrierCode: string | null;
  carrierServiceCode: string | null;
  supportsTracking: boolean;
  supportsRelayPoint: boolean;
  supportsPickup: boolean;
  supportsDeliveryDate: boolean;
  supportsTimeSlot: boolean;
  displayOrder: number;
};

// ─── Shipping Zone ────────────────────────────────────────────────────────────

export type PostalCodeRuleType = "exact" | "prefix" | "range" | "regex" | "exclude";

export type PostalCodeRule = {
  id: string;
  type: PostalCodeRuleType;
  value: string;
  fromValue?: string;
  toValue?: string;
};

export type GeoRadius = {
  enabled: boolean;
  originLat: number;
  originLng: number;
  radiusKm: number;
};

export type ShippingZoneDB = {
  id: string;
  name: string;
  description: string | null;
  countries: string[];
  regions: string[];
  cities: string[];
  geoRadius: GeoRadius | null;
  isActive: boolean;
  postalRules?: PostalCodeRule[];
};

// ─── Shipping Rule ────────────────────────────────────────────────────────────

export type ShippingConditionField =
  // Destination
  | "destination.country"
  | "destination.region"
  | "destination.city"
  | "destination.postalCode"
  | "destination.addressLine1"
  | "destination.latitude"
  | "destination.longitude"
  | "destination.zone"
  // Cart
  | "cart.subtotal"
  | "cart.total"
  | "cart.totalQuantity"
  | "cart.totalWeight"
  | "cart.totalDiscount"
  | "cart.uniqueProductCount"
  | "cart.hasCoupon"
  | "cart.isAllDigital"
  | "cart.hasPhysicalItem"
  // Product
  | "cart.hasProductId"
  | "cart.hasSku"
  | "cart.hasProductTag"
  | "cart.hasCategory"
  | "cart.hasCollection"
  | "cart.isFragile"
  | "cart.isOversized"
  | "cart.isHazardous"
  | "cart.isColdChain"
  | "cart.isPreorder"
  | "cart.isCustomMade"
  | "cart.hasVendorId"
  | "cart.hasWarehouseId"
  | "cart.hasShippingClass"
  // Customer
  | "customer.isLoggedIn"
  | "customer.group"
  | "customer.tag"
  | "customer.isB2B"
  | "customer.isNew"
  | "customer.orderCount"
  | "customer.totalSpent"
  | "customer.emailDomain"
  // Temporal
  | "time.dayOfWeek"
  | "time.hour"
  | "time.date"
  | "time.isWeekend"
  | "time.isHoliday"
  | "time.isAfterCutoff"
  | "time.cutoffHour"
  // Channel
  | "checkout.channel";

export type ShippingRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "between"
  | "starts_with"
  | "ends_with"
  | "matches_regex"
  | "matches_postal_rules"
  | "is_true"
  | "is_false";

export type ShippingRuleCondition = {
  id: string;
  field: ShippingConditionField;
  operator: ShippingRuleOperator;
  value: unknown;
};

export type ShippingConditionGroup = {
  id: string;
  logic: "AND" | "OR";
  conditions: ShippingRuleCondition[];
  groups?: ShippingConditionGroup[];
};

export type ShippingActionType =
  // Display
  | "show_method"
  | "hide_method"
  | "hide_all_except"
  | "rename_method"
  | "add_badge"
  | "set_display_order"
  | "highlight_method"
  // Pricing
  | "set_price"
  | "add_fixed"
  | "subtract_fixed"
  | "add_percent"
  | "subtract_percent"
  | "set_free"
  | "price_per_kg"
  | "price_per_item"
  | "apply_min_price"
  | "apply_max_price"
  // Delay
  | "set_min_days"
  | "set_max_days"
  | "add_days"
  | "subtract_days"
  // Blocking
  | "block_checkout"
  | "show_error_message";

export type ShippingBadge = "recommended" | "fast" | "cheap" | "free" | "custom";

export type ShippingRuleAction = {
  id: string;
  type: ShippingActionType;
  targetMethodIds?: string[];
  value?: unknown;
  label?: string;
};

export type ShippingRuleDB = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  conditionRoot: ShippingConditionGroup;
  actions: ShippingRuleAction[];
  stopProcessingAfterMatch: boolean;
  combinableWithOtherRules: boolean;
};

// ─── Quote Context ────────────────────────────────────────────────────────────

export type ShippingCartItem = {
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  weight?: number;
  productTags?: string[];
  categories?: string[];
  collections?: string[];
  requiresShipping: boolean;
  isDigital?: boolean;
  isFragile?: boolean;
  isOversized?: boolean;
  isHazardous?: boolean;
  isColdChain?: boolean;
  isPreorder?: boolean;
  isCustomMade?: boolean;
  shippingClass?: string;
  vendorId?: string;
  warehouseId?: string;
};

export type ShippingDestination = {
  country: string;
  region?: string;
  city?: string;
  postalCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  latitude?: number;
  longitude?: number;
};

export type ShippingCustomer = {
  id?: string;
  email?: string;
  tags?: string[];
  group?: string;
  isB2B?: boolean;
  orderCount?: number;
  totalSpent?: number;
};

export type ShippingQuoteContext = {
  cart: {
    id?: string;
    currency: string;
    subtotal: number;
    totalDiscount: number;
    totalWeight?: number;
    totalQuantity: number;
    couponCodes?: string[];
    items: ShippingCartItem[];
  };
  destination: ShippingDestination;
  customer?: ShippingCustomer;
  checkout?: {
    requestedDeliveryDate?: string;
    requestedTimeSlotId?: string;
    channel?: "web" | "pos" | "admin" | "api";
  };
  now: Date;
};

// ─── Quote Result ─────────────────────────────────────────────────────────────

export type ShippingMethodResult = {
  id: string;
  name: string;
  publicName: string;
  description: string | null;
  type: ShippingMethodType;
  price: number;
  originalPrice: number;
  discountAmount: number;
  isFree: boolean;
  isRecommended: boolean;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  badges: string[];
  appliedRules: string[];
  supportsDeliveryDate: boolean;
  supportsTimeSlot: boolean;
  supportsRelayPoint: boolean;
};

export type HiddenMethodResult = {
  id: string;
  name: string;
  reason: string;
};

export type ShippingBlockResult = {
  blocked: true;
  reason: string;
  message: string;
};

export type ShippingQuoteResult = {
  currency: string;
  methods: ShippingMethodResult[];
  hiddenMethods: HiddenMethodResult[];
  errors: string[];
  blocked?: ShippingBlockResult | undefined;
  debug?: ShippingDebugLog[] | undefined;
};

// ─── Debug ────────────────────────────────────────────────────────────────────

export type ConditionDebug = {
  field: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  matched: boolean;
};

export type ShippingDebugLog = {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  conditions: ConditionDebug[];
  actionsApplied: string[];
};

// ─── Method State (internal engine use) ──────────────────────────────────────

export type MethodState = {
  method: ShippingMethodDB;
  hidden: boolean;
  hiddenReason?: string;
  blocked: boolean;
  blockedReason?: string;
  currentPriceCents: number;
  originalPriceCents: number;
  badges: string[];
  appliedRuleNames: string[];
  overriddenName?: string;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  isForced: boolean;
};
