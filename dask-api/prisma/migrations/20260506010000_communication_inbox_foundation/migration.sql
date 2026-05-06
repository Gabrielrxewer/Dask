CREATE TABLE "CommunicationConversation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "contactChannelId" TEXT,
  "primaryChannel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "assignedToId" TEXT,
  "workItemId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastInboundAt" TIMESTAMP(3),
  "lastOutboundAt" TIMESTAMP(3),
  "lastMessagePreview" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "CommunicationConversation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutomationSideEffect" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "AutomationApprovalRequest" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "approvalRequestId" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "runId" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "stepRunId" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "workItemId" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "provider" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "textPreview" TEXT;
ALTER TABLE "CommunicationInteraction" ADD COLUMN "bodyJson" JSONB;

CREATE INDEX "CommunicationConversation_workspaceId_status_lastMessageAt_idx" ON "CommunicationConversation"("workspaceId", "status", "lastMessageAt");
CREATE INDEX "CommunicationConversation_workspaceId_contactId_primaryChannel_status_idx" ON "CommunicationConversation"("workspaceId", "contactId", "primaryChannel", "status");
CREATE INDEX "CommunicationConversation_workspaceId_contactChannelId_status_idx" ON "CommunicationConversation"("workspaceId", "contactChannelId", "status");
CREATE INDEX "CommunicationConversation_workspaceId_workItemId_status_idx" ON "CommunicationConversation"("workspaceId", "workItemId", "status");
CREATE INDEX "CommunicationConversation_workspaceId_assignedToId_status_idx" ON "CommunicationConversation"("workspaceId", "assignedToId", "status");
CREATE INDEX "CommunicationConversation_workspaceId_lastInboundAt_idx" ON "CommunicationConversation"("workspaceId", "lastInboundAt");
CREATE INDEX "AutomationSideEffect_conversationId_idx" ON "AutomationSideEffect"("conversationId");
CREATE INDEX "AutomationApprovalRequest_conversationId_idx" ON "AutomationApprovalRequest"("conversationId");
CREATE INDEX "CommunicationInteraction_workspaceId_conversationId_occurredAt_idx" ON "CommunicationInteraction"("workspaceId", "conversationId", "occurredAt");
CREATE INDEX "CommunicationInteraction_workspaceId_approvalRequestId_idx" ON "CommunicationInteraction"("workspaceId", "approvalRequestId");
CREATE INDEX "CommunicationInteraction_workspaceId_runId_idx" ON "CommunicationInteraction"("workspaceId", "runId");
CREATE INDEX "CommunicationInteraction_workspaceId_workItemId_idx" ON "CommunicationInteraction"("workspaceId", "workItemId");

ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CommunicationContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_contactChannelId_fkey" FOREIGN KEY ("contactChannelId") REFERENCES "CommunicationContactChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CommunicationConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationApprovalRequest" ADD CONSTRAINT "AutomationApprovalRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CommunicationConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CommunicationConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "AutomationApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_stepRunId_fkey" FOREIGN KEY ("stepRunId") REFERENCES "AutomationStepRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
