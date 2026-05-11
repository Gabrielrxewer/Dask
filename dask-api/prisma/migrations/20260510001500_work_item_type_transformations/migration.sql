-- WorkItem type transformations keep commercial Lead/Signal behavior in the WorkItem domain.
CREATE TABLE "WorkItemTypeTransformation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "fromTypeId" TEXT NOT NULL,
  "toTypeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "mode" TEXT NOT NULL DEFAULT 'same_work_item_type_change',
  "fieldCompatibilityMode" TEXT NOT NULL DEFAULT 'strict_superset',
  "defaultValuesForNewFields" JSONB,
  "stateMapping" JSONB,
  "permission" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkItemTypeTransformation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkItemTypeTransformation_workspaceId_fromTypeId_toTypeId_mode_key"
  ON "WorkItemTypeTransformation"("workspaceId", "fromTypeId", "toTypeId", "mode");
CREATE INDEX "WorkItemTypeTransformation_workspaceId_enabled_idx"
  ON "WorkItemTypeTransformation"("workspaceId", "enabled");
CREATE INDEX "WorkItemTypeTransformation_workspaceId_fromTypeId_idx"
  ON "WorkItemTypeTransformation"("workspaceId", "fromTypeId");
CREATE INDEX "WorkItemTypeTransformation_workspaceId_toTypeId_idx"
  ON "WorkItemTypeTransformation"("workspaceId", "toTypeId");

ALTER TABLE "WorkItemTypeTransformation"
  ADD CONSTRAINT "WorkItemTypeTransformation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkItemTypeTransformation"
  ADD CONSTRAINT "WorkItemTypeTransformation_fromTypeId_fkey"
  FOREIGN KEY ("fromTypeId") REFERENCES "WorkItemType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkItemTypeTransformation"
  ADD CONSTRAINT "WorkItemTypeTransformation_toTypeId_fkey"
  FOREIGN KEY ("toTypeId") REFERENCES "WorkItemType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
