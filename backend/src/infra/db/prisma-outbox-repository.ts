import type { DomainOutbox, PrismaClient } from '@prisma/client';
import type { DomainEvent } from '@/core/events/domain-event';
import type { OutboxRepository } from '@/core/events/outbox-repository';

export class PrismaOutboxRepository implements OutboxRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public append(event: DomainEvent): Promise<DomainOutbox> {
    return this.prisma.domainOutbox.create({
      data: {
        eventName: event.name,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        occurredAt: event.occurredAt
      }
    });
  }

  public async markProcessed(outboxId: string): Promise<void> {
    await this.prisma.domainOutbox.update({
      where: { id: outboxId },
      data: { processedAt: new Date() }
    });
  }
}
