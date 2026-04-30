import type { ShippingRuleAction, MethodState } from "./types";

/**
 * Apply a single action to all relevant method states.
 * Returns true if a checkout block was triggered.
 */
export function applyAction(
  action: ShippingRuleAction,
  states: Map<string, MethodState>,
  ruleName: string,
): { blocked: boolean; blockReason?: string; blockMessage?: string } {
  const targets = getTargetStates(action, states);

  switch (action.type) {
    // ── Display ────────────────────────────────────────────────────────────────
    case "show_method":
      for (const s of targets) {
        if (!s.hidden) continue;
        s.appliedRuleNames.push(ruleName);
      }
      break;

    case "hide_method":
      for (const s of targets) {
        if (s.hidden) continue;
        s.hidden = true;
        s.hiddenReason = String(action.value ?? `Masqué par règle: ${ruleName}`);
        s.appliedRuleNames.push(ruleName);
      }
      break;

    case "hide_all_except": {
      const allowedIds = (action.targetMethodIds ?? []);
      for (const [id, s] of states) {
        if (!allowedIds.includes(id) && !s.hidden) {
          s.hidden = true;
          s.hiddenReason = String(action.value ?? `Masqué par règle: ${ruleName}`);
          s.appliedRuleNames.push(ruleName);
        }
      }
      break;
    }

    case "rename_method":
      for (const s of targets) {
        s.overriddenName = String(action.value ?? s.method.publicName);
        s.appliedRuleNames.push(ruleName);
      }
      break;

    case "add_badge":
      for (const s of targets) {
        const badge = String(action.value ?? "");
        if (badge && !s.badges.includes(badge)) {
          s.badges.push(badge);
          s.appliedRuleNames.push(ruleName);
        }
      }
      break;

    case "set_display_order":
      // Not directly applied to MethodState here (handled at sort step)
      break;

    case "highlight_method":
      for (const s of targets) {
        if (!s.badges.includes("recommended")) {
          s.badges.push("recommended");
          s.appliedRuleNames.push(ruleName);
        }
      }
      break;

    // ── Pricing ────────────────────────────────────────────────────────────────
    case "set_free":
      for (const s of targets) {
        s.currentPriceCents = 0;
        if (!s.badges.includes("free")) s.badges.push("free");
        s.appliedRuleNames.push(ruleName);
      }
      break;

    case "set_price": {
      const price = Math.round(Number(action.value ?? 0) * 100);
      for (const s of targets) {
        s.currentPriceCents = Math.max(0, price);
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "add_fixed": {
      const amount = Math.round(Number(action.value ?? 0) * 100);
      for (const s of targets) {
        s.currentPriceCents = Math.max(0, s.currentPriceCents + amount);
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "subtract_fixed": {
      const amount = Math.round(Number(action.value ?? 0) * 100);
      for (const s of targets) {
        s.currentPriceCents = Math.max(0, s.currentPriceCents - amount);
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "add_percent": {
      const pct = Number(action.value ?? 0) / 100;
      for (const s of targets) {
        s.currentPriceCents = Math.round(s.currentPriceCents * (1 + pct));
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "subtract_percent": {
      const pct = Number(action.value ?? 0) / 100;
      for (const s of targets) {
        s.currentPriceCents = Math.max(0, Math.round(s.currentPriceCents * (1 - pct)));
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "apply_min_price": {
      const min = Math.round(Number(action.value ?? 0) * 100);
      for (const s of targets) {
        s.currentPriceCents = Math.max(s.currentPriceCents, min);
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "apply_max_price": {
      const max = Math.round(Number(action.value ?? 0) * 100);
      for (const s of targets) {
        s.currentPriceCents = Math.min(s.currentPriceCents, max);
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "price_per_kg":
    case "price_per_item":
      // These are calculated by the engine before applying rules
      break;

    // ── Delay ──────────────────────────────────────────────────────────────────
    case "set_min_days": {
      const days = Number(action.value ?? 0);
      for (const s of targets) { s.minDeliveryDays = days; s.appliedRuleNames.push(ruleName); }
      break;
    }

    case "set_max_days": {
      const days = Number(action.value ?? 0);
      for (const s of targets) { s.maxDeliveryDays = days; s.appliedRuleNames.push(ruleName); }
      break;
    }

    case "add_days": {
      const days = Number(action.value ?? 0);
      for (const s of targets) {
        if (s.minDeliveryDays !== null) s.minDeliveryDays = (s.minDeliveryDays ?? 0) + days;
        if (s.maxDeliveryDays !== null) s.maxDeliveryDays = (s.maxDeliveryDays ?? 0) + days;
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    case "subtract_days": {
      const days = Number(action.value ?? 0);
      for (const s of targets) {
        if (s.minDeliveryDays !== null) s.minDeliveryDays = Math.max(0, (s.minDeliveryDays ?? 0) - days);
        if (s.maxDeliveryDays !== null) s.maxDeliveryDays = Math.max(0, (s.maxDeliveryDays ?? 0) - days);
        s.appliedRuleNames.push(ruleName);
      }
      break;
    }

    // ── Blocking ───────────────────────────────────────────────────────────────
    case "block_checkout":
      return {
        blocked: true,
        blockReason: ruleName,
        blockMessage: String(action.value ?? "La livraison n'est pas disponible pour votre adresse ou votre panier."),
      };

    case "show_error_message":
      // Non-blocking error (treated as warning — could be surfaced to UI)
      break;
  }

  return { blocked: false };
}

function getTargetStates(action: ShippingRuleAction, states: Map<string, MethodState>): MethodState[] {
  const ids = action.targetMethodIds;
  if (!ids || ids.length === 0) {
    return Array.from(states.values());
  }
  return ids.map((id) => states.get(id)).filter(Boolean) as MethodState[];
}
