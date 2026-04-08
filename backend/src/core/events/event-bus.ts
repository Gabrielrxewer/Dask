import type { DomainEvent, DomainEventHandler } from '@/core/events/domain-event';

export interface EventBus {
  publish<TPayload extends object>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe(eventName: string, handler: DomainEventHandler): void;
}
