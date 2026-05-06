ALTER TABLE "CommunicationProviderEvent" ADD COLUMN "contactId" TEXT;
ALTER TABLE "CommunicationProviderEvent" ADD COLUMN "contactChannelId" TEXT;

ALTER TABLE "CommunicationConversationWindow" ADD COLUMN "contactChannelId" TEXT;
ALTER TABLE "CommunicationConversationWindow" ADD COLUMN "provider" TEXT;
ALTER TABLE "CommunicationConversationWindow" ADD COLUMN "lastInboundAt" TIMESTAMP(3);
ALTER TABLE "CommunicationConversationWindow" ADD COLUMN "lastOutboundAt" TIMESTAMP(3);

CREATE INDEX "CommunicationProviderEvent_contactId_idx" ON "CommunicationProviderEvent"("contactId");
CREATE INDEX "CommunicationProviderEvent_contactChannelId_idx" ON "CommunicationProviderEvent"("contactChannelId");
CREATE INDEX "CommunicationConversationWindow_workspaceId_contactChannelId_channel_status_idx" ON "CommunicationConversationWindow"("workspaceId", "contactChannelId", "channel", "status");

ALTER TABLE "CommunicationProviderEvent" ADD CONSTRAINT "CommunicationProviderEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CommunicationContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationProviderEvent" ADD CONSTRAINT "CommunicationProviderEvent_contactChannelId_fkey" FOREIGN KEY ("contactChannelId") REFERENCES "CommunicationContactChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationConversationWindow" ADD CONSTRAINT "CommunicationConversationWindow_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CommunicationContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationConversationWindow" ADD CONSTRAINT "CommunicationConversationWindow_contactChannelId_fkey" FOREIGN KEY ("contactChannelId") REFERENCES "CommunicationContactChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
