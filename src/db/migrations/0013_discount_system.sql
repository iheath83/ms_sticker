-- Discount system — Phase 1 MVP

-- Add discount columns to orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "discount_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_code" varchar(100),
  ADD COLUMN IF NOT EXISTS "applied_discounts" jsonb DEFAULT '[]';

-- Discounts table
CREATE TABLE IF NOT EXISTS "discounts" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title"                   varchar(255) NOT NULL,
  "internal_name"           varchar(255),
  "code"                    varchar(100) UNIQUE,
  "method"                  varchar(20) NOT NULL,
  "type"                    varchar(30) NOT NULL,
  "target"                  varchar(20) NOT NULL DEFAULT 'ORDER',
  "value"                   integer,
  "status"                  varchar(30) NOT NULL DEFAULT 'ACTIVE',
  "starts_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "ends_at"                 timestamp with time zone,
  "priority"                integer NOT NULL DEFAULT 0,
  "usage_count"             integer NOT NULL DEFAULT 0,
  "global_usage_limit"      integer,
  "usage_limit_per_customer" integer,
  "conditions"              jsonb NOT NULL DEFAULT '{}',
  "combination_rules"       jsonb NOT NULL DEFAULT '{}',
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "discounts_code_idx" ON "discounts" ("code");
CREATE INDEX IF NOT EXISTS "discounts_method_status_idx" ON "discounts" ("method", "status");

-- Discount usages table
CREATE TABLE IF NOT EXISTS "discount_usages" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "discount_id"    uuid NOT NULL REFERENCES "discounts"("id") ON DELETE CASCADE,
  "customer_id"    text REFERENCES "users"("id") ON DELETE SET NULL,
  "order_id"       uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "code"           varchar(100),
  "discount_cents" integer NOT NULL,
  "used_at"        timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "discount_usages_discount_id_idx" ON "discount_usages" ("discount_id");
CREATE INDEX IF NOT EXISTS "discount_usages_customer_id_idx" ON "discount_usages" ("customer_id");
CREATE INDEX IF NOT EXISTS "discount_usages_order_id_idx"    ON "discount_usages" ("order_id");
