ALTER TABLE "TelemetryEvent"
ADD COLUMN "durationNs" BIGINT;

CREATE INDEX "TelemetryEvent_durationNs_occurredAt_idx"
ON "TelemetryEvent"("durationNs", "occurredAt");
