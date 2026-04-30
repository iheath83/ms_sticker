-- Migration 0017: Google Reviews / Merchant Center compatibility

-- Add product identifiers for Google Product Reviews feed
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku"   varchar(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "gtin"  varchar(50);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "mpn"   varchar(100);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" varchar(255) NOT NULL DEFAULT 'MS Adhésif';

-- Default SKU to slug for existing products (slug is already a stable identifier)
UPDATE "products" SET "sku" = "slug" WHERE "sku" IS NULL;

-- Add country code to reviews (ISO 3166-1 alpha-2)
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "country" varchar(10) NOT NULL DEFAULT 'FR';
