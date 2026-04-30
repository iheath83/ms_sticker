import { db } from "@/db";
import { shippingMethods, shippingZones, shippingZonePostalRules, shippingRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import type {
  ShippingQuoteContext,
  ShippingQuoteResult,
  ShippingMethodDB,
  ShippingZoneDB,
  ShippingRuleDB,
  ShippingMethodResult,
  HiddenMethodResult,
  MethodState,
  ShippingDebugLog,
  ConditionDebug,
  ShippingCartItem,
} from "./types";
import { evaluateConditionGroup } from "./conditions";
import { applyAction } from "./actions";
import { applyPricingConstraints, centsToEuros } from "./pricing";
import { resolveConflicts } from "./conflicts";
import { createDebugLog } from "./debug";

// ─── DB loaders ───────────────────────────────────────────────────────────────

async function loadActiveMethods(): Promise<ShippingMethodDB[]> {
  const rows = await db
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.isActive, true))
    .orderBy(shippingMethods.displayOrder);

  return rows.map((r) => ({
    ...r,
    description: r.description ?? null,
    minDeliveryDays: r.minDeliveryDays ?? null,
    maxDeliveryDays: r.maxDeliveryDays ?? null,
    carrierCode: r.carrierCode ?? null,
    carrierServiceCode: r.carrierServiceCode ?? null,
  }));
}

async function loadActiveZones(): Promise<ShippingZoneDB[]> {
  const zones = await db.select().from(shippingZones).where(eq(shippingZones.isActive, true));
  const postalRuleRows = await db.select().from(shippingZonePostalRules);

  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    description: z.description ?? null,
    countries: (z.countries as string[]) ?? [],
    regions: (z.regions as string[]) ?? [],
    cities: (z.cities as string[]) ?? [],
    geoRadius: (z.geoRadius ?? null) as ShippingZoneDB["geoRadius"],
    isActive: z.isActive,
    postalRules: postalRuleRows
      .filter((r) => r.zoneId === z.id)
      .map((r) => {
        const rule = {
          id: r.id,
          type: r.type as "exact" | "prefix" | "range" | "regex" | "exclude",
          value: r.value,
        };
        if (r.fromValue !== null) Object.assign(rule, { fromValue: r.fromValue });
        if (r.toValue !== null) Object.assign(rule, { toValue: r.toValue });
        return rule;
      }),
  })) as ShippingZoneDB[];
}

async function loadActiveRules(): Promise<ShippingRuleDB[]> {
  const rows = await db
    .select()
    .from(shippingRules)
    .where(eq(shippingRules.isActive, true))
    .orderBy(shippingRules.priority);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    isActive: r.isActive,
    priority: r.priority,
    startsAt: r.startsAt ?? null,
    endsAt: r.endsAt ?? null,
    conditionRoot: r.conditionRoot as ShippingRuleDB["conditionRoot"],
    actions: (r.actions as ShippingRuleDB["actions"]) ?? [],
    stopProcessingAfterMatch: r.stopProcessingAfterMatch,
    combinableWithOtherRules: r.combinableWithOtherRules,
  }));
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export async function computeShippingQuote(
  ctx: ShippingQuoteContext,
  opts: { debug?: boolean } = {},
): Promise<ShippingQuoteResult> {
  const debugLogs: ShippingDebugLog[] = [];
  const errors: string[] = [];

  // Step 1: Load active shipping methods
  let methods: ShippingMethodDB[];
  let rules: ShippingRuleDB[];
  try {
    [methods, rules] = await Promise.all([loadActiveMethods(), loadActiveRules()]);
  } catch (e) {
    errors.push("Erreur lors du chargement des méthodes de livraison.");
    return { currency: ctx.cart.currency, methods: [], hiddenMethods: [], errors };
  }

  if (methods.length === 0) {
    errors.push("Aucune méthode de livraison active.");
    return { currency: ctx.cart.currency, methods: [], hiddenMethods: [], errors };
  }

  // Step 2: Initialize method states
  const states = new Map<string, MethodState>();
  for (const m of methods) {
    states.set(m.id, {
      method: m,
      hidden: false,
      blocked: false,
      currentPriceCents: m.basePriceCents,
      originalPriceCents: m.basePriceCents,
      badges: [],
      appliedRuleNames: [],
      minDeliveryDays: m.minDeliveryDays,
      maxDeliveryDays: m.maxDeliveryDays,
      isForced: false,
    });
  }

  // Step 3: Apply active rules in priority order
  let blockResult: { blocked: true; reason: string; message: string } | null = null;
  const stoppedAfterMatch = new Set<string>();

  for (const rule of rules) {
    // Check rule validity window
    const now = ctx.now;
    if (rule.startsAt && now < rule.startsAt) continue;
    if (rule.endsAt && now > rule.endsAt) continue;

    const conditionDebug: ConditionDebug[] = [];
    const matched = evaluateConditionGroup(ctx, rule.conditionRoot, opts.debug ? conditionDebug : undefined);

    const appliedActionTypes: string[] = [];

    if (matched) {
      for (const action of rule.actions) {
        // Skip already-stopped rules for non-combinable processing
        const result = applyAction(action, states, rule.name);
        appliedActionTypes.push(action.type);
        if (result.blocked) {
          blockResult = { blocked: true, reason: result.blockReason ?? rule.name, message: result.blockMessage ?? "" };
          break;
        }
      }

      if (rule.stopProcessingAfterMatch) {
        stoppedAfterMatch.add(rule.id);
        if (opts.debug) {
          debugLogs.push(createDebugLog(rule.id, rule.name, matched, conditionDebug, appliedActionTypes));
        }
        break;
      }
    }

    if (opts.debug) {
      debugLogs.push(createDebugLog(rule.id, rule.name, matched, conditionDebug, appliedActionTypes));
    }

    if (blockResult) break;
  }

  // If checkout is blocked, return early
  if (blockResult) {
    const blocked = blockResult;
    const result: ShippingQuoteResult = {
      currency: ctx.cart.currency,
      methods: [],
      hiddenMethods: Array.from(states.values()).map((s) => ({
        id: s.method.id,
        name: s.method.publicName,
        reason: blocked.message,
      })),
      errors: [],
      blocked: blocked,
    };
    if (opts.debug) result.debug = debugLogs;
    return result;
  }

  // Step 4: Resolve conflicts and apply pricing constraints
  resolveConflicts(states);

  for (const state of states.values()) {
    applyPricingConstraints(state);
  }

  // Step 5: Separate visible and hidden methods
  const visibleMethods: ShippingMethodResult[] = [];
  const hiddenMethods: HiddenMethodResult[] = [];

  for (const state of states.values()) {
    if (state.hidden) {
      hiddenMethods.push({
        id: state.method.id,
        name: state.method.publicName,
        reason: state.hiddenReason ?? "Masqué",
      });
      continue;
    }

    const discountAmount = state.originalPriceCents - state.currentPriceCents;
    const result: ShippingMethodResult = {
      id: state.method.id,
      name: state.overriddenName ?? state.method.name,
      publicName: state.overriddenName ?? state.method.publicName,
      description: state.method.description,
      type: state.method.type,
      price: centsToEuros(state.currentPriceCents),
      originalPrice: centsToEuros(state.originalPriceCents),
      discountAmount: centsToEuros(Math.max(0, discountAmount)),
      isFree: state.currentPriceCents === 0,
      isRecommended: state.badges.includes("recommended"),
      minDeliveryDays: state.minDeliveryDays,
      maxDeliveryDays: state.maxDeliveryDays,
      badges: state.badges,
      appliedRules: state.appliedRuleNames,
      supportsDeliveryDate: state.method.supportsDeliveryDate,
      supportsTimeSlot: state.method.supportsTimeSlot,
      supportsRelayPoint: state.method.supportsRelayPoint,
    };

    visibleMethods.push(result);
  }

  // Step 6: Sort by display order (from DB), then by price
  visibleMethods.sort((a, b) => {
    const sA = states.get(a.id);
    const sB = states.get(b.id);
    const orderA = sA?.method.displayOrder ?? 999;
    const orderB = sB?.method.displayOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return (sA?.currentPriceCents ?? 0) - (sB?.currentPriceCents ?? 0);
  });

  const finalResult: ShippingQuoteResult = {
    currency: ctx.cart.currency,
    methods: visibleMethods,
    hiddenMethods,
    errors,
  };
  if (opts.debug) finalResult.debug = debugLogs;
  return finalResult;
}

/**
 * Build a ShippingQuoteContext from raw order data (used in submitOrder).
 */
export function buildContextFromOrder(params: {
  subtotalCents: number;
  totalDiscountCents: number;
  items: Array<{
    productId: string;
    variantId?: string | null;
    sku?: string | null;
    name: string;
    quantity: number;
    lineTotalCents: number;
    weightGrams?: number | null;
  }>;
  destination: {
    country: string;
    postalCode?: string | null;
    city?: string | null;
    region?: string | null;
    addressLine1?: string | null;
  };
  customer?: {
    id?: string;
    email?: string;
    isB2B?: boolean;
    orderCount?: number;
  } | null;
  couponCode?: string | null;
  currency?: string;
}): ShippingQuoteContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    cart: {
      currency: params.currency ?? "EUR",
      subtotal: params.subtotalCents / 100,
      totalDiscount: params.totalDiscountCents / 100,
      totalQuantity: params.items.reduce((acc, i) => acc + i.quantity, 0),
      totalWeight: params.items.reduce((acc, i) => acc + (i.weightGrams ?? 0) / 1000, 0),
      couponCodes: params.couponCode ? [params.couponCode] : [],
      items: params.items.map((i) => {
        const item: ShippingCartItem = {
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.lineTotalCents / 100 / i.quantity,
          requiresShipping: true,
        };
        if (i.variantId) item.variantId = i.variantId;
        if (i.sku) item.sku = i.sku;
        if (i.weightGrams) item.weight = i.weightGrams / 1000;
        return item;
      }),
    },
    destination: {
      country: params.destination.country,
      ...(params.destination.postalCode ? { postalCode: params.destination.postalCode } : {}),
      ...(params.destination.city ? { city: params.destination.city } : {}),
      ...(params.destination.region ? { region: params.destination.region } : {}),
      ...(params.destination.addressLine1 ? { addressLine1: params.destination.addressLine1 } : {}),
    },
    ...(params.customer ? {
      customer: {
        ...(params.customer.id ? { id: params.customer.id } : {}),
        ...(params.customer.email ? { email: params.customer.email } : {}),
        ...(params.customer.isB2B !== undefined ? { isB2B: params.customer.isB2B } : {}),
        ...(params.customer.orderCount !== undefined ? { orderCount: params.customer.orderCount } : {}),
      },
    } : {}),
    now: new Date(),
  } as ShippingQuoteContext;
}
