import type { Prisma } from '@prisma/client';
import type { DomainOutbox } from '@prisma/client';
import type { DomainEvent } from '@/core/events/domain-event';

export type OutboxDbClient = Prisma.TransactionClient;

export type OutboxPendingEvent = {
  id: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
  occurredAt: Date;
  processedAt: Date | null;
  retries: number;
  createdAt: Date;
  nextAttemptAt: Date;
  deadLetteredAt: Date | null;
  lastError: string | null;
};

export type OutboxRelayMetrics = {
  pendingCount: number;
  retryPendingCount: number;
  deadLetterCount: number;
  oldestPendingAgeSeconds: number | null;
};

export interface OutboxRepository {
  append(event: DomainEvent, db?: OutboxDbClient): Promise<DomainOutbox>;
  claimNextPending(maxRetries: number, db: OutboxDbClient): Promise<OutboxPendingEvent | null>;
  scheduleRetry(input: {
    outboxId: string;
    retries: number;
    nextAttemptAt: Date;
    errorMessage: string;
    db: OutboxDbClient;
  }): Promise<void>;
  markDeadLetter(input: {
    outboxId: string;
    retries: number;
    errorMessage: string;
    db: OutboxDbClient;
  }): Promise<void>;
  incrementRetries(outboxId: string, db?: OutboxDbClient): Promise<void>;
  markProcessed(outboxId: string, db?: OutboxDbClient): Promise<void>;
  getRelayMetrics(db?: OutboxDbClient): Promise<OutboxRelayMetrics>;
}
