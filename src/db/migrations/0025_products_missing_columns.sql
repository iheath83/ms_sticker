-- 0025 — Ajout des colonnes manquantes sur products (features, images, gtin, mpn)
-- Ces colonnes étaient dans le schéma Drizzle mais jamais migrées en DB.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "features"  TEXT[],
  ADD COLUMN IF NOT EXISTS "images"    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "gtin"      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "mpn"       VARCHAR(100);
