CREATE TABLE "AutomationWorkflow" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currentVersionId" TEXT,
  "legacyRuleId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationWorkflowVersion" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "definitionJson" JSONB NOT NULL,
  "graphNodesJson" JSONB NOT NULL,
  "graphEdgesJson" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutomationWorkflowVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "triggerRefId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "contextJson" JSONB,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "errorJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationStepRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "inputJson" JSONB,
  "outputJson" JSONB,
  "errorJson" JSONB,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationStepRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationScheduledStep" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stepRunId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "executeAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationScheduledStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationWorkflow_currentVersionId_key"
ON "AutomationWorkflow"("currentVersionId");

CREATE INDEX "AutomationWorkflow_workspaceId_status_updatedAt_idx"
ON "AutomationWorkflow"("workspaceId", "status", "updatedAt");

CREATE INDEX "AutomationWorkflow_workspaceId_legacyRuleId_idx"
ON "AutomationWorkflow"("workspaceId", "legacyRuleId");

CREATE UNIQUE INDEX "AutomationWorkflowVersion_workflowId_version_key"
ON "AutomationWorkflowVersion"("workflowId", "version");

CREATE INDEX "AutomationWorkflowVersion_workspaceId_status_createdAt_idx"
ON "AutomationWorkflowVersion"("workspaceId", "status", "createdAt");

CREATE INDEX "AutomationWorkflowVersion_workflowId_status_version_idx"
ON "AutomationWorkflowVersion"("workflowId", "status", "version");

CREATE INDEX "AutomationWorkflowVersion_workspaceId_publishedAt_idx"
ON "AutomationWorkflowVersion"("workspaceId", "publishedAt");

CREATE INDEX "AutomationRun_workspaceId_status_createdAt_idx"
ON "AutomationRun"("workspaceId", "status", "createdAt");

CREATE INDEX "AutomationRun_workflowId_createdAt_idx"
ON "AutomationRun"("workflowId", "createdAt");

CREATE INDEX "AutomationRun_workflowVersionId_createdAt_idx"
ON "AutomationRun"("workflowVersionId", "createdAt");

CREATE INDEX "AutomationRun_workspaceId_triggerType_triggerRefId_idx"
ON "AutomationRun"("workspaceId", "triggerType", "triggerRefId");

CREATE UNIQUE INDEX "AutomationStepRun_runId_nodeId_attempt_key"
ON "AutomationStepRun"("runId", "nodeId", "attempt");

CREATE UNIQUE INDEX "AutomationStepRun_workspaceId_idempotencyKey_key"
ON "AutomationStepRun"("workspaceId", "idempotencyKey");

CREATE INDEX "AutomationStepRun_workspaceId_status_createdAt_idx"
ON "AutomationStepRun"("workspaceId", "status", "createdAt");

CREATE INDEX "AutomationStepRun_runId_status_createdAt_idx"
ON "AutomationStepRun"("runId", "status", "createdAt");

CREATE INDEX "AutomationStepRun_runId_nodeId_idx"
ON "AutomationStepRun"("runId", "nodeId");

CREATE INDEX "AutomationScheduledStep_workspaceId_status_executeAt_idx"
ON "AutomationScheduledStep"("workspaceId", "status", "executeAt");

CREATE INDEX "AutomationScheduledStep_status_executeAt_idx"
ON "AutomationScheduledStep"("status", "executeAt");

CREATE INDEX "AutomationScheduledStep_runId_status_idx"
ON "AutomationScheduledStep"("runId", "status");

CREATE INDEX "AutomationScheduledStep_stepRunId_idx"
ON "AutomationScheduledStep"("stepRunId");

ALTER TABLE "AutomationWorkflow"
ADD CONSTRAINT "AutomationWorkflow_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationWorkflow"
ADD CONSTRAINT "AutomationWorkflow_currentVersionId_fkey"
FOREIGN KEY ("currentVersionId") REFERENCES "AutomationWorkflowVersion"("id")
ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "AutomationWorkflow"
ADD CONSTRAINT "AutomationWorkflow_legacyRuleId_fkey"
FOREIGN KEY ("legacyRuleId") REFERENCES "AutomationRule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationWorkflow"
ADD CONSTRAINT "AutomationWorkflow_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationWorkflowVersion"
ADD CONSTRAINT "AutomationWorkflowVersion_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationWorkflowVersion"
ADD CONSTRAINT "AutomationWorkflowVersion_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationWorkflowVersion"
ADD CONSTRAINT "AutomationWorkflowVersion_publishedById_fkey"
FOREIGN KEY ("publishedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationRun"
ADD CONSTRAINT "AutomationRun_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRun"
ADD CONSTRAINT "AutomationRun_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRun"
ADD CONSTRAINT "AutomationRun_workflowVersionId_fkey"
FOREIGN KEY ("workflowVersionId") REFERENCES "AutomationWorkflowVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AutomationStepRun"
ADD CONSTRAINT "AutomationStepRun_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationStepRun"
ADD CONSTRAINT "AutomationStepRun_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationScheduledStep"
ADD CONSTRAINT "AutomationScheduledStep_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationScheduledStep"
ADD CONSTRAINT "AutomationScheduledStep_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationScheduledStep"
ADD CONSTRAINT "AutomationScheduledStep_stepRunId_fkey"
FOREIGN KEY ("stepRunId") REFERENCES "AutomationStepRun"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
