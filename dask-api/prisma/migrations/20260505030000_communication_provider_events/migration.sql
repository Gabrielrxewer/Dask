CREATE TABLE "CommunicationProviderEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "provider" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "sideEffectId" TEXT,
    "payloadJson" JSONB,
    "normalizedJson" JSONB,
    "errorJson" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationProviderEvent_provider_providerEventId_key" ON "CommunicationProviderEvent"("provider", "providerEventId");
CREATE INDEX "CommunicationProviderEvent_workspaceId_receivedAt_idx" ON "CommunicationProviderEvent"("workspaceId", "receivedAt");
CREATE INDEX "CommunicationProviderEvent_provider_channel_providerMessageId_idx" ON "CommunicationProviderEvent"("provider", "channel", "providerMessageId");
CREATE INDEX "CommunicationProviderEvent_sideEffectId_idx" ON "CommunicationProviderEvent"("sideEffectId");
CREATE INDEX "CommunicationProviderEvent_eventType_receivedAt_idx" ON "CommunicationProviderEvent"("eventType", "receivedAt");
CREATE INDEX "CommunicationProviderEvent_status_receivedAt_idx" ON "CommunicationProviderEvent"("status", "receivedAt");

ALTER TABLE "CommunicationProviderEvent" ADD CONSTRAINT "CommunicationProviderEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationProviderEvent" ADD CONSTRAINT "CommunicationProviderEvent_sideEffectId_fkey" FOREIGN KEY ("sideEffectId") REFERENCES "AutomationSideEffect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
