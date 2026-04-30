import { z } from "zod";

// ─── Base validators ──────────────────────────────────────────────────────────

export const shippingMethodTypeSchema = z.enum([
  "carrier", "local_delivery", "pickup", "relay_point", "custom", "freight",
]);

export const shippingMethodSchema = z.object({
  name:               z.string().min(1).max(255),
  publicName:         z.string().min(1).max(255),
  description:        z.string().max(1000).optional(),
  type:               shippingMethodTypeSchema.default("carrier"),
  isActive:           z.boolean().default(true),
  isDefault:          z.boolean().default(false),
  basePriceCents:     z.number().int().min(0),
  currency:           z.string().length(3).default("EUR"),
  minDeliveryDays:    z.number().int().min(0).nullable().optional(),
  maxDeliveryDays:    z.number().int().min(0).nullable().optional(),
  carrierCode:        z.string().max(100).nullable().optional(),
  carrierServiceCode: z.string().max(100).nullable().optional(),
  supportsTracking:   z.boolean().default(false),
  supportsRelayPoint: z.boolean().default(false),
  supportsPickup:     z.boolean().default(false),
  supportsDeliveryDate: z.boolean().default(false),
  supportsTimeSlot:   z.boolean().default(false),
  displayOrder:       z.number().int().default(0),
});

export const postalCodeRuleSchema = z.object({
  id:        z.string().optional(),
  type:      z.enum(["exact", "prefix", "range", "regex", "exclude"]),
  value:     z.string().min(1).max(255),
  fromValue: z.string().max(255).optional(),
  toValue:   z.string().max(255).optional(),
});

export const geoRadiusSchema = z.object({
  enabled:   z.boolean(),
  originLat: z.number(),
  originLng: z.number(),
  radiusKm:  z.number().positive(),
});

export const shippingZoneSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  countries:   z.array(z.string().length(2)).default([]),
  regions:     z.array(z.string()).default([]),
  cities:      z.array(z.string()).default([]),
  geoRadius:   geoRadiusSchema.nullable().optional(),
  isActive:    z.boolean().default(true),
  postalRules: z.array(postalCodeRuleSchema).default([]),
});

// ─── Rule condition validators ────────────────────────────────────────────────

export const shippingRuleOperatorSchema = z.enum([
  "equals", "not_equals", "contains", "not_contains", "in", "not_in",
  "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal",
  "between", "starts_with", "ends_with", "matches_regex", "is_true", "is_false",
]);

export const shippingRuleConditionSchema = z.object({
  id:       z.string(),
  field:    z.string(),
  operator: shippingRuleOperatorSchema,
  value:    z.unknown(),
});

export const shippingConditionGroupSchema: z.ZodType<{
  id: string;
  logic: "AND" | "OR";
  conditions: z.infer<typeof shippingRuleConditionSchema>[];
  groups?: unknown[] | undefined;
}> = z.object({
  id:         z.string(),
  logic:      z.enum(["AND", "OR"]),
  conditions: z.array(shippingRuleConditionSchema),
  groups:     z.array(z.lazy(() => shippingConditionGroupSchema)).optional(),
}) as z.ZodType<{ id: string; logic: "AND" | "OR"; conditions: z.infer<typeof shippingRuleConditionSchema>[]; groups?: unknown[] | undefined }>;

export const shippingRuleActionSchema = z.object({
  id:              z.string(),
  type:            z.string(),
  targetMethodIds: z.array(z.string()).optional(),
  value:           z.unknown().optional(),
  label:           z.string().optional(),
});

export const shippingRuleSchema = z.object({
  name:                     z.string().min(2).max(255),
  description:              z.string().max(1000).optional(),
  isActive:                 z.boolean().default(true),
  priority:                 z.number().int().min(1).default(100),
  startsAt:                 z.string().datetime().nullable().optional(),
  endsAt:                   z.string().datetime().nullable().optional(),
  conditionRoot:            shippingConditionGroupSchema,
  actions:                  z.array(shippingRuleActionSchema).min(1),
  stopProcessingAfterMatch: z.boolean().default(false),
  combinableWithOtherRules: z.boolean().default(true),
});

// ─── Quote context validator ──────────────────────────────────────────────────

export const shippingCartItemSchema = z.object({
  productId:       z.string(),
  variantId:       z.string().optional(),
  sku:             z.string().optional(),
  name:            z.string(),
  quantity:        z.number().int().min(1),
  unitPrice:       z.number().min(0),
  weight:          z.number().min(0).optional(),
  productTags:     z.array(z.string()).optional(),
  categories:      z.array(z.string()).optional(),
  collections:     z.array(z.string()).optional(),
  requiresShipping: z.boolean().default(true),
  isDigital:       z.boolean().optional(),
  isFragile:       z.boolean().optional(),
  isOversized:     z.boolean().optional(),
  isHazardous:     z.boolean().optional(),
  isColdChain:     z.boolean().optional(),
  isPreorder:      z.boolean().optional(),
  isCustomMade:    z.boolean().optional(),
  shippingClass:   z.string().optional(),
  vendorId:        z.string().optional(),
  warehouseId:     z.string().optional(),
});

export const shippingQuoteContextSchema = z.object({
  cart: z.object({
    id:            z.string().optional(),
    currency:      z.string().length(3).default("EUR"),
    subtotal:      z.number().min(0),
    totalDiscount: z.number().min(0).default(0),
    totalWeight:   z.number().min(0).optional(),
    totalQuantity: z.number().int().min(0),
    couponCodes:   z.array(z.string()).optional(),
    items:         z.array(shippingCartItemSchema),
  }),
  destination: z.object({
    country:      z.string().min(2).max(3),
    region:       z.string().optional(),
    city:         z.string().optional(),
    postalCode:   z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    latitude:     z.number().optional(),
    longitude:    z.number().optional(),
  }),
  customer: z.object({
    id:          z.string().optional(),
    email:       z.string().email().optional(),
    tags:        z.array(z.string()).optional(),
    group:       z.string().optional(),
    isB2B:       z.boolean().optional(),
    orderCount:  z.number().int().min(0).optional(),
    totalSpent:  z.number().min(0).optional(),
  }).optional(),
  checkout: z.object({
    requestedDeliveryDate: z.string().optional(),
    requestedTimeSlotId:   z.string().optional(),
    channel:               z.enum(["web", "pos", "admin", "api"]).optional(),
  }).optional(),
  now: z.string().datetime().optional(),
});

export type ShippingMethodInput = z.infer<typeof shippingMethodSchema>;
export type ShippingZoneInput = z.infer<typeof shippingZoneSchema>;
export type ShippingRuleInput = z.infer<typeof shippingRuleSchema>;
export type ShippingQuoteContextInput = z.infer<typeof shippingQuoteContextSchema>;
