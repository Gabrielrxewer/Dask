-- Retire the active legacy Lead flow.
-- Lead rows are kept for historical compatibility, but eligible records are copied
-- into the official commercial WorkItem flow. New code must use Item/Customer.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH legacy_leads AS (
  SELECT l.*
  FROM "Lead" l
  WHERE NOT EXISTS (
    SELECT 1
    FROM "Item" i
    WHERE i."workspaceId" = l."workspaceId"
      AND (
        i."metadata" #>> '{legacyLead,leadId}' = l."id"
        OR i."fields" #>> '{legacyLeadId}' = l."id"
      )
  )
),
resolved AS (
  SELECT
    l.*,
    board."id" AS "targetBoardId",
    item_type."id" AS "targetTypeId",
    item_type."slug" AS "targetTypeSlug",
    workflow_state."id" AS "targetStateId",
    workflow_state."slug" AS "targetStateSlug",
    board_column."id" AS "targetColumnId",
    membership."userId" AS "targetCreatedBy",
    ROW_NUMBER() OVER (
      PARTITION BY l."workspaceId", board_column."id"
      ORDER BY l."createdAt", l."id"
    ) AS "legacyPosition"
  FROM legacy_leads l
  JOIN LATERAL (
    SELECT b."id"
    FROM "Board" b
    WHERE b."workspaceId" = l."workspaceId"
    ORDER BY b."createdAt" ASC
    LIMIT 1
  ) board ON TRUE
  JOIN LATERAL (
    SELECT t."id", t."slug"
    FROM "WorkItemType" t
    WHERE t."workspaceId" = l."workspaceId"
      AND t."isActive" = TRUE
    ORDER BY
      CASE
        WHEN t."slug" = 'commercial' THEN 0
        WHEN t."slug" = 'lead' THEN 1
        ELSE 2
      END,
      t."position" ASC
    LIMIT 1
  ) item_type ON TRUE
  JOIN LATERAL (
    SELECT
      CASE l."status"::text
        WHEN 'QUALIFIED' THEN 'lead_qualification'
        WHEN 'DISTRIBUTED' THEN 'lead_qualification'
        WHEN 'FOLLOW_UP' THEN 'follow_up'
        WHEN 'NURTURING' THEN 'lead_new'
        WHEN 'CONVERTED' THEN 'paid_active'
        WHEN 'LOST' THEN 'lost'
        ELSE 'lead_new'
      END AS "slug"
  ) desired_state ON TRUE
  JOIN LATERAL (
    SELECT s."id", s."slug"
    FROM "WorkflowState" s
    WHERE s."workspaceId" = l."workspaceId"
      AND s."isActive" = TRUE
    ORDER BY
      CASE
        WHEN s."slug" = desired_state."slug" THEN 0
        WHEN s."slug" = 'lead_new' THEN 1
        ELSE 2
      END,
      s."position" ASC
    LIMIT 1
  ) workflow_state ON TRUE
  JOIN LATERAL (
    SELECT c."id"
    FROM "BoardColumn" c
    WHERE c."workspaceId" = l."workspaceId"
      AND c."isActive" = TRUE
    ORDER BY
      CASE WHEN c."slug" = workflow_state."slug" THEN 0 ELSE 1 END,
      c."position" ASC
    LIMIT 1
  ) board_column ON TRUE
  JOIN LATERAL (
    SELECT wm."userId"
    FROM "WorkspaceMembership" wm
    WHERE wm."workspaceId" = l."workspaceId"
    ORDER BY
      CASE WHEN wm."role"::text = 'OWNER' THEN 0 ELSE 1 END,
      wm."createdAt" ASC
    LIMIT 1
  ) membership ON TRUE
)
INSERT INTO "Item" (
  "id",
  "boardId",
  "workspaceId",
  "columnId",
  "boardColumnId",
  "type",
  "typeId",
  "stateId",
  "title",
  "description",
  "status",
  "fields",
  "metadata",
  "assigneeId",
  "position",
  "createdBy",
  "updatedBy",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  r."targetBoardId",
  r."workspaceId",
  r."targetColumnId",
  r."targetColumnId",
  r."targetTypeSlug",
  r."targetTypeId",
  r."targetStateId",
  COALESCE(
    NULLIF(r."fullName", ''),
    NULLIF(CONCAT_WS(' ', r."firstName", r."lastName"), ''),
    NULLIF(r."email", ''),
    NULLIF(r."companyName", ''),
    'Lead legado'
  ),
  r."notes",
  r."targetStateSlug",
  jsonb_strip_nulls(jsonb_build_object(
    'legacyLeadId', r."id",
    'customerId', r."customerId",
    'contactName', COALESCE(NULLIF(r."fullName", ''), NULLIF(CONCAT_WS(' ', r."firstName", r."lastName"), '')),
    'contactEmail', r."email",
    'contactPhone', r."phone",
    'companyName', r."companyName",
    'jobTitle', r."jobTitle",
    'website', r."website",
    'city', r."city",
    'state', r."state",
    'country', r."country",
    'source', COALESCE(r."captureSource"::text, r."externalSource"::text),
    'externalSource', r."externalSource"::text,
    'externalId', r."externalId",
    'interest', r."interest",
    'score', r."score",
    'temperature', r."temperature",
    'estimatedValue', r."estimatedValue",
    'lastContactAt', r."lastContactAt",
    'nextFollowUpAt', r."nextFollowUpAt"
  )),
  (
    CASE
      WHEN jsonb_typeof(COALESCE(r."metadata"::jsonb, '{}'::jsonb)) = 'object'
      THEN COALESCE(r."metadata"::jsonb, '{}'::jsonb)
      ELSE '{}'::jsonb
    END
    || jsonb_build_object(
      'legacyLead',
      jsonb_build_object(
        'leadId', r."id",
        'sourceTable', 'Lead',
        'migratedAt', NOW(),
        'status', r."status"::text,
        'qualificationStatus', r."qualificationStatus"::text,
        'distributionStatus', r."distributionStatus"::text
      )
    )
  ),
  r."ownerUserId",
  100000 + r."legacyPosition",
  r."targetCreatedBy",
  COALESCE(r."updatedByUserId", r."createdByUserId", r."targetCreatedBy"),
  r."createdAt",
  r."updatedAt"
FROM resolved r;

INSERT INTO "ItemHistory" (
  "id",
  "itemId",
  "eventName",
  "payload",
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  i."id",
  'legacy_lead.' || LOWER(a."type"::text),
  jsonb_strip_nulls(jsonb_build_object(
    'legacyLeadActivityId', a."id",
    'legacyLeadId', a."leadId",
    'title', a."title",
    'description', a."description",
    'actorUserId', a."actorUserId",
    'payload', a."payload",
    'occurredAt', a."occurredAt"
  )),
  a."createdAt"
FROM "LeadActivity" a
JOIN "Item" i
  ON i."workspaceId" = a."workspaceId"
  AND i."metadata" #>> '{legacyLead,leadId}' = a."leadId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "ItemHistory" h
  WHERE h."itemId" = i."id"
    AND h."payload" #>> '{legacyLeadActivityId}' = a."id"
);
