/**
 * Pricing engine — pure isomorphic module (server AND client safe, no DB imports).
 * All amounts are in euro cents (integer). Never store floats.
 */

// ─── Input / Output types ─────────────────────────────────────────────────────

export type PricingShape = "die-cut" | "kiss-cut" | "square" | "circle" | "rectangle";
export type PricingMaterial = "vinyl" | "holographic" | "glitter" | "transparent" | "kraft";
export type PricingFinish = "gloss" | "matte" | "uv-laminated";

export interface PricingInput {
  /** From products.basePriceCents — base price for 50 units at 5×5 cm (vinyl, rect) */
  product: { basePriceCents: number; material: PricingMaterial };
  widthMm: number;
  heightMm: number;
  quantity: number;
  shape: PricingShape;
  finish: PricingFinish;
  options: {
    holographic?: boolean;
    glitter?: boolean;
    uvLaminated?: boolean;
  };
  vatRate?: number; // default 0.20
}

export interface PricingOutput {
  unitPriceCents: number;
  quantityDiscountPct: number;
  subtotalCents: number;
  optionsUpchargeCents: number;
  vatAmountCents: number;
  totalCents: number;
  breakdown: Array<{ label: string; amountCents: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Reference area: 5 cm × 5 cm = 25 cm² */
const REFERENCE_AREA_CM2 = 25;

/** Reference quantity for basePriceCents */
const REFERENCE_QTY = 50;

/**
 * Shape surcharge relative to rectangle base.
 * die-cut requires precision cutting → +15%
 */
const SHAPE_MULTIPLIER: Record<PricingShape, number> = {
  rectangle: 1.00,
  square:    1.00,
  circle:    1.05,
  "kiss-cut": 1.10,
  "die-cut": 1.15,
};

/** Material multiplier (applied on top of base) */
const MATERIAL_MULTIPLIER: Record<PricingMaterial, number> = {
  vinyl:       1.00,
  transparent: 1.20,
  kraft:       0.90,
  glitter:     1.25,
  holographic: 1.30,
};

/** Finish upcharge (additive — applied after base × area × material × shape) */
const FINISH_UPCHARGE: Record<PricingFinish, number> = {
  gloss:          0,
  matte:          0.05, // +5%
  "uv-laminated": 0.10, // +10%
};

/** Volume discount tiers — quantity → discount percentage off unit price */
export const QUANTITY_TIERS: ReadonlyArray<{ minQty: number; discountPct: number }> = [
  { minQty: 1,    discountPct: 0 },
  { minQty: 50,   discountPct: 0.10 },
  { minQty: 100,  discountPct: 0.15 },
  { minQty: 250,  discountPct: 0.25 },
  { minQty: 500,  discountPct: 0.35 },
  { minQty: 1000, discountPct: 0.45 },
];

export type PricingTier = { minQty: number; discountPct: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round up to nearest cent — never store fractional cents */
function ceilCent(value: number): number {
  return Math.ceil(value);
}

function getQuantityDiscount(qty: number, tiers: ReadonlyArray<PricingTier> = QUANTITY_TIERS): number {
  let discount = 0;
  for (const tier of tiers) {
    if (qty >= tier.minQty) discount = tier.discountPct;
  }
  return discount;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function computePrice(
  input: PricingInput,
  customTiers?: ReadonlyArray<PricingTier>,
): PricingOutput {
  const {
    product,
    widthMm,
    heightMm,
    quantity,
    shape,
    finish,
    options,
    vatRate = 0.20,
  } = input;
  const tiers = customTiers ?? QUANTITY_TIERS;

  // 1. Area ratio vs reference (5×5 cm)
  const areaCm2 = (widthMm / 10) * (heightMm / 10);
  const areaRatio = areaCm2 / REFERENCE_AREA_CM2;

  // 2. Unit base price at reference area & quantity (50 units)
  //    basePriceCents already bakes in the product material from seed
  //    We apply shape + finish on top
  const shapeMul = SHAPE_MULTIPLIER[shape] ?? 1;
  const materialMul = MATERIAL_MULTIPLIER[product.material] ?? 1;
  const finishMul = 1 + (FINISH_UPCHARGE[finish] ?? 0);

  // Unit price at reference qty (50), scaled for area
  const unitAtRef = ceilCent(
    (product.basePriceCents / REFERENCE_QTY) * areaRatio * shapeMul * materialMul * finishMul,
  );

  // 3. Quantity discount
  const discountPct = getQuantityDiscount(quantity, tiers);
  const discountedUnit = ceilCent(unitAtRef * (1 - discountPct));

  // 4. Subtotal before options
  const subtotalCents = discountedUnit * quantity;

  // 5. Options upcharges (additive, on top of subtotal)
  let optionsUpchargeCents = 0;
  const breakdown: Array<{ label: string; amountCents: number }> = [
    { label: "Sous-total articles", amountCents: subtotalCents },
  ];

  if (options.holographic && product.material !== "holographic") {
    // Already baked into material multiplier if product is holographic
    const holoCharge = ceilCent(subtotalCents * 0.30);
    optionsUpchargeCents += holoCharge;
    breakdown.push({ label: "Option holographique (+30%)", amountCents: holoCharge });
  }

  if (options.glitter && product.material !== "glitter") {
    const glitterCharge = ceilCent(subtotalCents * 0.25);
    optionsUpchargeCents += glitterCharge;
    breakdown.push({ label: "Option pailletée (+25%)", amountCents: glitterCharge });
  }

  if (options.uvLaminated && finish !== "uv-laminated") {
    // Only if not already included in finish multiplier
    const uvCharge = ceilCent(subtotalCents * 0.10);
    optionsUpchargeCents += uvCharge;
    breakdown.push({ label: "UV laminé (+10%)", amountCents: uvCharge });
  }

  const preTaxCents = subtotalCents + optionsUpchargeCents;

  // 6. VAT
  const vatAmountCents = ceilCent(preTaxCents * vatRate);
  breakdown.push({ label: `TVA ${(vatRate * 100).toFixed(0)}%`, amountCents: vatAmountCents });

  const totalCents = preTaxCents + vatAmountCents;

  return {
    unitPriceCents: discountedUnit,
    quantityDiscountPct: discountPct,
    subtotalCents,
    optionsUpchargeCents,
    vatAmountCents,
    totalCents,
    breakdown,
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Format cents to "24,90 €" */
export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

/** Format cents to simple "24" or "24,90" */
export function formatEurosShort(cents: number): string {
  const val = cents / 100;
  return val % 1 === 0 ? String(val) : val.toFixed(2).replace(".", ",");
}

// ─── Configurator size presets ────────────────────────────────────────────────

export type PricingSize = "2x2" | "3x3" | "4x4" | "5x5" | "7x7" | "custom";

/** Size preset → [widthMm, heightMm] */
export const SIZE_MM: Record<PricingSize, [number, number]> = {
  "2x2": [20, 20],
  "3x3": [30, 30],
  "4x4": [40, 40],
  "5x5": [50, 50],
  "7x7": [70, 70],
  custom: [60, 60],
};

/** Custom preset defined per product in admin */
export interface CustomPreset {
  id: string;        // unique key, e.g. "4x6"
  label: string;     // display name, e.g. "4×6 cm"
  widthMm: number;
  heightMm: number;
}
