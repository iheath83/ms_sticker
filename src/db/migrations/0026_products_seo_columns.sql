-- 0026 — Colonnes SEO manquantes sur products (seo_title, seo_description)

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "seo_title"       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "seo_description" TEXT;
