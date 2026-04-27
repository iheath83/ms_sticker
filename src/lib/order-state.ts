// Order status state machine
// All status transitions MUST go through this module — never update orders.status directly

export type OrderStatus =
  | "draft"
  | "proof_pending"
  | "proof_sent"
  | "proof_revision_requested"
  | "approved"
  | "paid"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

// Allowed transitions: from → Set<to>
// Flow: draft → proof_pending (submit+pay) → paid (stripe webhook)
//       → proof_sent (admin BAT) → proof_revision_requested → proof_sent
//       → approved (client) → in_production → shipped → delivered
// For non-customizable products: paid → in_production directly (skip BAT)
const TRANSITIONS: Record<OrderStatus, Set<OrderStatus>> = {
  draft:                      new Set(["proof_pending", "cancelled"]),
  proof_pending:              new Set(["paid", "cancelled"]),          // paid via Stripe webhook
  proof_sent:                 new Set(["approved", "proof_revision_requested", "cancelled"]),
  proof_revision_requested:   new Set(["proof_sent", "cancelled"]),
  approved:                   new Set(["in_production", "cancelled"]), // payment already done
  paid:                       new Set(["proof_sent", "in_production", "cancelled"]),    // proof_sent = admin uploads BAT; in_production = no customization needed
  in_production:              new Set(["shipped"]),
  shipped:                    new Set(["delivered"]),
  delivered:                  new Set([]),
  cancelled:                  new Set([]),
};

// Event types emitted for each transition
const TRANSITION_EVENTS: Partial<Record<`${OrderStatus}->${OrderStatus}`, string>> = {
  "draft->proof_pending":                   "order.submitted",
  "proof_pending->paid":                    "payment.received",
  "paid->proof_sent":                       "proof.uploaded",
  "paid->in_production":                    "production.started",
  "proof_sent->approved":                   "proof.approved",
  "proof_sent->proof_revision_requested":   "proof.revision_requested",
  "proof_revision_requested->proof_sent":   "proof.uploaded",
  "approved->in_production":                "production.started",
  "in_production->shipped":                 "order.shipped",
  "shipped->delivered":                     "order.delivered",
  "draft->cancelled":                       "order.cancelled",
  "proof_pending->cancelled":               "order.cancelled",
  "paid->cancelled":                        "order.cancelled",
  "proof_sent->cancelled":                  "order.cancelled",
  "approved->cancelled":                    "order.cancelled",
};

export type TransitionResult =
  | { ok: true; eventType: string }
  | { ok: false; error: string };

/**
 * Validate a status transition and return the event type to record.
 * Does NOT mutate any state — call this before the DB update.
 */
export function validateTransition(from: OrderStatus, to: OrderStatus): TransitionResult {
  const allowed = TRANSITIONS[from];
  if (!allowed.has(to)) {
    return {
      ok: false,
      error: `Transition '${from}' → '${to}' is not allowed.`,
    };
  }
  const key = `${from}->${to}` as `${OrderStatus}->${OrderStatus}`;
  const eventType = TRANSITION_EVENTS[key] ?? `order.status_changed.${to}`;
  return { ok: true, eventType };
}

/**
 * Returns all statuses reachable from the given status (direct next steps only).
 */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...(TRANSITIONS[from] ?? new Set())];
}

/**
 * Returns true if the given string is a valid OrderStatus.
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return value in TRANSITIONS;
}

/**
 * Terminal statuses — no further transitions possible.
 */
export const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

/**
 * Statuses that indicate the order is active (not done, not cancelled).
 */
export const ACTIVE_STATUSES: OrderStatus[] = [
  "draft",
  "proof_pending",
  "proof_sent",
  "proof_revision_requested",
  "approved",
  "paid",
  "in_production",
  "shipped",
];
