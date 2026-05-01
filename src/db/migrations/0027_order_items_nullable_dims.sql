-- 0027 — Rendre width_mm, height_mm, shape, finish nullable dans order_items
-- Ces colonnes étaient NOT NULL dans la migration initiale mais le schéma Drizzle les définit nullables.

ALTER TABLE "order_items"
  ALTER COLUMN "width_mm"  DROP NOT NULL,
  ALTER COLUMN "height_mm" DROP NOT NULL,
  ALTER COLUMN "shape"     DROP NOT NULL,
  ALTER COLUMN "finish"    DROP NOT NULL;
