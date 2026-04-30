-- Migration 0016: Review system

-- Enums
DO $$ BEGIN
  CREATE TYPE "review_status" AS ENUM ('pending', 'published', 'rejected', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_verification_status" AS ENUM ('verified_purchase', 'unverified', 'manual_verified', 'imported');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_source" AS ENUM ('post_purchase_email', 'manual_request', 'onsite_form', 'import', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_type" AS ENUM ('product', 'store');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_request_status" AS ENUM ('scheduled', 'sent', 'opened', 'clicked', 'submitted', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_request_type" AS ENUM ('product', 'store', 'combined');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_media_type" AS ENUM ('image', 'video');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_media_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "review_request_item_status" AS ENUM ('pending', 'submitted', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- reviews
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" review_type NOT NULL,
  "rating" integer NOT NULL,
  "title" varchar(255),
  "body" text,
  "status" review_status NOT NULL DEFAULT 'pending',
  "verification_status" review_verification_status NOT NULL DEFAULT 'unverified',
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "product_variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "order_item_id" uuid REFERENCES "order_items"("id") ON DELETE SET NULL,
  "customer_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "customer_email" varchar(320) NOT NULL,
  "customer_name" varchar(255),
  "display_name" varchar(255),
  "source" review_source NOT NULL DEFAULT 'post_purchase_email',
  "locale" varchar(10) DEFAULT 'fr',
  "helpful_count" integer NOT NULL DEFAULT 0,
  "not_helpful_count" integer NOT NULL DEFAULT 0,
  "published_at" timestamptz,
  "rejected_at" timestamptz,
  "rejection_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "reviews_product_id_idx" ON "reviews"("product_id");
CREATE INDEX IF NOT EXISTS "reviews_order_id_idx" ON "reviews"("order_id");
CREATE INDEX IF NOT EXISTS "reviews_customer_email_idx" ON "reviews"("customer_email");
CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews"("status");
CREATE INDEX IF NOT EXISTS "reviews_type_idx" ON "reviews"("type");

-- review_media
CREATE TABLE IF NOT EXISTS "review_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_id" uuid NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
  "type" review_media_type NOT NULL,
  "url" text NOT NULL,
  "thumbnail_url" text,
  "storage_key" text NOT NULL,
  "status" review_media_status NOT NULL DEFAULT 'pending',
  "alt_text" text,
  "caption" text,
  "consent_for_marketing" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "review_media_review_id_idx" ON "review_media"("review_id");
CREATE INDEX IF NOT EXISTS "review_media_status_idx" ON "review_media"("status");

-- review_requests
CREATE TABLE IF NOT EXISTS "review_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "customer_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "customer_email" varchar(320) NOT NULL,
  "type" review_request_type NOT NULL DEFAULT 'combined',
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "status" review_request_status NOT NULL DEFAULT 'scheduled',
  "send_at" timestamptz NOT NULL,
  "sent_at" timestamptz,
  "first_opened_at" timestamptz,
  "first_clicked_at" timestamptz,
  "submitted_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "reminder_count" integer NOT NULL DEFAULT 0,
  "next_reminder_at" timestamptz,
  "locale" varchar(10) DEFAULT 'fr',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "review_requests_order_id_idx" ON "review_requests"("order_id");
CREATE INDEX IF NOT EXISTS "review_requests_customer_email_idx" ON "review_requests"("customer_email");
CREATE INDEX IF NOT EXISTS "review_requests_status_idx" ON "review_requests"("status");
CREATE INDEX IF NOT EXISTS "review_requests_send_at_idx" ON "review_requests"("send_at");

-- review_request_items
CREATE TABLE IF NOT EXISTS "review_request_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_request_id" uuid NOT NULL REFERENCES "review_requests"("id") ON DELETE CASCADE,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "product_variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
  "order_item_id" uuid REFERENCES "order_items"("id") ON DELETE SET NULL,
  "status" review_request_item_status NOT NULL DEFAULT 'pending',
  "review_id" uuid REFERENCES "reviews"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "review_request_items_request_id_idx" ON "review_request_items"("review_request_id");
CREATE INDEX IF NOT EXISTS "review_request_items_product_id_idx" ON "review_request_items"("product_id");

-- review_attributes
CREATE TABLE IF NOT EXISTS "review_attributes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_id" uuid NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
  "key" varchar(100) NOT NULL,
  "label" varchar(255) NOT NULL,
  "value" varchar(255) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "review_attributes_review_id_idx" ON "review_attributes"("review_id");
CREATE INDEX IF NOT EXISTS "review_attributes_key_idx" ON "review_attributes"("key");

-- review_aggregates
CREATE TABLE IF NOT EXISTS "review_aggregates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "target_type" review_type NOT NULL,
  "target_id" uuid,
  "average_rating" real NOT NULL DEFAULT 0,
  "review_count" integer NOT NULL DEFAULT 0,
  "rating1_count" integer NOT NULL DEFAULT 0,
  "rating2_count" integer NOT NULL DEFAULT 0,
  "rating3_count" integer NOT NULL DEFAULT 0,
  "rating4_count" integer NOT NULL DEFAULT 0,
  "rating5_count" integer NOT NULL DEFAULT 0,
  "media_review_count" integer NOT NULL DEFAULT 0,
  "verified_review_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_aggregates_target_idx" ON "review_aggregates"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "review_aggregates_target_type_idx" ON "review_aggregates"("target_type");

-- review_email_preferences
CREATE TABLE IF NOT EXISTS "review_email_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_email" varchar(320) NOT NULL UNIQUE,
  "customer_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "opted_out" boolean NOT NULL DEFAULT false,
  "opted_out_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- review_replies
CREATE TABLE IF NOT EXISTS "review_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_id" uuid NOT NULL UNIQUE REFERENCES "reviews"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'published',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "review_replies_review_id_idx" ON "review_replies"("review_id");

-- review_settings
CREATE TABLE IF NOT EXISTS "review_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "auto_publish" boolean NOT NULL DEFAULT false,
  "auto_publish_min_rating" integer,
  "request_delay_days_after_fulfillment" integer NOT NULL DEFAULT 7,
  "request_expires_after_days" integer NOT NULL DEFAULT 60,
  "reminders_enabled" boolean NOT NULL DEFAULT true,
  "first_reminder_delay_days" integer NOT NULL DEFAULT 5,
  "second_reminder_delay_days" integer,
  "max_reminder_count" integer NOT NULL DEFAULT 2,
  "collect_store_review" boolean NOT NULL DEFAULT true,
  "collect_product_reviews" boolean NOT NULL DEFAULT true,
  "collect_media" boolean NOT NULL DEFAULT true,
  "require_moderation_for_media" boolean NOT NULL DEFAULT true,
  "require_moderation_for_low_rating" boolean NOT NULL DEFAULT true,
  "low_rating_threshold" integer NOT NULL DEFAULT 3,
  "display_reviewer_last_name" boolean NOT NULL DEFAULT false,
  "display_verified_badge" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Insert default review settings row
INSERT INTO "review_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

-- Add reviewsEnabled to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reviews_enabled" boolean NOT NULL DEFAULT true;
