ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "standard_shipping_cents"       integer NOT NULL DEFAULT 490,
  ADD COLUMN IF NOT EXISTS "express_shipping_cents"        integer NOT NULL DEFAULT 990,
  ADD COLUMN IF NOT EXISTS "free_shipping_threshold_cents" integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS "quantity_step"                 integer NOT NULL DEFAULT 25;
