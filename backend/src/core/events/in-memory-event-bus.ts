import type { DomainEvent, DomainEventHandler } from '@/core/events/domain-event';
import type { EventBus } from '@/core/events/event-bus';

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, DomainEventHandler[]>();

  public subscribe(eventName: string, handler: DomainEventHandler): void {
    const current = this.handlers.get(eventName) ?? [];
    current.push(handler);
    this.handlers.set(eventName, current);
  }

  public async publish<TPayload extends object>(event: DomainEvent<TPayload>): Promise<void> {
    const handlers = [...(this.handlers.get(event.name) ?? []), ...(this.handlers.get('*') ?? [])];
    await Promise.all(handlers.map(async (handler) => handler(event)));
  }
}
