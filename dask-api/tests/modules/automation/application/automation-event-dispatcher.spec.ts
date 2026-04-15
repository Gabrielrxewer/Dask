import { describe, expect, it, vi } from 'vitest';
import { DomainEventNames } from '@/core/events/event-names';
import { AutomationEventDispatcher } from '@/modules/automation/application/automation-event-dispatcher';

describe('AutomationEventDispatcher', () => {
  it('enqueues automation processing when event is a supported trigger', async () => {
    const jobQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined)
    };

    const dispatcher = new AutomationEventDispatcher(jobQueue as any);
    await dispatcher.dispatch({
      id: 'evt-1',
      name: DomainEventNames.ItemMoved,
      aggregateType: 'item',
      aggregateId: 'item-1',
      occurredAt: new Date(),
      payload: {
        workspaceId: 'ws-1',
        itemId: 'item-1'
      }
    }, 'outbox-1');

    expect(jobQueue.enqueue).toHaveBeenCalledWith('automation.process-event', {
      eventId: 'evt-1',
      eventName: DomainEventNames.ItemMoved,
      workspaceId: 'ws-1',
      payload: {
        workspaceId: 'ws-1',
        itemId: 'item-1'
      }
    }, {
      jobId: 'automation.process-event:outbox-1'
    });
  });

  it('ignores events without workspace id', async () => {
    const jobQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined)
    };

    const dispatcher = new AutomationEventDispatcher(jobQueue as any);
    await dispatcher.dispatch({
      id: 'evt-2',
      name: DomainEventNames.ItemUpdated,
      aggregateType: 'item',
      aggregateId: 'item-2',
      occurredAt: new Date(),
      payload: {
        itemId: 'item-2'
      }
    });

    expect(jobQueue.enqueue).not.toHaveBeenCalled();
  });

  it('ignores unsupported events', async () => {
    const jobQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined)
    };

    const dispatcher = new AutomationEventDispatcher(jobQueue as any);
    await dispatcher.dispatch({
      id: 'evt-3',
      name: 'organization.created',
      aggregateType: 'organization',
      aggregateId: 'org-1',
      occurredAt: new Date(),
      payload: {
        workspaceId: 'ws-1'
      }
    });

    expect(jobQueue.enqueue).not.toHaveBeenCalled();
  });
});
