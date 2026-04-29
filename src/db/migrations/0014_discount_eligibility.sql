ALTER TABLE "discounts"
  ADD COLUMN IF NOT EXISTS "eligibility" jsonb NOT NULL DEFAULT '{"customerEligibility":"ALL"}';
