import { v4 as uuid } from 'uuid';
import type { EventPublisher } from '@/core/events/event-publisher';

export class IntegrationService {
  public constructor(private readonly eventPublisher: EventPublisher) {}

  public async receiveWebhook(input: {
    source: string;
    event: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.eventPublisher.publish({
      id: uuid(),
      name: 'integration.webhook.received',
      aggregateType: 'integration',
      aggregateId: input.source,
      occurredAt: new Date(),
      payload: input
    });
  }
}
