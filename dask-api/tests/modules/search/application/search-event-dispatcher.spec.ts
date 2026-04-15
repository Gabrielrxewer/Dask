import { describe, expect, it, vi } from 'vitest';
import { DomainEventNames } from '@/core/events/event-names';
import { SearchEventDispatcher } from '@/modules/search/application/search-event-dispatcher';

describe('SearchEventDispatcher', () => {
  it('enqueues search.index-item when receiving embedding requested event', async () => {
    const jobQueue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const dispatcher = new SearchEventDispatcher(jobQueue as any);

    await dispatcher.dispatch(
      {
        id: 'evt-1',
        name: DomainEventNames.ItemEmbeddingRequested,
        aggregateType: 'item',
        aggregateId: 'item-1',
        occurredAt: new Date(),
        payload: {
          itemId: 'item-1',
          workspaceId: 'ws-1',
          boardId: 'board-1'
        }
      },
      'outbox-1'
    );

    expect(jobQueue.enqueue).toHaveBeenCalledWith(
      'search.index-item',
      expect.objectContaining({
        itemId: 'item-1',
        workspaceId: 'ws-1',
        boardId: 'board-1'
      }),
      { jobId: 'search.index-item:outbox-1' }
    );
  });

  it('ignores unsupported event names', async () => {
    const jobQueue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const dispatcher = new SearchEventDispatcher(jobQueue as any);

    await dispatcher.dispatch({
      id: 'evt-2',
      name: DomainEventNames.ItemUpdated,
      aggregateType: 'item',
      aggregateId: 'item-1',
      occurredAt: new Date(),
      payload: {
        itemId: 'item-1'
      }
    });

    expect(jobQueue.enqueue).not.toHaveBeenCalled();
  });
});
