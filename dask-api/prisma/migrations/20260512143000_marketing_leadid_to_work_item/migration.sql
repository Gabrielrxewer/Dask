-- Move Marketing's productive relationships away from historical Lead rows.
-- Lead tables stay available as an isolated historical archive, but Marketing,
-- documentation metadata, and active attribution now point to WorkItem/Item ids.

ALTER TABLE "MarketingContactPreference" ADD COLUMN "legacyLeadId" TEXT;
ALTER TABLE "MarketingConsentRecord" ADD COLUMN "legacyLeadId" TEXT;
ALTER TABLE "MarketingCampaignSend" ADD COLUMN "workItemId" TEXT, ADD COLUMN "legacyLeadId" TEXT;
ALTER TABLE "MarketingAutomationEnrollment" ADD COLUMN "workItemId" TEXT, ADD COLUMN "legacyLeadId" TEXT;
ALTER TABLE "MarketingEvent" ADD COLUMN "legacyLeadId" TEXT;
ALTER TABLE "MarketingLeadScoreEvent" ADD COLUMN "workItemId" TEXT, ADD COLUMN "legacyLeadId" TEXT;
ALTER TABLE "MarketingAttribution" ADD COLUMN "workItemId" TEXT, ADD COLUMN "legacyLeadId" TEXT;

WITH lead_work_items AS (
  SELECT DISTINCT ON (l."workspaceId", l."id")
    l."workspaceId",
    l."id" AS "legacyLeadId",
    i."id" AS "workItemId"
  FROM "Lead" l
  JOIN "Item" i
    ON i."workspaceId" = l."workspaceId"
   AND (
     i."metadata" #>> '{legacyLead,leadId}' = l."id"
     OR i."fields" #>> '{legacyLeadId}' = l."id"
     OR i."metadata" #>> '{legacyLeadId}' = l."id"
   )
  ORDER BY l."workspaceId", l."id", i."createdAt" ASC, i."id" ASC
)
UPDATE "MarketingCampaignSend" m
SET
  "legacyLeadId" = m."leadId",
  "workItemId" = COALESCE(m."workItemId", lw."workItemId")
FROM lead_work_items lw
WHERE m."workspaceId" = lw."workspaceId"
  AND m."leadId" = lw."legacyLeadId";

UPDATE "MarketingCampaignSend"
SET "legacyLeadId" = "leadId"
WHERE "legacyLeadId" IS NULL AND "leadId" IS NOT NULL;

UPDATE "MarketingCampaignSend"
SET "workItemId" = "metadata" #>> '{sourceWorkItemId}'
WHERE "workItemId" IS NULL
  AND "metadata" IS NOT NULL
  AND "metadata" ? 'sourceWorkItemId';

WITH lead_work_items AS (
  SELECT DISTINCT ON (l."workspaceId", l."id")
    l."workspaceId",
    l."id" AS "legacyLeadId",
    i."id" AS "workItemId"
  FROM "Lead" l
  JOIN "Item" i
    ON i."workspaceId" = l."workspaceId"
   AND (
     i."metadata" #>> '{legacyLead,leadId}' = l."id"
     OR i."fields" #>> '{legacyLeadId}' = l."id"
     OR i."metadata" #>> '{legacyLeadId}' = l."id"
   )
  ORDER BY l."workspaceId", l."id", i."createdAt" ASC, i."id" ASC
)
UPDATE "MarketingAutomationEnrollment" m
SET
  "legacyLeadId" = m."leadId",
  "workItemId" = COALESCE(m."workItemId", lw."workItemId")
FROM lead_work_items lw
WHERE m."workspaceId" = lw."workspaceId"
  AND m."leadId" = lw."legacyLeadId";

UPDATE "MarketingAutomationEnrollment"
SET "legacyLeadId" = "leadId"
WHERE "legacyLeadId" IS NULL AND "leadId" IS NOT NULL;

UPDATE "MarketingAutomationEnrollment"
SET "workItemId" = "context" #>> '{workItemId}'
WHERE "workItemId" IS NULL
  AND "context" IS NOT NULL
  AND "context" ? 'workItemId';

WITH lead_work_items AS (
  SELECT DISTINCT ON (l."workspaceId", l."id")
    l."workspaceId",
    l."id" AS "legacyLeadId",
    i."id" AS "workItemId"
  FROM "Lead" l
  JOIN "Item" i
    ON i."workspaceId" = l."workspaceId"
   AND (
     i."metadata" #>> '{legacyLead,leadId}' = l."id"
     OR i."fields" #>> '{legacyLeadId}' = l."id"
     OR i."metadata" #>> '{legacyLeadId}' = l."id"
   )
  ORDER BY l."workspaceId", l."id", i."createdAt" ASC, i."id" ASC
)
UPDATE "MarketingEvent" m
SET
  "legacyLeadId" = m."leadId",
  "itemId" = COALESCE(m."itemId", lw."workItemId")
FROM lead_work_items lw
WHERE m."workspaceId" = lw."workspaceId"
  AND m."leadId" = lw."legacyLeadId";

UPDATE "MarketingEvent"
SET "legacyLeadId" = "leadId"
WHERE "legacyLeadId" IS NULL AND "leadId" IS NOT NULL;

WITH lead_work_items AS (
  SELECT DISTINCT ON (l."workspaceId", l."id")
    l."workspaceId",
    l."id" AS "legacyLeadId",
    i."id" AS "workItemId"
  FROM "Lead" l
  JOIN "Item" i
    ON i."workspaceId" = l."workspaceId"
   AND (
     i."metadata" #>> '{legacyLead,leadId}' = l."id"
     OR i."fields" #>> '{legacyLeadId}' = l."id"
     OR i."metadata" #>> '{legacyLeadId}' = l."id"
   )
  ORDER BY l."workspaceId", l."id", i."createdAt" ASC, i."id" ASC
)
UPDATE "MarketingLeadScoreEvent" m
SET
  "legacyLeadId" = m."leadId",
  "workItemId" = COALESCE(m."workItemId", lw."workItemId")
FROM lead_work_items lw
WHERE m."workspaceId" = lw."workspaceId"
  AND m."leadId" = lw."legacyLeadId";

UPDATE "MarketingLeadScoreEvent"
SET "legacyLeadId" = "leadId"
WHERE "legacyLeadId" IS NULL AND "leadId" IS NOT NULL;

WITH lead_work_items AS (
  SELECT DISTINCT ON (l."workspaceId", l."id")
    l."workspaceId",
    l."id" AS "legacyLeadId",
    i."id" AS "workItemId"
  FROM "Lead" l
  JOIN "Item" i
    ON i."workspaceId" = l."workspaceId"
   AND (
     i."metadata" #>> '{legacyLead,leadId}' = l."id"
     OR i."fields" #>> '{legacyLeadId}' = l."id"
     OR i."metadata" #>> '{legacyLeadId}' = l."id"
   )
  ORDER BY l."workspaceId", l."id", i."createdAt" ASC, i."id" ASC
)
UPDATE "MarketingAttribution" m
SET
  "legacyLeadId" = m."leadId",
  "workItemId" = COALESCE(m."workItemId", lw."workItemId"),
  "entityRef" = CASE
    WHEN m."entityType"::text = 'LEAD' THEN lw."workItemId"
    ELSE m."entityRef"
  END
FROM lead_work_items lw
WHERE m."workspaceId" = lw."workspaceId"
  AND m."leadId" = lw."legacyLeadId";

UPDATE "MarketingAttribution"
SET "legacyLeadId" = "leadId"
WHERE "legacyLeadId" IS NULL AND "leadId" IS NOT NULL;

UPDATE "MarketingContactPreference"
SET "legacyLeadId" = "leadId"
WHERE "leadId" IS NOT NULL;

UPDATE "MarketingConsentRecord"
SET "legacyLeadId" = "leadId"
WHERE "leadId" IS NOT NULL;

UPDATE "Item"
SET "metadata" = jsonb_set("metadata" - 'leadId', '{legacyLeadId}', "metadata" -> 'leadId', true)
WHERE "metadata" IS NOT NULL
  AND "metadata" ? 'leadId'
  AND NOT "metadata" ? 'legacyLeadId';

UPDATE "Item"
SET "metadata" = "metadata" - 'leadId'
WHERE "metadata" IS NOT NULL
  AND "metadata" ? 'leadId';

WITH lead_work_items AS (
  SELECT DISTINCT ON (l."workspaceId", l."id")
    l."workspaceId",
    l."id" AS "legacyLeadId",
    i."id" AS "workItemId"
  FROM "Lead" l
  JOIN "Item" i
    ON i."workspaceId" = l."workspaceId"
   AND (
     i."metadata" #>> '{legacyLead,leadId}' = l."id"
     OR i."fields" #>> '{legacyLeadId}' = l."id"
     OR i."metadata" #>> '{legacyLeadId}' = l."id"
   )
  ORDER BY l."workspaceId", l."id", i."createdAt" ASC, i."id" ASC
)
UPDATE "WorkspaceDocument" d
SET "metadata" = jsonb_set(d."metadata" - 'leadId', '{workItemId}', to_jsonb(lw."workItemId"), true)
FROM lead_work_items lw
WHERE d."metadata" IS NOT NULL
  AND d."metadata" ? 'leadId'
  AND d."workspaceId" = lw."workspaceId"
  AND d."metadata" ->> 'leadId' = lw."legacyLeadId";

UPDATE "WorkspaceDocument"
SET "metadata" = jsonb_set("metadata" - 'leadId', '{legacyLeadId}', "metadata" -> 'leadId', true)
WHERE "metadata" IS NOT NULL
  AND "metadata" ? 'leadId';

UPDATE "MarketingCampaignSend"
SET "metadata" = jsonb_set("metadata" - 'leadId', '{legacyLeadId}', "metadata" -> 'leadId', true)
WHERE "metadata" IS NOT NULL
  AND "metadata" ? 'leadId';

UPDATE "MarketingEvent"
SET "payload" = jsonb_set("payload" - 'leadId', '{legacyLeadId}', "payload" -> 'leadId', true)
WHERE "payload" IS NOT NULL
  AND "payload" ? 'leadId';

ALTER TABLE "MarketingContactPreference" DROP CONSTRAINT IF EXISTS "MarketingContactPreference_leadId_fkey";
ALTER TABLE "MarketingConsentRecord" DROP CONSTRAINT IF EXISTS "MarketingConsentRecord_leadId_fkey";
ALTER TABLE "MarketingCampaignSend" DROP CONSTRAINT IF EXISTS "MarketingCampaignSend_leadId_fkey";
ALTER TABLE "MarketingAutomationEnrollment" DROP CONSTRAINT IF EXISTS "MarketingAutomationEnrollment_leadId_fkey";
ALTER TABLE "MarketingEvent" DROP CONSTRAINT IF EXISTS "MarketingEvent_leadId_fkey";
ALTER TABLE "MarketingLeadScoreEvent" DROP CONSTRAINT IF EXISTS "MarketingLeadScoreEvent_leadId_fkey";
ALTER TABLE "MarketingAttribution" DROP CONSTRAINT IF EXISTS "MarketingAttribution_leadId_fkey";

DROP INDEX IF EXISTS "MarketingContactPreference_workspaceId_leadId_messageKind_key";
DROP INDEX IF EXISTS "MarketingContactPreference_workspaceId_leadId_idx";
DROP INDEX IF EXISTS "MarketingConsentRecord_workspaceId_leadId_recordedAt_idx";
DROP INDEX IF EXISTS "MarketingCampaignSend_workspaceId_leadId_createdAt_idx";
DROP INDEX IF EXISTS "MarketingAutomationEnrollment_workspaceId_leadId_startedAt_idx";
DROP INDEX IF EXISTS "MarketingEvent_workspaceId_leadId_occurredAt_idx";
DROP INDEX IF EXISTS "MarketingLeadScoreEvent_workspaceId_leadId_createdAt_idx";
DROP INDEX IF EXISTS "MarketingAttribution_workspaceId_leadId_happenedAt_idx";

ALTER TABLE "MarketingContactPreference" DROP COLUMN "leadId";
ALTER TABLE "MarketingConsentRecord" DROP COLUMN "leadId";
ALTER TABLE "MarketingCampaignSend" DROP COLUMN "leadId";
ALTER TABLE "MarketingAutomationEnrollment" DROP COLUMN "leadId";
ALTER TABLE "MarketingEvent" DROP COLUMN "leadId";
ALTER TABLE "MarketingLeadScoreEvent" DROP COLUMN "leadId";
ALTER TABLE "MarketingAttribution" DROP COLUMN "leadId";

CREATE TYPE "MarketingCampaignObjective_new" AS ENUM (
  'COMMERCIAL_NURTURE',
  'ONBOARDING',
  'REACTIVATION',
  'BILLING_REMINDER',
  'RENEWAL',
  'EXPANSION',
  'PRODUCT_UPDATE',
  'NEWSLETTER',
  'CUSTOM'
);

ALTER TABLE "MarketingCampaign"
ALTER COLUMN "objective" TYPE "MarketingCampaignObjective_new"
USING (
  CASE
    WHEN "objective"::text = 'LEAD_NURTURE' THEN 'COMMERCIAL_NURTURE'
    ELSE "objective"::text
  END
)::"MarketingCampaignObjective_new";

DROP TYPE "MarketingCampaignObjective";
ALTER TYPE "MarketingCampaignObjective_new" RENAME TO "MarketingCampaignObjective";

CREATE TYPE "MarketingAttributionEntityType_new" AS ENUM (
  'WORK_ITEM',
  'LEGACY_LEAD',
  'OPPORTUNITY',
  'CUSTOMER',
  'SUBSCRIPTION',
  'INVOICE'
);

ALTER TABLE "MarketingAttribution"
ALTER COLUMN "entityType" TYPE "MarketingAttributionEntityType_new"
USING (
  CASE
    WHEN "entityType"::text = 'LEAD' AND "workItemId" IS NOT NULL THEN 'WORK_ITEM'
    WHEN "entityType"::text = 'LEAD' THEN 'LEGACY_LEAD'
    ELSE "entityType"::text
  END
)::"MarketingAttributionEntityType_new";

DROP TYPE "MarketingAttributionEntityType";
ALTER TYPE "MarketingAttributionEntityType_new" RENAME TO "MarketingAttributionEntityType";

CREATE INDEX "MarketingContactPreference_workspaceId_legacyLeadId_idx"
  ON "MarketingContactPreference"("workspaceId", "legacyLeadId");
CREATE INDEX "MarketingConsentRecord_workspaceId_legacyLeadId_recordedAt_idx"
  ON "MarketingConsentRecord"("workspaceId", "legacyLeadId", "recordedAt");
CREATE INDEX "MarketingCampaignSend_workspaceId_workItemId_createdAt_idx"
  ON "MarketingCampaignSend"("workspaceId", "workItemId", "createdAt");
CREATE INDEX "MarketingCampaignSend_workspaceId_legacyLeadId_createdAt_idx"
  ON "MarketingCampaignSend"("workspaceId", "legacyLeadId", "createdAt");
CREATE INDEX "MarketingAutomationEnrollment_workspaceId_workItemId_startedAt_idx"
  ON "MarketingAutomationEnrollment"("workspaceId", "workItemId", "startedAt");
CREATE INDEX "MarketingAutomationEnrollment_workspaceId_legacyLeadId_startedAt_idx"
  ON "MarketingAutomationEnrollment"("workspaceId", "legacyLeadId", "startedAt");
CREATE INDEX "MarketingEvent_workspaceId_itemId_occurredAt_idx"
  ON "MarketingEvent"("workspaceId", "itemId", "occurredAt");
CREATE INDEX "MarketingEvent_workspaceId_legacyLeadId_occurredAt_idx"
  ON "MarketingEvent"("workspaceId", "legacyLeadId", "occurredAt");
CREATE INDEX "MarketingLeadScoreEvent_workspaceId_workItemId_createdAt_idx"
  ON "MarketingLeadScoreEvent"("workspaceId", "workItemId", "createdAt");
CREATE INDEX "MarketingLeadScoreEvent_workspaceId_legacyLeadId_createdAt_idx"
  ON "MarketingLeadScoreEvent"("workspaceId", "legacyLeadId", "createdAt");
CREATE INDEX "MarketingAttribution_workspaceId_workItemId_happenedAt_idx"
  ON "MarketingAttribution"("workspaceId", "workItemId", "happenedAt");
CREATE INDEX "MarketingAttribution_workspaceId_legacyLeadId_happenedAt_idx"
  ON "MarketingAttribution"("workspaceId", "legacyLeadId", "happenedAt");

ALTER TABLE "MarketingCampaignSend"
  ADD CONSTRAINT "MarketingCampaignSend_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationEnrollment"
  ADD CONSTRAINT "MarketingAutomationEnrollment_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingLeadScoreEvent"
  ADD CONSTRAINT "MarketingLeadScoreEvent_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingAttribution"
  ADD CONSTRAINT "MarketingAttribution_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
