-- Automation Studio Foundation 13: AI guardrails and human approval.

CREATE TABLE "AutomationApprovalRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepRunId" TEXT NOT NULL,
    "contactId" TEXT,
    "workItemId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payloadJson" JSONB,
    "decisionJson" JSONB,
    "requestedBy" TEXT,
    "reviewedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationApprovalRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutomationSideEffect" ADD COLUMN "approvalRequestId" TEXT;

CREATE INDEX "AutomationApprovalRequest_workspaceId_status_requestedAt_idx" ON "AutomationApprovalRequest"("workspaceId", "status", "requestedAt");
CREATE INDEX "AutomationApprovalRequest_workspaceId_runId_status_idx" ON "AutomationApprovalRequest"("workspaceId", "runId", "status");
CREATE INDEX "AutomationApprovalRequest_stepRunId_idx" ON "AutomationApprovalRequest"("stepRunId");
CREATE INDEX "AutomationApprovalRequest_contactId_idx" ON "AutomationApprovalRequest"("contactId");
CREATE INDEX "AutomationApprovalRequest_workItemId_idx" ON "AutomationApprovalRequest"("workItemId");
CREATE INDEX "AutomationSideEffect_approvalRequestId_idx" ON "AutomationSideEffect"("approvalRequestId");

ALTER TABLE "AutomationApprovalRequest" ADD CONSTRAINT "AutomationApprovalRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationApprovalRequest" ADD CONSTRAINT "AutomationApprovalRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationApprovalRequest" ADD CONSTRAINT "AutomationApprovalRequest_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "AutomationStepRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationApprovalRequest" ADD CONSTRAINT "AutomationApprovalRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CommunicationContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationApprovalRequest" ADD CONSTRAINT "AutomationApprovalRequest_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "AutomationApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
