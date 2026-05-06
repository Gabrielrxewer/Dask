import { describe, expect, it, vi } from 'vitest';
import { AutomationFollowupCoordinatorService } from '@/modules/automation/application/automation-followup-coordinator-service';

function makeService() {
  const scheduledSteps = [
    { id: 'scheduled-1', workspaceId: 'ws-1', runId: 'run-1', status: 'scheduled', purpose: 'follow_up' },
    { id: 'scheduled-2', workspaceId: 'ws-1', runId: 'run-2', status: 'scheduled', purpose: 'follow_up' }
  ];
  const sideEffects = [
    {
      id: 'sent-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      channel: 'whatsapp',
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      status: 'sent',
      payloadJson: { category: 'follow_up', workItemId: 'item-1' },
      createdAt: new Date('2026-05-05T12:00:00.000Z')
    },
    {
      id: 'queued-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      channel: 'whatsapp',
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      status: 'queued',
      payloadJson: { category: 'follow_up', workItemId: 'item-1' },
      createdAt: new Date('2026-05-05T12:01:00.000Z')
    },
    {
      id: 'queued-other-contact',
      workspaceId: 'ws-1',
      runId: 'run-2',
      channel: 'whatsapp',
      contactId: 'contact-2',
      contactChannelId: 'channel-2',
      status: 'queued',
      payloadJson: { category: 'follow_up', workItemId: 'item-2' },
      createdAt: new Date('2026-05-05T12:02:00.000Z')
    }
  ];
  const prisma = {
    $transaction: vi.fn(async (operations: Array<Promise<any>>) => Promise.all(operations)),
    automationSideEffect: {
      findFirst: vi.fn(async ({ where }) =>
        sideEffects.find((sideEffect) => sideEffect.id === where.id && sideEffect.workspaceId === where.workspaceId) ?? null
      ),
      findMany: vi.fn(async ({ where }) =>
        sideEffects.filter((sideEffect) =>
          sideEffect.workspaceId === where.workspaceId &&
          sideEffect.channel === where.channel &&
          (sideEffect.contactId === 'contact-1' || sideEffect.contactChannelId === 'channel-1')
        )
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        const matched = sideEffects.filter((sideEffect) =>
          sideEffect.workspaceId === where.workspaceId &&
          where.runId.in.includes(sideEffect.runId) &&
          sideEffect.channel === where.channel &&
          where.status.in.includes(sideEffect.status) &&
          (!where.contactId || sideEffect.contactId === where.contactId)
        );
        for (const sideEffect of matched) {
          Object.assign(sideEffect, data);
        }
        return { count: matched.length };
      })
    },
    automationScheduledStep: {
      updateMany: vi.fn(async ({ where, data }) => {
        const matched = scheduledSteps.filter((step) =>
          step.workspaceId === where.workspaceId &&
          where.runId.in.includes(step.runId) &&
          where.status.in.includes(step.status) &&
          step.purpose === where.purpose
        );
        for (const step of matched) {
          Object.assign(step, data);
        }
        return { count: matched.length };
      })
    }
  };
  const eventService = { createEvent: vi.fn(async () => null) };
  const service = new AutomationFollowupCoordinatorService(prisma as any, {
    eventService: eventService as any
  });

  return { service, prisma, eventService, scheduledSteps, sideEffects };
}

describe('AutomationFollowupCoordinatorService', () => {
  it('cancels pending follow-up scheduled steps and queued side effects for the same contact', async () => {
    const { service, eventService } = makeService();

    const summary = await service.cancelPendingFollowupsDueToReply({
      workspaceId: 'ws-1',
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      from: '+5549999999999',
      messagePreview: 'Tenho interesse'
    });

    expect(summary).toEqual({
      relatedRunIds: ['run-1'],
      cancelledScheduledSteps: 1,
      cancelledSideEffects: 1
    });
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        eventType: 'automation.followup.cancelled_due_to_reply'
      })
    );
  });

  it('does not cancel unrelated contacts or workspaces when association is insufficient', async () => {
    const { service, prisma } = makeService();

    const summary = await service.cancelPendingFollowupsDueToReply({
      workspaceId: 'ws-2',
      contactId: 'contact-1'
    });

    expect(summary.cancelledScheduledSteps).toBe(0);
    expect(summary.cancelledSideEffects).toBe(0);
    expect(prisma.automationScheduledStep.updateMany).not.toHaveBeenCalled();
  });
});
