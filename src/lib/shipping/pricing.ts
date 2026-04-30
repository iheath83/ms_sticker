import type { MethodState } from "./types";

/**
 * Apply final min/max constraints and round to cents.
 */
export function applyPricingConstraints(state: MethodState): void {
  state.currentPriceCents = Math.max(0, Math.round(state.currentPriceCents));
}

/**
 * Convert cents to euros (2 decimal places).
 */
export function centsToEuros(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Convert euros to cents.
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}
