ALTER TABLE "AutomationSideEffect" ADD COLUMN "contactId" TEXT;
ALTER TABLE "AutomationSideEffect" ADD COLUMN "contactChannelId" TEXT;

CREATE TABLE "CommunicationContact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "displayName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "primaryEmail" TEXT,
    "primaryPhone" TEXT,
    "preferredChannel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationContactChannel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "normalizedAddress" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "verifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationContactChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationInteraction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "contactChannelId" TEXT,
    "sideEffectId" TEXT,
    "providerEventId" TEXT,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationInteraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationContact_workspaceId_status_updatedAt_idx" ON "CommunicationContact"("workspaceId", "status", "updatedAt");
CREATE INDEX "CommunicationContact_workspaceId_sourceType_sourceId_idx" ON "CommunicationContact"("workspaceId", "sourceType", "sourceId");
CREATE INDEX "CommunicationContact_workspaceId_primaryEmail_idx" ON "CommunicationContact"("workspaceId", "primaryEmail");
CREATE INDEX "CommunicationContact_workspaceId_primaryPhone_idx" ON "CommunicationContact"("workspaceId", "primaryPhone");

CREATE UNIQUE INDEX "CommunicationContactChannel_workspaceId_channel_normalizedAddress_key" ON "CommunicationContactChannel"("workspaceId", "channel", "normalizedAddress");
CREATE INDEX "CommunicationContactChannel_workspaceId_contactId_channel_idx" ON "CommunicationContactChannel"("workspaceId", "contactId", "channel");
CREATE INDEX "CommunicationContactChannel_workspaceId_channel_status_idx" ON "CommunicationContactChannel"("workspaceId", "channel", "status");

CREATE INDEX "CommunicationInteraction_workspaceId_contactId_occurredAt_idx" ON "CommunicationInteraction"("workspaceId", "contactId", "occurredAt");
CREATE INDEX "CommunicationInteraction_workspaceId_sideEffectId_idx" ON "CommunicationInteraction"("workspaceId", "sideEffectId");
CREATE INDEX "CommunicationInteraction_workspaceId_providerEventId_idx" ON "CommunicationInteraction"("workspaceId", "providerEventId");
CREATE INDEX "AutomationSideEffect_contactId_idx" ON "AutomationSideEffect"("contactId");
CREATE INDEX "AutomationSideEffect_contactChannelId_idx" ON "AutomationSideEffect"("contactChannelId");

ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CommunicationContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationSideEffect" ADD CONSTRAINT "AutomationSideEffect_contactChannelId_fkey" FOREIGN KEY ("contactChannelId") REFERENCES "CommunicationContactChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationContact" ADD CONSTRAINT "CommunicationContact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationContactChannel" ADD CONSTRAINT "CommunicationContactChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationContactChannel" ADD CONSTRAINT "CommunicationContactChannel_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CommunicationContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CommunicationContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_contactChannelId_fkey" FOREIGN KEY ("contactChannelId") REFERENCES "CommunicationContactChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_sideEffectId_fkey" FOREIGN KEY ("sideEffectId") REFERENCES "AutomationSideEffect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationInteraction" ADD CONSTRAINT "CommunicationInteraction_providerEventId_fkey" FOREIGN KEY ("providerEventId") REFERENCES "CommunicationProviderEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
