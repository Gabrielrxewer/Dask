-- Add inbox read/dismiss state to MarketingEvent for the Signals Inbox feature.

ALTER TABLE "MarketingEvent"
ADD COLUMN "seenAt" TIMESTAMP(3),
ADD COLUMN "dismissedAt" TIMESTAMP(3);

CREATE INDEX "MarketingEvent_workspaceId_type_dismissedAt_occurredAt_idx"
ON "MarketingEvent"("workspaceId", "type", "dismissedAt", "occurredAt");
