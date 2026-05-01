-- 0028 — Ajout du mode de tarification sur product_sticker_configs
-- pricingMode : "per_cm2" (défaut) | "unit_price" (prix unitaire fixe)
-- baseUnitPriceCents : prix unitaire HT en centimes (utilisé si pricingMode = "unit_price")

ALTER TABLE "product_sticker_configs"
  ADD COLUMN IF NOT EXISTS "pricing_mode"         VARCHAR(20) NOT NULL DEFAULT 'per_cm2',
  ADD COLUMN IF NOT EXISTS "base_unit_price_cents" INTEGER     NOT NULL DEFAULT 0;
