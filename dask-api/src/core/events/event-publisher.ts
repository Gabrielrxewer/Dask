import type { DomainEvent } from '@/core/events/domain-event';
import type { EventBus } from '@/core/events/event-bus';
import type { OutboxRepository } from '@/core/events/outbox-repository';

export class EventPublisher {
  public constructor(
    private readonly eventBus: EventBus,
    private readonly outboxRepository: OutboxRepository
  ) {}

  public async publish(event: DomainEvent): Promise<void> {
    const outbox = await this.outboxRepository.append(event);
    await this.eventBus.publish(event);
    await this.outboxRepository.markProcessed(outbox.id);
  }
}
