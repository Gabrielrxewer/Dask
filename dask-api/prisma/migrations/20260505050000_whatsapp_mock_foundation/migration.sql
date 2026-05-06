ALTER TABLE "CommunicationTemplate"
  ADD COLUMN "providerTemplateName" TEXT,
  ADD COLUMN "providerTemplateId" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE "CommunicationTemplateVersion"
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "providerTemplateName" TEXT,
  ADD COLUMN "providerTemplateId" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "componentsJson" JSONB;

CREATE INDEX "CommunicationTemplateVersion_workspaceId_approvalStatus_updatedAt_idx"
  ON "CommunicationTemplateVersion"("workspaceId", "approvalStatus", "updatedAt");

CREATE TABLE "CommunicationConversationWindow" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunicationConversationWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationConversationWindow_workspaceId_contactId_channel_status_idx"
  ON "CommunicationConversationWindow"("workspaceId", "contactId", "channel", "status");

CREATE INDEX "CommunicationConversationWindow_workspaceId_channel_expiresAt_idx"
  ON "CommunicationConversationWindow"("workspaceId", "channel", "expiresAt");

ALTER TABLE "CommunicationConversationWindow"
  ADD CONSTRAINT "CommunicationConversationWindow_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
