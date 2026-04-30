-- Migration 0018 — Shipping Engine
-- Phase 1: methods, zones, postal rules, rules, snapshots
-- Phase 3: pickup locations, time slots, blackout dates

-- ─── shipping_methods ─────────────────────────────────────────────────────────

CREATE TYPE "shipping_method_type" AS ENUM (
  'carrier', 'local_delivery', 'pickup', 'relay_point', 'custom', 'freight'
);

CREATE TABLE "shipping_methods" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                  VARCHAR(255) NOT NULL,
  "public_name"           VARCHAR(255) NOT NULL,
  "description"           TEXT,
  "type"                  "shipping_method_type" NOT NULL DEFAULT 'carrier',
  "is_active"             BOOLEAN NOT NULL DEFAULT true,
  "is_default"            BOOLEAN NOT NULL DEFAULT false,
  "base_price_cents"      INTEGER NOT NULL DEFAULT 0,
  "currency"              VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "min_delivery_days"     INTEGER,
  "max_delivery_days"     INTEGER,
  "carrier_code"          VARCHAR(100),
  "carrier_service_code"  VARCHAR(100),
  "supports_tracking"     BOOLEAN NOT NULL DEFAULT false,
  "supports_relay_point"  BOOLEAN NOT NULL DEFAULT false,
  "supports_pickup"       BOOLEAN NOT NULL DEFAULT false,
  "supports_delivery_date" BOOLEAN NOT NULL DEFAULT false,
  "supports_time_slot"    BOOLEAN NOT NULL DEFAULT false,
  "display_order"         INTEGER NOT NULL DEFAULT 0,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── shipping_zones ───────────────────────────────────────────────────────────

CREATE TABLE "shipping_zones" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        VARCHAR(255) NOT NULL,
  "description" TEXT,
  "countries"   JSONB NOT NULL DEFAULT '[]',
  "regions"     JSONB NOT NULL DEFAULT '[]',
  "cities"      JSONB NOT NULL DEFAULT '[]',
  "geo_radius"  JSONB,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── shipping_zone_postal_rules ───────────────────────────────────────────────

CREATE TABLE "shipping_zone_postal_rules" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "zone_id"    UUID NOT NULL REFERENCES "shipping_zones"("id") ON DELETE CASCADE,
  "type"       VARCHAR(20) NOT NULL CHECK ("type" IN ('exact','prefix','range','regex','exclude')),
  "value"      VARCHAR(255) NOT NULL,
  "from_value" VARCHAR(255),
  "to_value"   VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "shipping_zone_postal_rules_zone_id_idx" ON "shipping_zone_postal_rules"("zone_id");

-- ─── shipping_rules ───────────────────────────────────────────────────────────

CREATE TABLE "shipping_rules" (
  "id"                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                        VARCHAR(255) NOT NULL,
  "description"                 TEXT,
  "is_active"                   BOOLEAN NOT NULL DEFAULT true,
  "priority"                    INTEGER NOT NULL DEFAULT 100,
  "starts_at"                   TIMESTAMPTZ,
  "ends_at"                     TIMESTAMPTZ,
  "condition_root"              JSONB NOT NULL DEFAULT '{"logic":"AND","conditions":[],"groups":[]}',
  "actions"                     JSONB NOT NULL DEFAULT '[]',
  "stop_processing_after_match" BOOLEAN NOT NULL DEFAULT false,
  "combinable_with_other_rules" BOOLEAN NOT NULL DEFAULT true,
  "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "shipping_rules_priority_idx" ON "shipping_rules"("priority");
CREATE INDEX "shipping_rules_active_idx" ON "shipping_rules"("is_active");

-- ─── order_shipping_snapshots ─────────────────────────────────────────────────

CREATE TABLE "order_shipping_snapshots" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"             UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "selected_method_id"   VARCHAR(255),
  "selected_method_name" VARCHAR(255),
  "base_price_cents"     INTEGER NOT NULL DEFAULT 0,
  "final_price_cents"    INTEGER NOT NULL DEFAULT 0,
  "currency"             VARCHAR(3) NOT NULL DEFAULT 'EUR',
  "applied_rules_json"   JSONB NOT NULL DEFAULT '[]',
  "hidden_methods_json"  JSONB NOT NULL DEFAULT '[]',
  "destination_json"     JSONB NOT NULL DEFAULT '{}',
  "cart_snapshot_json"   JSONB NOT NULL DEFAULT '{}',
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "order_shipping_snapshots_order_id_idx" ON "order_shipping_snapshots"("order_id");

-- ─── Phase 3: shipping_pickup_locations ───────────────────────────────────────

CREATE TABLE "shipping_pickup_locations" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"             VARCHAR(255) NOT NULL,
  "address_line1"    VARCHAR(255),
  "address_line2"    VARCHAR(255),
  "city"             VARCHAR(100),
  "postal_code"      VARCHAR(20),
  "country_code"     VARCHAR(10) NOT NULL DEFAULT 'FR',
  "phone"            VARCHAR(50),
  "instructions"     TEXT,
  "hours_json"       JSONB NOT NULL DEFAULT '{}',
  "days_available"   JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
  "prep_delay_days"  INTEGER NOT NULL DEFAULT 1,
  "slot_capacity"    INTEGER NOT NULL DEFAULT 0,
  "is_active"        BOOLEAN NOT NULL DEFAULT true,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Phase 3: shipping_time_slots ─────────────────────────────────────────────

CREATE TABLE "shipping_time_slots" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "method_id"        UUID REFERENCES "shipping_methods"("id") ON DELETE CASCADE,
  "label"            VARCHAR(100) NOT NULL,
  "start_time"       VARCHAR(5) NOT NULL,
  "end_time"         VARCHAR(5) NOT NULL,
  "days_of_week"     JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
  "max_capacity"     INTEGER NOT NULL DEFAULT 0,
  "extra_price_cents" INTEGER NOT NULL DEFAULT 0,
  "is_active"        BOOLEAN NOT NULL DEFAULT true,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "shipping_time_slots_method_id_idx" ON "shipping_time_slots"("method_id");

-- ─── Phase 3: shipping_blackout_dates ─────────────────────────────────────────

CREATE TABLE "shipping_blackout_dates" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date"                DATE NOT NULL,
  "reason"              VARCHAR(255),
  "affects_method_ids"  JSONB NOT NULL DEFAULT '[]',
  "is_recurring"        BOOLEAN NOT NULL DEFAULT false,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "shipping_blackout_dates_date_idx" ON "shipping_blackout_dates"("date");

-- ─── Seed: default methods ────────────────────────────────────────────────────

INSERT INTO "shipping_methods" ("id", "name", "public_name", "description", "type", "is_active", "is_default", "base_price_cents", "min_delivery_days", "max_delivery_days", "display_order")
VALUES
  (gen_random_uuid(), 'standard', 'Livraison standard', 'Livraison à domicile sous 3 à 5 jours ouvrés', 'carrier', true, true, 490, 3, 5, 1),
  (gen_random_uuid(), 'express', 'Livraison express', 'Livraison à domicile sous 24h à 48h', 'carrier', true, false, 990, 1, 2, 2);

-- ─── Seed: default zone France ────────────────────────────────────────────────

INSERT INTO "shipping_zones" ("id", "name", "description", "countries", "is_active")
VALUES
  (gen_random_uuid(), 'France métropolitaine', 'France (hors Corse et DOM-TOM)', '["FR"]', true);
