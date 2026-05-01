-- Migration 0019 — User tags & notes for admin management

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "tags"  TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "notes" TEXT;
