ALTER TABLE "AutomationWorkflow"
  ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN "nativeKey" TEXT,
  ADD COLUMN "nativeDomain" TEXT,
  ADD COLUMN "isSystemManaged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "editableMode" TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN "installedAt" TIMESTAMP(3),
  ADD COLUMN "installedById" TEXT,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "AutomationWorkflow_workspaceId_nativeKey_key"
  ON "AutomationWorkflow"("workspaceId", "nativeKey");

CREATE INDEX "AutomationWorkflow_workspaceId_origin_nativeDomain_idx"
  ON "AutomationWorkflow"("workspaceId", "origin", "nativeDomain");
