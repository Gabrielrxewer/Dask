import type { DomainOutbox } from '@prisma/client';
import type { DomainEvent } from '@/core/events/domain-event';

export interface OutboxRepository {
  append(event: DomainEvent): Promise<DomainOutbox>;
  markProcessed(outboxId: string): Promise<void>;
}
