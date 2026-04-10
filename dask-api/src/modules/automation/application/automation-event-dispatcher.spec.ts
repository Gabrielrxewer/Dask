import { describe, expect, it, vi } from 'vitest';
import { DomainEventNames } from '@/core/events/event-names';
import { AutomationEventDispatcher } from '@/modules/automation/application/automation-event-dispatcher';

describe('AutomationEventDispatcher', () => {
  it('subscribes to automation trigger domain events and enqueues payloads', async () => {
    const subscriptions = new Map<string, (event: any) => Promise<void>>();
    const eventBus = {
      subscribe: vi.fn((eventName: string, handler: (event: any) => Promise<void>) => {
        subscriptions.set(eventName, handler);
      })
    };

    const jobQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined)
    };

    const dispatcher = new AutomationEventDispatcher(eventBus as any, jobQueue as any);
    dispatcher.registerListeners();

    expect(eventBus.subscribe).toHaveBeenCalledTimes(4);

    const movedHandler = subscriptions.get(DomainEventNames.ItemMoved);
    expect(movedHandler).toBeDefined();

    await movedHandler!({
      id: 'evt-1',
      name: DomainEventNames.ItemMoved,
      payload: {
        workspaceId: 'ws-1',
        itemId: 'item-1'
      }
    });

    expect(jobQueue.enqueue).toHaveBeenCalledWith('automation.process-event', {
      eventId: 'evt-1',
      eventName: DomainEventNames.ItemMoved,
      workspaceId: 'ws-1',
      payload: {
        workspaceId: 'ws-1',
        itemId: 'item-1'
      }
    });
  });

  it('ignores events without workspace id', async () => {
    const subscriptions = new Map<string, (event: any) => Promise<void>>();
    const eventBus = {
      subscribe: vi.fn((eventName: string, handler: (event: any) => Promise<void>) => {
        subscriptions.set(eventName, handler);
      })
    };

    const jobQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined)
    };

    const dispatcher = new AutomationEventDispatcher(eventBus as any, jobQueue as any);
    dispatcher.registerListeners();

    const updatedHandler = subscriptions.get(DomainEventNames.ItemUpdated);
    await updatedHandler!({
      id: 'evt-2',
      name: DomainEventNames.ItemUpdated,
      payload: {
        itemId: 'item-2'
      }
    });

    expect(jobQueue.enqueue).not.toHaveBeenCalled();
  });

  it('ignores events when payload is not an object', async () => {
    const subscriptions = new Map<string, (event: any) => Promise<void>>();
    const eventBus = {
      subscribe: vi.fn((eventName: string, handler: (event: any) => Promise<void>) => {
        subscriptions.set(eventName, handler);
      })
    };

    const jobQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined)
    };

    const dispatcher = new AutomationEventDispatcher(eventBus as any, jobQueue as any);
    dispatcher.registerListeners();

    const movedHandler = subscriptions.get(DomainEventNames.ItemMoved);
    await movedHandler!({
      id: 'evt-3',
      name: DomainEventNames.ItemMoved,
      payload: null
    });

    expect(jobQueue.enqueue).not.toHaveBeenCalled();
  });
});
