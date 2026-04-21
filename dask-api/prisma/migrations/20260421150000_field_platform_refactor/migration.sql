-- Extend custom field type catalog for platform-driven field rendering
ALTER TYPE "CustomFieldType" ADD VALUE IF NOT EXISTS 'CHECKLIST';
ALTER TYPE "CustomFieldType" ADD VALUE IF NOT EXISTS 'PRIORITY';
ALTER TYPE "CustomFieldType" ADD VALUE IF NOT EXISTS 'STATUS';
ALTER TYPE "CustomFieldType" ADD VALUE IF NOT EXISTS 'TAG';
ALTER TYPE "CustomFieldType" ADD VALUE IF NOT EXISTS 'SCHEDULE';
ALTER TYPE "CustomFieldType" ADD VALUE IF NOT EXISTS 'WORK_ITEM_TYPE';

-- Enrich field definitions with platform metadata
ALTER TABLE "CustomFieldDefinition"
ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isEditable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "isRemovable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "defaultValue" JSONB;

-- Bind fields to work item types and display contexts
CREATE TABLE IF NOT EXISTS "WorkItemFieldBinding" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "displayContext" TEXT NOT NULL DEFAULT 'detail',
  "position" INTEGER NOT NULL DEFAULT 0,
  "section" TEXT,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isRequiredOverride" BOOLEAN,
  "isReadonlyOverride" BOOLEAN,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkItemFieldBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkItemFieldBinding_typeId_fieldId_displayContext_key"
ON "WorkItemFieldBinding"("typeId", "fieldId", "displayContext");

CREATE INDEX IF NOT EXISTS "WorkItemFieldBinding_workspaceId_typeId_displayContext_position_idx"
ON "WorkItemFieldBinding"("workspaceId", "typeId", "displayContext", "position");

CREATE INDEX IF NOT EXISTS "WorkItemFieldBinding_workspaceId_fieldId_displayContext_idx"
ON "WorkItemFieldBinding"("workspaceId", "fieldId", "displayContext");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkItemFieldBinding_workspaceId_fkey'
  ) THEN
    ALTER TABLE "WorkItemFieldBinding"
    ADD CONSTRAINT "WorkItemFieldBinding_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkItemFieldBinding_typeId_fkey'
  ) THEN
    ALTER TABLE "WorkItemFieldBinding"
    ADD CONSTRAINT "WorkItemFieldBinding_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "WorkItemType"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkItemFieldBinding_fieldId_fkey'
  ) THEN
    ALTER TABLE "WorkItemFieldBinding"
    ADD CONSTRAINT "WorkItemFieldBinding_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
