import type { PrismaClient } from '@prisma/client';
import type { DomainEvent } from '@/core/events/domain-event';
import type { OutboxDbClient } from '@/core/events/outbox-repository';
import type { OutboxRepository } from '@/core/events/outbox-repository';

export class EventPublisher {
  public constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly prisma: PrismaClient
  ) {}

  public async publish(event: DomainEvent): Promise<void> {
    await this.outboxRepository.append(event);
  }

  public async publishInTransaction(event: DomainEvent, db: OutboxDbClient): Promise<void> {
    await this.outboxRepository.append(event, db);
  }

  public async publishManyInTransaction(events: DomainEvent[], db: OutboxDbClient): Promise<void> {
    for (const event of events) {
      await this.outboxRepository.append(event, db);
    }
  }

  public async runInTransaction<T>(
    fn: (db: OutboxDbClient, publisher: Pick<EventPublisher, 'publishInTransaction' | 'publishManyInTransaction'>) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (db) => fn(db, this));
  }
}
