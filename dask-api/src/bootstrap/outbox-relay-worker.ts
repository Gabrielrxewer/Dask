import { AuditSeverity, type Prisma, type PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import type { DomainEvent } from '@/core/events/domain-event';
import type { OutboxPendingEvent } from '@/core/events/outbox-repository';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import { recordTelemetryEvent } from '@/core/telemetry/telemetry-recorder';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';
import { BullMqJobQueue } from '@/infra/queue/bullmq-job-queue';
import { AiEventDispatcher } from '@/modules/ai/application/ai-event-dispatcher';
import { SearchEventDispatcher } from '@/modules/search/application/search-event-dispatcher';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

const relayLogger = getLogger('outbox-relay');
const relayDebug = createDebugLogger('outbox.relay');

function normalizePayload(payload: Prisma.JsonValue): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function extractActorId(payload: Record<string, unknown>): string | null {
  return typeof payload.requestedBy === 'string' ? payload.requestedBy : null;
}

function extractWorkspaceId(payload: Record<string, unknown>): string | null {
  return typeof payload.workspaceId === 'string' ? payload.workspaceId : null;
}

function extractRouteFromPayload(payload: Record<string, unknown>): string | null {
  return typeof payload.route === 'string' ? payload.route : null;
}

function toDomainEvent(row: OutboxPendingEvent): DomainEvent {
  return {
    id: row.id,
    name: row.eventName,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    occurredAt: row.occurredAt,
    payload: normalizePayload(row.payload)
  };
}

function toRetryDelayMs(retries: number): number {
  const baseDelayMs = 1_000;
  const maxDelayMs = 5 * 60 * 1_000;
  return Math.min(baseDelayMs * 2 ** Math.max(retries - 1, 0), maxDelayMs);
}

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.slice(0, 2000);
}

async function recordAuditEvent(
  prisma: PrismaClient | Prisma.TransactionClient,
  event: DomainEvent
): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  await prisma.auditEvent.upsert({
    where: { id: event.id },
    update: {},
    create: {
      id: event.id,
      eventName: event.name,
      severity: AuditSeverity.INFO,
      actorId: extractActorId(payload),
      workspaceId: extractWorkspaceId(payload),
      metadata: payload as Prisma.InputJsonValue,
      happenedAt: event.occurredAt
    }
  });
}

export type RelayWorkerHandle = {
  close(): Promise<void>;
};

export function startOutboxRelayWorker(prisma: PrismaClient): RelayWorkerHandle {
  const outboxRepository = new PrismaOutboxRepository(prisma);
  const jobQueue = new BullMqJobQueue();
  const aiDispatcher = new AiEventDispatcher(jobQueue);
  const searchDispatcher = new SearchEventDispatcher(jobQueue);
  let running = false;
  let closing = false;
  let lastMetricsLogAt = 0;

  const processNextEvent = async (): Promise<boolean> => {
    return prisma.$transaction(async (db) => {
      const row = await outboxRepository.claimNextPending(env.OUTBOX_RELAY_MAX_RETRIES, db);
      if (!row) {
        return false;
      }

      const event = toDomainEvent(row);
      const payload = event.payload as Record<string, unknown>;
      relayDebug.log(
        {
          outboxId: row.id,
          eventName: row.eventName,
          retries: row.retries
        },
        'Outbox event claimed for processing'
      );
      try {
        void recordTelemetryEvent({
          category: 'domain',
          eventName: event.name,
          success: true,
          userId: extractActorId(payload),
          workspaceId: extractWorkspaceId(payload),
          route: extractRouteFromPayload(payload),
          metadata: {
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId
          }
        });
        await recordAuditEvent(db, event);
        await aiDispatcher.dispatch(event, row.id);
        await searchDispatcher.dispatch(event, row.id);
        await outboxRepository.markProcessed(row.id, db);
      } catch (error) {
        const nextRetries = row.retries + 1;
        const errorMessage = sanitizeErrorMessage(error);
        void recordTelemetryEvent({
          category: 'domain',
          eventName: `${event.name}.failed`,
          success: false,
          userId: extractActorId(payload),
          workspaceId: extractWorkspaceId(payload),
          reason: errorMessage,
          metadata: {
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            retries: nextRetries
          }
        });
        if (nextRetries >= env.OUTBOX_RELAY_MAX_RETRIES) {
          await outboxRepository.markDeadLetter({
            outboxId: row.id,
            retries: nextRetries,
            errorMessage,
            db
          });
        } else {
          const nextAttemptAt = new Date(Date.now() + toRetryDelayMs(nextRetries));
          await outboxRepository.scheduleRetry({
            outboxId: row.id,
            retries: nextRetries,
            nextAttemptAt,
            errorMessage,
            db
          });
        }

        relayLogger.error(
          {
            event: 'outbox.relay.failed',
            outboxId: row.id,
            eventName: row.eventName,
            retries: nextRetries,
            err: error
          },
          'Outbox relay failed'
        );
      }

      return true;
    });
  };

  const tick = async (): Promise<void> => {
    if (running || closing) {
      return;
    }

    running = true;
    try {
      while (!closing) {
        let processedInCycle = 0;

        while (!closing && processedInCycle < env.OUTBOX_RELAY_BATCH_SIZE) {
          const processed = await processNextEvent();
          if (!processed) {
            break;
          }
          processedInCycle += 1;
        }

        if (processedInCycle < env.OUTBOX_RELAY_BATCH_SIZE) {
          break;
        }
      }

      const now = Date.now();
      if (now - lastMetricsLogAt >= 60_000) {
        const metrics = await outboxRepository.getRelayMetrics();
        relayLogger.info(
          {
            event: 'outbox.relay.metrics',
            pending: metrics.pendingCount,
            retryPending: metrics.retryPendingCount,
            deadLetter: metrics.deadLetterCount,
            oldestPendingAgeSeconds: metrics.oldestPendingAgeSeconds
          },
          'Outbox relay metrics'
        );
        lastMetricsLogAt = now;
      }
    } catch (error) {
      relayLogger.error(
        {
          event: 'outbox.relay.tick_failed',
          retryInSeconds: Math.floor(env.OUTBOX_RELAY_INTERVAL_MS / 1000),
          err: error
        },
        'Outbox relay tick failed'
      );
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, env.OUTBOX_RELAY_INTERVAL_MS);
  timer.unref?.();

  void tick();

  return {
    close: async () => {
      closing = true;
      clearInterval(timer);
      const waitUntil = Date.now() + 3_000;

      while (running && Date.now() < waitUntil) {
        await sleep(25);
      }

      if (running) {
        relayLogger.warn('Outbox relay did not stop before shutdown timeout');
      }
    }
  };
}
