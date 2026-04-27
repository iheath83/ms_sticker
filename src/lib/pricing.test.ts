import { describe, it, expect } from "vitest";
import { computePrice, QUANTITY_TIERS, formatEuros } from "./pricing";
import type { PricingInput } from "./pricing";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    product: { basePriceCents: 2490, material: "vinyl" },
    widthMm: 50,
    heightMm: 50,
    quantity: 50,
    shape: "rectangle",
    finish: "gloss",
    options: {},
    vatRate: 0.20,
    ...overrides,
  };
}

// ─── Quantity tiers ───────────────────────────────────────────────────────────

describe("quantity tiers", () => {
  it("has discount 0% below 50 units", () => {
    const out = computePrice(makeInput({ quantity: 1 }));
    expect(out.quantityDiscountPct).toBe(0);
  });

  it("has discount 10% at exactly 50 units", () => {
    const out = computePrice(makeInput({ quantity: 50 }));
    expect(out.quantityDiscountPct).toBe(0.10);
  });

  it("has discount 15% at 100 units", () => {
    const out = computePrice(makeInput({ quantity: 100 }));
    expect(out.quantityDiscountPct).toBe(0.15);
  });

  it("has discount 25% at 250 units", () => {
    const out = computePrice(makeInput({ quantity: 250 }));
    expect(out.quantityDiscountPct).toBe(0.25);
  });

  it("has discount 35% at 500 units", () => {
    const out = computePrice(makeInput({ quantity: 500 }));
    expect(out.quantityDiscountPct).toBe(0.35);
  });

  it("has discount 45% at 1000 units", () => {
    const out = computePrice(makeInput({ quantity: 1000 }));
    expect(out.quantityDiscountPct).toBe(0.45);
  });

  it("uses highest applicable tier for intermediate quantities", () => {
    // 300 → still in 250+ tier (25%), not yet 500
    const out = computePrice(makeInput({ quantity: 300 }));
    expect(out.quantityDiscountPct).toBe(0.25);
  });
});

// ─── Shape multiplier ─────────────────────────────────────────────────────────

describe("shape multiplier", () => {
  it("die-cut costs more than rectangle", () => {
    const rect = computePrice(makeInput({ shape: "rectangle" }));
    const dieCut = computePrice(makeInput({ shape: "die-cut" }));
    expect(dieCut.subtotalCents).toBeGreaterThan(rect.subtotalCents);
  });

  it("die-cut is ~15% more than rectangle", () => {
    const rect = computePrice(makeInput({ shape: "rectangle", quantity: 1 }));
    const dieCut = computePrice(makeInput({ shape: "die-cut", quantity: 1 }));
    const ratio = dieCut.subtotalCents / rect.subtotalCents;
    expect(ratio).toBeCloseTo(1.15, 1);
  });

  it("square and rectangle have same price", () => {
    const rect = computePrice(makeInput({ shape: "rectangle" }));
    const sq = computePrice(makeInput({ shape: "square" }));
    expect(sq.subtotalCents).toBe(rect.subtotalCents);
  });
});

// ─── Material multiplier ──────────────────────────────────────────────────────

describe("material multiplier", () => {
  it("holographic costs 30% more than vinyl", () => {
    const vinyl = computePrice(makeInput({ product: { basePriceCents: 2490, material: "vinyl" } }));
    const holo = computePrice(makeInput({ product: { basePriceCents: 2490, material: "holographic" } }));
    const ratio = holo.subtotalCents / vinyl.subtotalCents;
    expect(ratio).toBeCloseTo(1.30, 1);
  });

  it("glitter costs 25% more than vinyl", () => {
    const vinyl = computePrice(makeInput({ product: { basePriceCents: 2490, material: "vinyl" } }));
    const glitter = computePrice(makeInput({ product: { basePriceCents: 2490, material: "glitter" } }));
    const ratio = glitter.subtotalCents / vinyl.subtotalCents;
    expect(ratio).toBeCloseTo(1.25, 1);
  });

  it("kraft is cheaper than vinyl", () => {
    const vinyl = computePrice(makeInput({ product: { basePriceCents: 2490, material: "vinyl" } }));
    const kraft = computePrice(makeInput({ product: { basePriceCents: 2490, material: "kraft" } }));
    expect(kraft.subtotalCents).toBeLessThan(vinyl.subtotalCents);
  });
});

// ─── Options upcharges ────────────────────────────────────────────────────────

describe("options upcharges", () => {
  it("holographic option adds 30% surcharge on vinyl product", () => {
    const base = computePrice(makeInput());
    const withHolo = computePrice(makeInput({ options: { holographic: true } }));
    const expectedCharge = Math.ceil(base.subtotalCents * 0.30);
    expect(withHolo.optionsUpchargeCents).toBe(expectedCharge);
  });

  it("glitter option adds 25% surcharge on vinyl product", () => {
    const base = computePrice(makeInput());
    const withGlitter = computePrice(makeInput({ options: { glitter: true } }));
    const expectedCharge = Math.ceil(base.subtotalCents * 0.25);
    expect(withGlitter.optionsUpchargeCents).toBe(expectedCharge);
  });

  it("uv-laminated option adds 10% surcharge when finish is gloss", () => {
    const base = computePrice(makeInput());
    const withUv = computePrice(makeInput({ options: { uvLaminated: true } }));
    const expectedCharge = Math.ceil(base.subtotalCents * 0.10);
    expect(withUv.optionsUpchargeCents).toBe(expectedCharge);
  });

  it("uv-laminated option is NOT added when finish is already uv-laminated", () => {
    const out = computePrice(makeInput({ finish: "uv-laminated", options: { uvLaminated: true } }));
    expect(out.optionsUpchargeCents).toBe(0);
  });

  it("holographic option is NOT added when product material is holographic", () => {
    const out = computePrice(
      makeInput({
        product: { basePriceCents: 3990, material: "holographic" },
        options: { holographic: true },
      }),
    );
    expect(out.optionsUpchargeCents).toBe(0);
  });

  it("cumulates multiple options correctly", () => {
    const base = computePrice(makeInput());
    const withAll = computePrice(makeInput({ options: { glitter: true, uvLaminated: true } }));
    const expected = Math.ceil(base.subtotalCents * 0.25) + Math.ceil(base.subtotalCents * 0.10);
    expect(withAll.optionsUpchargeCents).toBe(expected);
  });
});

// ─── VAT ─────────────────────────────────────────────────────────────────────

describe("VAT", () => {
  it("applies 20% VAT by default", () => {
    const out = computePrice(makeInput());
    const preTax = out.subtotalCents + out.optionsUpchargeCents;
    expect(out.vatAmountCents).toBe(Math.ceil(preTax * 0.20));
  });

  it("totalCents = subtotal + options + VAT", () => {
    const out = computePrice(makeInput({ options: { glitter: true } }));
    expect(out.totalCents).toBe(out.subtotalCents + out.optionsUpchargeCents + out.vatAmountCents);
  });

  it("respects custom vatRate 0 (B2B reverse charge)", () => {
    const out = computePrice(makeInput({ vatRate: 0 }));
    expect(out.vatAmountCents).toBe(0);
    expect(out.totalCents).toBe(out.subtotalCents);
  });
});

// ─── Area scaling ─────────────────────────────────────────────────────────────

describe("area scaling", () => {
  it("10×10 cm sticker costs ~4x a 5×5 cm one", () => {
    const small = computePrice(makeInput({ widthMm: 50, heightMm: 50, quantity: 1 }));
    const large = computePrice(makeInput({ widthMm: 100, heightMm: 100, quantity: 1 }));
    const ratio = large.subtotalCents / small.subtotalCents;
    expect(ratio).toBeCloseTo(4, 0);
  });

  it("quantity 1 returns a non-zero price", () => {
    const out = computePrice(makeInput({ quantity: 1 }));
    expect(out.totalCents).toBeGreaterThan(0);
    expect(out.unitPriceCents).toBeGreaterThan(0);
  });
});

// ─── Output structure ─────────────────────────────────────────────────────────

describe("output structure", () => {
  it("breakdown includes at least subtotal and TVA lines", () => {
    const out = computePrice(makeInput());
    const labels = out.breakdown.map((b) => b.label);
    expect(labels.some((l) => l.includes("Sous-total"))).toBe(true);
    expect(labels.some((l) => l.includes("TVA"))).toBe(true);
  });

  it("all cent values are integers (no floats)", () => {
    const out = computePrice(makeInput({ quantity: 137, widthMm: 73, heightMm: 61 }));
    expect(Number.isInteger(out.unitPriceCents)).toBe(true);
    expect(Number.isInteger(out.subtotalCents)).toBe(true);
    expect(Number.isInteger(out.vatAmountCents)).toBe(true);
    expect(Number.isInteger(out.totalCents)).toBe(true);
  });
});

// ─── QUANTITY_TIERS export ────────────────────────────────────────────────────

describe("QUANTITY_TIERS", () => {
  it("is sorted ascending by minQty", () => {
    for (let i = 1; i < QUANTITY_TIERS.length; i++) {
      expect(QUANTITY_TIERS[i]!.minQty).toBeGreaterThan(QUANTITY_TIERS[i - 1]!.minQty);
    }
  });
});

// ─── formatEuros helper ───────────────────────────────────────────────────────

describe("formatEuros", () => {
  it("formats 2490 cents as currency string containing 24", () => {
    const str = formatEuros(2490);
    expect(str).toContain("24");
    expect(str).toContain("€");
  });
});
