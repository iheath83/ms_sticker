-- 0024 — Suppression du champ product_family (redondant avec categories)

ALTER TABLE "products" DROP COLUMN IF EXISTS "product_family";
DROP TABLE IF EXISTS "product_families" CASCADE;
