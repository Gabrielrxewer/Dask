import type { DomainEvent } from '@/core/events/domain-event';
import type { JobQueue } from '@/core/jobs/job-queue';
import { DomainEventNames } from '@/core/events/event-names';

const automationTriggerEvents = [
  DomainEventNames.ItemCreated,
  DomainEventNames.ItemUpdated,
  DomainEventNames.ItemMoved,
  DomainEventNames.ItemStateChanged,
  DomainEventNames.ProposalCreated,
  DomainEventNames.ProposalSent,
  DomainEventNames.ProposalApproved,
  DomainEventNames.ContractCreated,
  DomainEventNames.ContractSent,
  DomainEventNames.ContractAccepted,
  DomainEventNames.BillingRequested,
  DomainEventNames.BillingPaymentConfirmed
] as const;

function extractWorkspaceId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = (payload as Record<string, unknown>).workspaceId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class AutomationEventDispatcher {
  public constructor(private readonly jobQueue: JobQueue) {}

  public async dispatch(event: DomainEvent, idempotencyKey?: string): Promise<void> {
    if (!automationTriggerEvents.includes(event.name as (typeof automationTriggerEvents)[number])) {
      return;
    }

    await this.enqueueEvent(event, idempotencyKey);
  }

  private async enqueueEvent(event: DomainEvent, idempotencyKey?: string): Promise<void> {
    const workspaceId = extractWorkspaceId(event.payload);

    if (!workspaceId) {
      return;
    }

    await this.jobQueue.enqueue('automation.process-event', {
      eventId: event.id,
      eventName: event.name,
      workspaceId,
      payload: event.payload
    }, {
      jobId: idempotencyKey ? `automation.process-event:${idempotencyKey}` : undefined
    });
  }
}
