-- 0030 — Prix par taille configurable par produit
-- sizePriceOverrides : map { sizeId: priceCents } stockée en JSONB
-- Prioritaire sur le prix global de la taille (price_cents sur sticker_sizes)

ALTER TABLE "product_sticker_configs"
  ADD COLUMN IF NOT EXISTS "size_price_overrides" JSONB NOT NULL DEFAULT '{}';
