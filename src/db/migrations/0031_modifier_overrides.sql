-- 0031 — Overrides de modificateur par produit pour formes, matières, laminations
-- Permet de définir une valeur de modificateur différente par produit
-- (override de priceModifierValue du catalogue global)

ALTER TABLE "product_sticker_configs"
  ADD COLUMN IF NOT EXISTS "shape_modifier_overrides"      JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "material_modifier_overrides"   JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "lamination_modifier_overrides" JSONB NOT NULL DEFAULT '{}';
