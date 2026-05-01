/**
 * Moteur de prix pour stickers.
 *
 * Formule:
 *   surface_cm2 = (width_mm × height_mm) / 100
 *   base = surface_cm2 × pricePerCm2 × quantity
 *   after_qty_discount = base × (1 - discountPct/100)
 *   after_material = after_qty_discount × materialMultiplier
 *   after_lamination = after_material × laminationMultiplier
 *   after_shape = after_lamination × shapeMultiplier
 *   total = after_shape + setupFee
 *   if total < minOrder → total = minOrder
 */

import type { StickerQuantityTier, StickerPriceModifierType } from "@/db/schema";

export interface StickerPriceInput {
  widthMm: number;
  heightMm: number;
  quantity: number;
  pricePerCm2Cents: number;
  quantityTiers: StickerQuantityTier[];
  setupFeeCents: number;
  minOrderCents: number;
  materialModifier: { type: StickerPriceModifierType; value: number };
  laminationModifier: { type: StickerPriceModifierType; value: number } | null;
  shapeModifier: { type: StickerPriceModifierType; value: number };
  vatRate?: number;
}

export interface StickerPriceResult {
  surfaceCm2: number;
  quantityDiscountPct: number;
  materialMultiplier: number;
  laminationMultiplier: number;
  shapeMultiplier: number;
  setupFeeCents: number;
  unitPriceCents: number;
  subtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
  breakdown: {
    baseUnitCents: number;
    afterQtyDiscountUnitCents: number;
    afterMaterialUnitCents: number;
    afterLaminationUnitCents: number;
    afterShapeUnitCents: number;
  };
}

function applyModifier(priceCents: number, type: StickerPriceModifierType, value: number): number {
  switch (type) {
    case "none":        return priceCents;
    case "multiplier":  return Math.round(priceCents * value);
    case "percentage":  return Math.round(priceCents * (1 + value / 100));
    case "fixed":       return priceCents + Math.round(value * 100);
    default:            return priceCents;
  }
}

function getMultiplierValue(type: StickerPriceModifierType, value: number): number {
  switch (type) {
    case "none":        return 1;
    case "multiplier":  return value;
    case "percentage":  return 1 + value / 100;
    case "fixed":       return 1;
    default:            return 1;
  }
}

function getQuantityDiscount(quantity: number, tiers: StickerQuantityTier[]): number {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
  for (const tier of sorted) {
    if (quantity >= tier.minQty) return tier.discountPct;
  }
  return 0;
}

export function computeStickerPrice(input: StickerPriceInput): StickerPriceResult {
  const {
    widthMm, heightMm, quantity, pricePerCm2Cents, quantityTiers,
    setupFeeCents, minOrderCents, materialModifier, laminationModifier, shapeModifier,
    vatRate = 0.2,
  } = input;

  const surfaceCm2 = (widthMm * heightMm) / 100;
  const baseUnitCents = Math.ceil(surfaceCm2 * pricePerCm2Cents);

  const quantityDiscountPct = getQuantityDiscount(quantity, quantityTiers);
  const afterQtyDiscountUnitCents = Math.ceil(baseUnitCents * (1 - quantityDiscountPct / 100));

  const afterMaterialUnitCents = applyModifier(afterQtyDiscountUnitCents, materialModifier.type, materialModifier.value);

  const afterLaminationUnitCents = laminationModifier
    ? applyModifier(afterMaterialUnitCents, laminationModifier.type, laminationModifier.value)
    : afterMaterialUnitCents;

  const afterShapeUnitCents = applyModifier(afterLaminationUnitCents, shapeModifier.type, shapeModifier.value);

  const unitPriceCents = afterShapeUnitCents;
  let subtotalCents = unitPriceCents * quantity + setupFeeCents;

  if (minOrderCents > 0 && subtotalCents < minOrderCents) {
    subtotalCents = minOrderCents;
  }

  const vatAmountCents = Math.ceil(subtotalCents * vatRate);
  const totalCents = subtotalCents + vatAmountCents;

  return {
    surfaceCm2,
    quantityDiscountPct,
    materialMultiplier: getMultiplierValue(materialModifier.type, materialModifier.value),
    laminationMultiplier: laminationModifier
      ? getMultiplierValue(laminationModifier.type, laminationModifier.value)
      : 1,
    shapeMultiplier: getMultiplierValue(shapeModifier.type, shapeModifier.value),
    setupFeeCents,
    unitPriceCents,
    subtotalCents,
    vatAmountCents,
    totalCents,
    breakdown: {
      baseUnitCents,
      afterQtyDiscountUnitCents,
      afterMaterialUnitCents,
      afterLaminationUnitCents,
      afterShapeUnitCents,
    },
  };
}

export function formatEur(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formatEurRaw(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
