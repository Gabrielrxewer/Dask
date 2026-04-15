import { type DomainOutbox, Prisma, type PrismaClient } from '@prisma/client';
import type { DomainEvent } from '@/core/events/domain-event';
import type {
  OutboxDbClient,
  OutboxPendingEvent,
  OutboxRelayMetrics,
  OutboxRepository
} from '@/core/events/outbox-repository';

export class PrismaOutboxRepository implements OutboxRepository {
  private relayColumnsAvailable: boolean | null = null;

  public constructor(private readonly prisma: PrismaClient) {}

  private async ensureRelayColumnsAvailability(): Promise<boolean> {
    if (this.relayColumnsAvailable !== null) {
      return this.relayColumnsAvailable;
    }

    try {
      await this.prisma.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 AS ok
        FROM "DomainOutbox"
        WHERE "deadLetteredAt" IS NULL
          AND "nextAttemptAt" IS NOT NULL
          AND ("lastError" IS NULL OR "lastError" IS NOT NULL)
        LIMIT 1
      `;
      this.relayColumnsAvailable = true;
    } catch (error) {
      if (!this.isMissingOutboxRelayColumnError(error)) {
        throw error;
      }
      this.relayColumnsAvailable = false;
    }

    return this.relayColumnsAvailable;
  }

  public append(event: DomainEvent, db?: OutboxDbClient): Promise<DomainOutbox> {
    const client = db ?? this.prisma;

    return client.domainOutbox.create({
      data: {
        eventName: event.name,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt: event.occurredAt
      }
    });
  }

  public async markProcessed(outboxId: string, db?: OutboxDbClient): Promise<void> {
    const client = db ?? this.prisma;

    await client.domainOutbox.updateMany({
      where: { id: outboxId, processedAt: null },
      data: { processedAt: new Date() }
    });
  }

  public async claimNextPending(maxRetries: number, db: OutboxDbClient): Promise<OutboxPendingEvent | null> {
    const hasRelayColumns = await this.ensureRelayColumnsAvailability();
    const claimWithRelayColumns = () =>
      db.$queryRaw<OutboxPendingEvent[]>`
        SELECT *
        FROM "DomainOutbox"
        WHERE "processedAt" IS NULL
          AND "deadLetteredAt" IS NULL
          AND "retries" < ${maxRetries}
          AND "nextAttemptAt" <= NOW()
        ORDER BY "occurredAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;

    const claimLegacy = () =>
      db.$queryRaw<OutboxPendingEvent[]>`
        SELECT *
        FROM "DomainOutbox"
        WHERE "processedAt" IS NULL
          AND "retries" < ${maxRetries}
        ORDER BY "occurredAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;

    const rows = hasRelayColumns ? await claimWithRelayColumns() : await claimLegacy();

    return rows[0] ?? null;
  }

  public async scheduleRetry(input: {
    outboxId: string;
    retries: number;
    nextAttemptAt: Date;
    errorMessage: string;
    db: OutboxDbClient;
  }): Promise<void> {
    const hasRelayColumns = await this.ensureRelayColumnsAvailability();
    if (!hasRelayColumns) {
      await input.db.domainOutbox.updateMany({
        where: { id: input.outboxId, processedAt: null },
        data: { retries: input.retries }
      });
      return;
    }

    await input.db.domainOutbox.updateMany({
      where: {
        id: input.outboxId,
        processedAt: null,
        deadLetteredAt: null
      } as Prisma.DomainOutboxWhereInput,
      data: {
        retries: input.retries,
        nextAttemptAt: input.nextAttemptAt,
        lastError: input.errorMessage
      } as Prisma.DomainOutboxUpdateManyMutationInput
    });
  }

  public async markDeadLetter(input: {
    outboxId: string;
    retries: number;
    errorMessage: string;
    db: OutboxDbClient;
  }): Promise<void> {
    const hasRelayColumns = await this.ensureRelayColumnsAvailability();
    if (!hasRelayColumns) {
      await input.db.domainOutbox.updateMany({
        where: { id: input.outboxId, processedAt: null },
        data: { retries: input.retries, processedAt: new Date() }
      });
      return;
    }

    await input.db.domainOutbox.updateMany({
      where: {
        id: input.outboxId,
        processedAt: null,
        deadLetteredAt: null
      } as Prisma.DomainOutboxWhereInput,
      data: {
        retries: input.retries,
        deadLetteredAt: new Date(),
        lastError: input.errorMessage
      } as Prisma.DomainOutboxUpdateManyMutationInput
    });
  }

  public async incrementRetries(outboxId: string, db?: OutboxDbClient): Promise<void> {
    const client = db ?? this.prisma;

    await client.domainOutbox.updateMany({
      where: { id: outboxId, processedAt: null },
      data: { retries: { increment: 1 } }
    });
  }

  public async getRelayMetrics(db?: OutboxDbClient): Promise<OutboxRelayMetrics> {
    const client = db ?? this.prisma;
    const hasRelayColumns = await this.ensureRelayColumnsAvailability();
    let rows: Array<{
      pending_count: number;
      retry_pending_count: number;
      dead_letter_count: number;
      oldest_pending_age_seconds: number | null;
    }>;

    if (!hasRelayColumns) {
      rows = await client.$queryRaw<Array<{
        pending_count: number;
        retry_pending_count: number;
        dead_letter_count: number;
        oldest_pending_age_seconds: number | null;
      }>>`
        SELECT
          CAST(COUNT(*) FILTER (WHERE "processedAt" IS NULL) AS INTEGER) AS pending_count,
          CAST(COUNT(*) FILTER (WHERE "processedAt" IS NULL AND "retries" > 0) AS INTEGER) AS retry_pending_count,
          0 AS dead_letter_count,
          CAST(MAX(EXTRACT(EPOCH FROM (NOW() - "createdAt"))) FILTER (WHERE "processedAt" IS NULL) AS INTEGER) AS oldest_pending_age_seconds
        FROM "DomainOutbox"
      `;
    } else {
      rows = await client.$queryRaw<Array<{
        pending_count: number;
        retry_pending_count: number;
        dead_letter_count: number;
        oldest_pending_age_seconds: number | null;
      }>>`
        SELECT
          CAST(COUNT(*) FILTER (WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL) AS INTEGER) AS pending_count,
          CAST(COUNT(*) FILTER (WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL AND "retries" > 0) AS INTEGER) AS retry_pending_count,
          CAST(COUNT(*) FILTER (WHERE "deadLetteredAt" IS NOT NULL) AS INTEGER) AS dead_letter_count,
          CAST(MAX(EXTRACT(EPOCH FROM (NOW() - "createdAt"))) FILTER (WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL) AS INTEGER) AS oldest_pending_age_seconds
        FROM "DomainOutbox"
      `;
    }

    const row = rows[0];
    return {
      pendingCount: row?.pending_count ?? 0,
      retryPendingCount: row?.retry_pending_count ?? 0,
      deadLetterCount: row?.dead_letter_count ?? 0,
      oldestPendingAgeSeconds: row?.oldest_pending_age_seconds ?? null
    };
  }

  private isMissingOutboxRelayColumnError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2010') {
      return false;
    }

    const dbCode = (error.meta as { code?: string } | undefined)?.code;
    if (dbCode !== '42703') {
      return false;
    }

    const message = String((error.meta as { message?: string } | undefined)?.message ?? '').toLowerCase();
    return (
      message.includes('deadletteredat') ||
      message.includes('nextattemptat') ||
      message.includes('lasterror')
    );
  }
}
