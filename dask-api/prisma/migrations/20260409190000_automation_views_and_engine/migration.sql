ALTER TABLE "WorkspacePreferences"
ALTER COLUMN "defaultBoardMode" SET DEFAULT 'dev';

ALTER TABLE "AutomationRule"
ADD COLUMN "description" TEXT,
ADD COLUMN "triggerType" TEXT NOT NULL DEFAULT 'item.moved',
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "AutomationRule_workspaceId_enabled_idx";
CREATE INDEX "AutomationRule_workspaceId_enabled_triggerType_priority_idx"
ON "AutomationRule"("workspaceId", "enabled", "triggerType", "priority");

CREATE TABLE "AutomationExecution" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ruleId" TEXT,
  "eventName" TEXT NOT NULL,
  "eventId" TEXT,
  "status" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "context" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationView" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationViewColumn" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "viewId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationViewColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkItemViewPlacement" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "viewId" TEXT NOT NULL,
  "columnId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkItemViewPlacement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationView_workspaceId_key_key"
ON "AutomationView"("workspaceId", "key");

CREATE INDEX "AutomationView_workspaceId_isActive_position_idx"
ON "AutomationView"("workspaceId", "isActive", "position");

CREATE UNIQUE INDEX "AutomationViewColumn_viewId_key_key"
ON "AutomationViewColumn"("viewId", "key");

CREATE INDEX "AutomationViewColumn_workspaceId_viewId_isActive_position_idx"
ON "AutomationViewColumn"("workspaceId", "viewId", "isActive", "position");

CREATE UNIQUE INDEX "WorkItemViewPlacement_itemId_viewId_key"
ON "WorkItemViewPlacement"("itemId", "viewId");

CREATE INDEX "WorkItemViewPlacement_workspaceId_viewId_columnId_position_idx"
ON "WorkItemViewPlacement"("workspaceId", "viewId", "columnId", "position");

CREATE INDEX "AutomationExecution_workspaceId_createdAt_idx"
ON "AutomationExecution"("workspaceId", "createdAt");

CREATE INDEX "AutomationExecution_ruleId_createdAt_idx"
ON "AutomationExecution"("ruleId", "createdAt");

ALTER TABLE "AutomationExecution"
ADD CONSTRAINT "AutomationExecution_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationExecution"
ADD CONSTRAINT "AutomationExecution_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationView"
ADD CONSTRAINT "AutomationView_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationViewColumn"
ADD CONSTRAINT "AutomationViewColumn_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationViewColumn"
ADD CONSTRAINT "AutomationViewColumn_viewId_fkey"
FOREIGN KEY ("viewId") REFERENCES "AutomationView"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemViewPlacement"
ADD CONSTRAINT "WorkItemViewPlacement_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemViewPlacement"
ADD CONSTRAINT "WorkItemViewPlacement_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "Item"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemViewPlacement"
ADD CONSTRAINT "WorkItemViewPlacement_viewId_fkey"
FOREIGN KEY ("viewId") REFERENCES "AutomationView"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemViewPlacement"
ADD CONSTRAINT "WorkItemViewPlacement_columnId_fkey"
FOREIGN KEY ("columnId") REFERENCES "AutomationViewColumn"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemViewPlacement"
ADD CONSTRAINT "WorkItemViewPlacement_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
