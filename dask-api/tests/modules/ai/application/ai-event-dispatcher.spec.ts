import { describe, expect, it, vi } from 'vitest';
import { DomainEventNames } from '@/core/events/event-names';
import { AiEventDispatcher } from '@/modules/ai/application/ai-event-dispatcher';

describe('AiEventDispatcher', () => {
  it('enqueues ai.improve-description when receiving item improvement event', async () => {
    const jobQueue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const dispatcher = new AiEventDispatcher(jobQueue as any);

    await dispatcher.dispatch(
      {
        id: 'evt-1',
        name: DomainEventNames.ItemDescriptionImprovementRequested,
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
      'ai.improve-description',
      expect.objectContaining({
        itemId: 'item-1',
        workspaceId: 'ws-1',
        boardId: 'board-1'
      }),
      { jobId: 'ai.improve-description:outbox-1' }
    );
  });

  it('ignores unsupported event names', async () => {
    const jobQueue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const dispatcher = new AiEventDispatcher(jobQueue as any);

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
