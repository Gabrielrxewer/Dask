import type { DomainEvent } from '@/core/events/domain-event';
import { DomainEventNames } from '@/core/events/event-names';
import type { JobQueue } from '@/core/jobs/job-queue';

function extractString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class SearchEventDispatcher {
  public constructor(private readonly jobQueue: JobQueue) {}

  public async dispatch(event: DomainEvent, idempotencyKey?: string): Promise<void> {
    if (event.name !== DomainEventNames.ItemEmbeddingRequested) {
      return;
    }

    const payload = event.payload as Record<string, unknown>;
    const itemId = extractString(payload, 'itemId');
    if (!itemId) {
      return;
    }

    await this.jobQueue.enqueue(
      'search.index-item',
      {
        itemId,
        workspaceId: extractString(payload, 'workspaceId') ?? undefined,
        boardId: extractString(payload, 'boardId') ?? undefined
      },
      {
        jobId: idempotencyKey ? `search.index-item:${idempotencyKey}` : undefined
      }
    );
  }
}
