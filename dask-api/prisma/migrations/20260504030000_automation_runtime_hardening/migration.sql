ALTER TABLE "AutomationScheduledStep"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'resume',
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "AutomationScheduledStep_workspaceId_idempotencyKey_key"
ON "AutomationScheduledStep"("workspaceId", "idempotencyKey");

CREATE INDEX "AutomationScheduledStep_workspaceId_purpose_status_executeAt_idx"
ON "AutomationScheduledStep"("workspaceId", "purpose", "status", "executeAt");

CREATE TABLE "AutomationRunEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stepRunId" TEXT,
  "eventType" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "message" TEXT NOT NULL,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutomationRunEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRunEvent_workspaceId_runId_createdAt_idx"
ON "AutomationRunEvent"("workspaceId", "runId", "createdAt");

CREATE INDEX "AutomationRunEvent_runId_eventType_createdAt_idx"
ON "AutomationRunEvent"("runId", "eventType", "createdAt");

CREATE INDEX "AutomationRunEvent_stepRunId_createdAt_idx"
ON "AutomationRunEvent"("stepRunId", "createdAt");

CREATE INDEX "AutomationRunEvent_workspaceId_eventType_createdAt_idx"
ON "AutomationRunEvent"("workspaceId", "eventType", "createdAt");

ALTER TABLE "AutomationRunEvent"
ADD CONSTRAINT "AutomationRunEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRunEvent"
ADD CONSTRAINT "AutomationRunEvent_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRunEvent"
ADD CONSTRAINT "AutomationRunEvent_stepRunId_fkey"
FOREIGN KEY ("stepRunId") REFERENCES "AutomationStepRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
