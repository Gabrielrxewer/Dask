-- Outbox retry/backoff + dead-letter support
ALTER TABLE "DomainOutbox"
ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deadLetteredAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT;

CREATE INDEX "DomainOutbox_processedAt_deadLetteredAt_nextAttemptAt_idx"
ON "DomainOutbox"("processedAt", "deadLetteredAt", "nextAttemptAt");
