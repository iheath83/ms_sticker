import { describe, it, expect } from "vitest";
import {
  validateTransition,
  nextStatuses,
  isOrderStatus,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  type OrderStatus,
} from "./order-state";

// ─── validateTransition — valid paths ────────────────────────────────────────

describe("validateTransition — allowed transitions", () => {
  it("draft → proof_pending emits order.submitted", () => {
    const r = validateTransition("draft", "proof_pending");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("order.submitted");
  });

  it("proof_pending → proof_sent emits proof.uploaded", () => {
    const r = validateTransition("proof_pending", "proof_sent");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("proof.uploaded");
  });

  it("proof_sent → approved emits proof.approved", () => {
    const r = validateTransition("proof_sent", "approved");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("proof.approved");
  });

  it("proof_sent → proof_revision_requested emits proof.revision_requested", () => {
    const r = validateTransition("proof_sent", "proof_revision_requested");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("proof.revision_requested");
  });

  it("proof_revision_requested → proof_sent emits proof.uploaded", () => {
    const r = validateTransition("proof_revision_requested", "proof_sent");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("proof.uploaded");
  });

  it("approved → paid emits payment.received", () => {
    const r = validateTransition("approved", "paid");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("payment.received");
  });

  it("paid → in_production emits production.started", () => {
    const r = validateTransition("paid", "in_production");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("production.started");
  });

  it("in_production → shipped emits order.shipped", () => {
    const r = validateTransition("in_production", "shipped");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("order.shipped");
  });

  it("shipped → delivered emits order.delivered", () => {
    const r = validateTransition("shipped", "delivered");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("order.delivered");
  });

  it("draft → cancelled emits order.cancelled", () => {
    const r = validateTransition("draft", "cancelled");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("order.cancelled");
  });

  it("proof_sent → cancelled emits order.cancelled", () => {
    const r = validateTransition("proof_sent", "cancelled");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.eventType).toBe("order.cancelled");
  });
});

// ─── validateTransition — invalid paths ──────────────────────────────────────

describe("validateTransition — forbidden transitions", () => {
  it("draft → paid is not allowed", () => {
    const r = validateTransition("draft", "paid");
    expect(r.ok).toBe(false);
  });

  it("draft → shipped is not allowed", () => {
    const r = validateTransition("draft", "shipped");
    expect(r.ok).toBe(false);
  });

  it("paid → draft is not allowed (no reverse)", () => {
    const r = validateTransition("paid", "draft");
    expect(r.ok).toBe(false);
  });

  it("delivered → anything is not allowed (terminal)", () => {
    const statuses: OrderStatus[] = ["draft", "shipped", "cancelled", "paid"];
    for (const s of statuses) {
      const r = validateTransition("delivered", s);
      expect(r.ok).toBe(false);
    }
  });

  it("cancelled → anything is not allowed (terminal)", () => {
    const r = validateTransition("cancelled", "draft");
    expect(r.ok).toBe(false);
  });

  it("in_production → paid is not allowed (no backwards)", () => {
    const r = validateTransition("in_production", "paid");
    expect(r.ok).toBe(false);
  });

  it("error message contains from/to status names", () => {
    const r = validateTransition("shipped", "draft");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("shipped");
      expect(r.error).toContain("draft");
    }
  });
});

// ─── nextStatuses ─────────────────────────────────────────────────────────────

describe("nextStatuses", () => {
  it("returns possible next statuses from draft", () => {
    const nexts = nextStatuses("draft");
    expect(nexts).toContain("proof_pending");
    expect(nexts).toContain("cancelled");
  });

  it("returns empty array for terminal statuses", () => {
    expect(nextStatuses("delivered")).toHaveLength(0);
    expect(nextStatuses("cancelled")).toHaveLength(0);
  });

  it("only shipped is reachable from in_production", () => {
    expect(nextStatuses("in_production")).toEqual(["shipped"]);
  });
});

// ─── isOrderStatus ────────────────────────────────────────────────────────────

describe("isOrderStatus", () => {
  it("recognizes valid statuses", () => {
    expect(isOrderStatus("draft")).toBe(true);
    expect(isOrderStatus("paid")).toBe(true);
    expect(isOrderStatus("cancelled")).toBe(true);
    expect(isOrderStatus("delivered")).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isOrderStatus("unknown")).toBe(false);
    expect(isOrderStatus("")).toBe(false);
    expect(isOrderStatus("DRAFT")).toBe(false);
  });
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe("TERMINAL_STATUSES", () => {
  it("contains delivered and cancelled", () => {
    expect(TERMINAL_STATUSES).toContain("delivered");
    expect(TERMINAL_STATUSES).toContain("cancelled");
  });

  it("terminal statuses have no valid next transition", () => {
    for (const s of TERMINAL_STATUSES) {
      expect(nextStatuses(s)).toHaveLength(0);
    }
  });
});

describe("ACTIVE_STATUSES", () => {
  it("does not include terminal statuses", () => {
    for (const t of TERMINAL_STATUSES) {
      expect(ACTIVE_STATUSES).not.toContain(t);
    }
  });

  it("includes draft, paid, shipped", () => {
    expect(ACTIVE_STATUSES).toContain("draft");
    expect(ACTIVE_STATUSES).toContain("paid");
    expect(ACTIVE_STATUSES).toContain("shipped");
  });
});
