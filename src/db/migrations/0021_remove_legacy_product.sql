-- 0021 — Suppression du système produit legacy (variants, options, colonnes legacy)

-- ─── Supprimer les FKs qui pointent vers product_variants ────────────────────
ALTER TABLE "order_items"    DROP CONSTRAINT IF EXISTS "order_items_variant_id_product_variants_id_fk";
ALTER TABLE "reviews"        DROP CONSTRAINT IF EXISTS "reviews_product_variant_id_product_variants_id_fk";
ALTER TABLE "review_request_items" DROP CONSTRAINT IF EXISTS "review_request_items_product_variant_id_product_variants_id_fk";

-- ─── Rendre les colonnes legacy de order_items nullable ──────────────────────
ALTER TABLE "order_items" ALTER COLUMN "shape"  DROP NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "finish" DROP NOT NULL;
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "variant_id";

-- ─── Supprimer product_variants ──────────────────────────────────────────────
DROP TABLE IF EXISTS "product_variants" CASCADE;

-- ─── Supprimer product_option_values ─────────────────────────────────────────
DROP TABLE IF EXISTS "product_option_values" CASCADE;

-- ─── Supprimer colonnes legacy de products ───────────────────────────────────
ALTER TABLE "products" DROP COLUMN IF EXISTS "base_price_cents";
ALTER TABLE "products" DROP COLUMN IF EXISTS "material";
ALTER TABLE "products" DROP COLUMN IF EXISTS "min_width_mm";
ALTER TABLE "products" DROP COLUMN IF EXISTS "max_width_mm";
ALTER TABLE "products" DROP COLUMN IF EXISTS "min_height_mm";
ALTER TABLE "products" DROP COLUMN IF EXISTS "max_height_mm";
ALTER TABLE "products" DROP COLUMN IF EXISTS "shapes";
ALTER TABLE "products" DROP COLUMN IF EXISTS "min_qty";
ALTER TABLE "products" DROP COLUMN IF EXISTS "options";
ALTER TABLE "products" DROP COLUMN IF EXISTS "requires_customization";

-- ─── Ajouter champ status sur products (remplace active + requires_customization) ──
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'active';
-- Migrer: active=false → archived
UPDATE "products" SET "status" = 'archived' WHERE "active" = FALSE;
-- Supprimer colonne active legacy
ALTER TABLE "products" DROP COLUMN IF EXISTS "active";

-- ─── Nettoyer reviews (rendre variant nullable) ───────────────────────────────
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "product_variant_id";
ALTER TABLE "review_request_items" DROP COLUMN IF EXISTS "product_variant_id";
