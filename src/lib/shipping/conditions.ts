import type {
  ShippingQuoteContext,
  ShippingRuleCondition,
  ShippingConditionGroup,
  ConditionDebug,
} from "./types";

// ─── Operator evaluation ──────────────────────────────────────────────────────

function evaluate(actual: unknown, operator: string, expected: unknown): boolean {
  const act = actual;
  const exp = expected;

  switch (operator) {
    case "is_true":  return act === true || act === 1 || act === "true";
    case "is_false": return act === false || act === 0 || act === "false";
    case "equals":   return String(act).toLowerCase() === String(exp).toLowerCase();
    case "not_equals": return String(act).toLowerCase() !== String(exp).toLowerCase();
    case "contains":   return String(act).toLowerCase().includes(String(exp).toLowerCase());
    case "not_contains": return !String(act).toLowerCase().includes(String(exp).toLowerCase());
    case "starts_with":  return String(act).toLowerCase().startsWith(String(exp).toLowerCase());
    case "ends_with":    return String(act).toLowerCase().endsWith(String(exp).toLowerCase());
    case "greater_than":            return Number(act) > Number(exp);
    case "greater_than_or_equal":   return Number(act) >= Number(exp);
    case "less_than":               return Number(act) < Number(exp);
    case "less_than_or_equal":      return Number(act) <= Number(exp);
    case "between": {
      const [min, max] = Array.isArray(exp) ? exp : [0, 0];
      return Number(act) >= Number(min) && Number(act) <= Number(max);
    }
    case "in": {
      const list = Array.isArray(exp) ? exp : [exp];
      return list.map((v) => String(v).toLowerCase()).includes(String(act).toLowerCase());
    }
    case "not_in": {
      const list = Array.isArray(exp) ? exp : [exp];
      return !list.map((v) => String(v).toLowerCase()).includes(String(act).toLowerCase());
    }
    case "matches_regex": {
      try {
        return new RegExp(String(exp)).test(String(act));
      } catch {
        return false;
      }
    }
    default: return false;
  }
}

// ─── Field resolvers ──────────────────────────────────────────────────────────

function resolveField(ctx: ShippingQuoteContext, field: string): unknown {
  const { cart, destination, customer, checkout, now } = ctx;
  const items = cart.items;

  switch (field) {
    // Destination
    case "destination.country":      return destination.country;
    case "destination.region":       return destination.region ?? "";
    case "destination.city":         return destination.city ?? "";
    case "destination.postalCode":   return destination.postalCode ?? "";
    case "destination.addressLine1": return destination.addressLine1 ?? "";
    case "destination.latitude":     return destination.latitude ?? 0;
    case "destination.longitude":    return destination.longitude ?? 0;

    // Cart numeric
    case "cart.subtotal":            return cart.subtotal;
    case "cart.total":               return cart.subtotal - cart.totalDiscount;
    case "cart.totalQuantity":       return cart.totalQuantity;
    case "cart.totalWeight":         return cart.totalWeight ?? 0;
    case "cart.totalDiscount":       return cart.totalDiscount;
    case "cart.uniqueProductCount":  return new Set(items.map((i) => i.productId)).size;
    case "cart.hasCoupon":           return (cart.couponCodes?.length ?? 0) > 0;
    case "cart.isAllDigital":        return items.length > 0 && items.every((i) => i.isDigital);
    case "cart.hasPhysicalItem":     return items.some((i) => !i.isDigital && i.requiresShipping);

    // Product presence
    case "cart.hasProductId":  return (v: unknown) => items.some((i) => i.productId === String(v));
    case "cart.hasSku":        return (v: unknown) => items.some((i) => i.sku === String(v));
    case "cart.hasProductTag": return (v: unknown) => items.some((i) => i.productTags?.includes(String(v)));
    case "cart.hasCategory":   return (v: unknown) => items.some((i) => i.categories?.includes(String(v)));
    case "cart.hasCollection": return (v: unknown) => items.some((i) => i.collections?.includes(String(v)));
    case "cart.isFragile":     return items.some((i) => i.isFragile);
    case "cart.isOversized":   return items.some((i) => i.isOversized);
    case "cart.isHazardous":   return items.some((i) => i.isHazardous);
    case "cart.isColdChain":   return items.some((i) => i.isColdChain);
    case "cart.isPreorder":    return items.some((i) => i.isPreorder);
    case "cart.isCustomMade":  return items.some((i) => i.isCustomMade);
    case "cart.hasVendorId":   return (v: unknown) => items.some((i) => i.vendorId === String(v));
    case "cart.hasWarehouseId":  return (v: unknown) => items.some((i) => i.warehouseId === String(v));
    case "cart.hasShippingClass": return (v: unknown) => items.some((i) => i.shippingClass === String(v));

    // Customer
    case "customer.isLoggedIn": return !!(customer?.id);
    case "customer.group":      return customer?.group ?? "";
    case "customer.tag":        return (v: unknown) => customer?.tags?.includes(String(v)) ?? false;
    case "customer.isB2B":      return customer?.isB2B ?? false;
    case "customer.isNew":      return (customer?.orderCount ?? 0) === 0;
    case "customer.orderCount": return customer?.orderCount ?? 0;
    case "customer.totalSpent": return customer?.totalSpent ?? 0;
    case "customer.emailDomain": {
      const email = customer?.email ?? "";
      return email.includes("@") ? email.split("@")[1] : "";
    }

    // Temporal
    case "time.dayOfWeek":  return now.getDay(); // 0=Sun, 1=Mon...
    case "time.hour":       return now.getHours();
    case "time.isWeekend":  return now.getDay() === 0 || now.getDay() === 6;
    case "time.isAfterCutoff": return (v: unknown) => now.getHours() >= Number(v);
    case "time.cutoffHour": return now.getHours();

    // Channel
    case "checkout.channel": return checkout?.channel ?? "web";

    default: return undefined;
  }
}

// ─── Single condition evaluation ──────────────────────────────────────────────

function evaluateCondition(
  ctx: ShippingQuoteContext,
  condition: ShippingRuleCondition,
): { matched: boolean; actual: unknown } {
  const rawActual = resolveField(ctx, condition.field);

  // Some fields return a function (dynamic lookup with condition value)
  if (typeof rawActual === "function") {
    const matched = rawActual(condition.value);
    return { matched: Boolean(matched), actual: `fn(${String(condition.value)})` };
  }

  const matched = evaluate(rawActual, condition.operator, condition.value);
  return { matched, actual: rawActual };
}

// ─── Group evaluation (recursive AND/OR) ─────────────────────────────────────

export function evaluateConditionGroup(
  ctx: ShippingQuoteContext,
  group: ShippingConditionGroup,
  debugLogs?: ConditionDebug[],
): boolean {
  const results: boolean[] = [];

  for (const condition of group.conditions) {
    const { matched, actual } = evaluateCondition(ctx, condition);
    debugLogs?.push({
      field:    condition.field,
      operator: condition.operator,
      expected: condition.value,
      actual,
      matched,
    });
    results.push(matched);
  }

  for (const subGroup of group.groups ?? []) {
    const subResult = evaluateConditionGroup(ctx, subGroup, debugLogs);
    results.push(subResult);
  }

  if (results.length === 0) return true;

  return group.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
}
