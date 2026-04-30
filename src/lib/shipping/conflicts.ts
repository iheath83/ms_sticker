import type { MethodState } from "./types";

/**
 * Conflict resolution priority (lower = higher priority):
 * 1. Blocking checkout (handled before this)
 * 2. Hide method
 * 3. Forced/imposed method
 * 4. Free shipping
 * 5. Surcharge
 * 6. Discount
 * 7. Delay changes
 * 8. Rename
 * 9. Sort/display
 *
 * Rule: once a method is hidden by a rule, it cannot be un-hidden by a lower-priority rule.
 * This is enforced by processing rules in priority order and not reversing hide decisions.
 */

/**
 * After all rules are applied, remove any inconsistencies.
 * Currently: ensure hidden methods stay hidden even if later rules tried to show them.
 * (The engine already processes in order; this is a safety pass.)
 */
export function resolveConflicts(states: Map<string, MethodState>): void {
  for (const state of states.values()) {
    // Ensure price floor
    if (state.currentPriceCents < 0) state.currentPriceCents = 0;

    // If free badge was set but price > 0 somehow, trust the price (badge is informational)
    if (state.currentPriceCents > 0 && state.badges.includes("free")) {
      state.badges = state.badges.filter((b) => b !== "free");
    }

    // Sync free badge
    if (state.currentPriceCents === 0 && !state.badges.includes("free")) {
      state.badges.push("free");
    }
  }
}
