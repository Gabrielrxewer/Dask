import type { DomainEvent } from '@/core/events/domain-event';
import type { EventBus } from '@/core/events/event-bus';
import type { JobQueue } from '@/core/jobs/job-queue';
import { DomainEventNames } from '@/core/events/event-names';

const automationTriggerEvents = [
  DomainEventNames.ItemCreated,
  DomainEventNames.ItemUpdated,
  DomainEventNames.ItemMoved,
  'item.state.changed'
] as const;

function extractWorkspaceId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = (payload as Record<string, unknown>).workspaceId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class AutomationEventDispatcher {
  public constructor(
    private readonly eventBus: EventBus,
    private readonly jobQueue: JobQueue
  ) {}

  public registerListeners(): void {
    for (const eventName of automationTriggerEvents) {
      this.eventBus.subscribe(eventName, async (event) => {
        await this.enqueueEvent(event);
      });
    }
  }

  private async enqueueEvent(event: DomainEvent): Promise<void> {
    const workspaceId = extractWorkspaceId(event.payload);

    if (!workspaceId) {
      return;
    }

    await this.jobQueue.enqueue('automation.process-event', {
      eventId: event.id,
      eventName: event.name,
      workspaceId,
      payload: event.payload
    });
  }
}
