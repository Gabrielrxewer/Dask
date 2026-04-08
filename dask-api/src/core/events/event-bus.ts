import type { DomainEvent, DomainEventHandler } from '@/core/events/domain-event';

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventName: string, handler: DomainEventHandler): void;
}
