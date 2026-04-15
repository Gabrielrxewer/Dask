import type { DomainEvent } from '@/core/events/domain-event';
import { DomainEventNames } from '@/core/events/event-names';
import type { JobQueue } from '@/core/jobs/job-queue';

function extractString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class AiEventDispatcher {
  public constructor(private readonly jobQueue: JobQueue) {}

  public async dispatch(event: DomainEvent, idempotencyKey?: string): Promise<void> {
    if (event.name !== DomainEventNames.ItemDescriptionImprovementRequested) {
      return;
    }

    const payload = event.payload as Record<string, unknown>;
    const itemId = extractString(payload, 'itemId');
    if (!itemId) {
      return;
    }

    await this.jobQueue.enqueue(
      'ai.improve-description',
      {
        itemId,
        workspaceId: extractString(payload, 'workspaceId') ?? undefined,
        boardId: extractString(payload, 'boardId') ?? undefined
      },
      {
        jobId: idempotencyKey ? `ai.improve-description:${idempotencyKey}` : undefined
      }
    );
  }
}
