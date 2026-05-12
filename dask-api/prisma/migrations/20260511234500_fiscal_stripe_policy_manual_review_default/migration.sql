-- Make the safe fiscal Stripe policy the default for all new company configs.
ALTER TABLE "FiscalCompanyConfig"
  ALTER COLUMN "stripePolicy" SET DEFAULT 'manual_review';

-- Normalize legacy rows created by the old default without enabling automation.
UPDATE "FiscalCompanyConfig"
SET "stripePolicy" = 'manual_review'
WHERE "stripePolicy" = 'assisted_one_click'
  AND "emitAutomatically" = false;

-- Preserve explicit automatic emission configs while removing the legacy policy label.
UPDATE "FiscalCompanyConfig"
SET "stripePolicy" = 'automatic_after_payment'
WHERE "stripePolicy" = 'assisted_one_click'
  AND "emitAutomatically" = true;
