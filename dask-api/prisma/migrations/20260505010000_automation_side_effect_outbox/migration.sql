-- Automation Studio Foundation 4: durable side effect outbox.
CREATE TABLE "AutomationSideEffect" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepRunId" TEXT NOT NULL,
    "sideEffectType" TEXT NOT NULL,
    "channel" TEXT,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "errorJson" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationSideEffect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationSideEffect_workspaceId_idempotencyKey_key" ON "AutomationSideEffect"("workspaceId", "idempotencyKey");
CREATE INDEX "AutomationSideEffect_workspaceId_status_nextAttemptAt_idx" ON "AutomationSideEffect"("workspaceId", "status", "nextAttemptAt");
CREATE INDEX "AutomationSideEffect_status_nextAttemptAt_idx" ON "AutomationSideEffect"("status", "nextAttemptAt");
CREATE INDEX "AutomationSideEffect_runId_status_idx" ON "AutomationSideEffect"("runId", "status");
CREATE INDEX "AutomationSideEffect_stepRunId_idx" ON "AutomationSideEffect"("stepRunId");

ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "AutomationStepRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
