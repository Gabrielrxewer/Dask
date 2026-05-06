import { describe, expect, it, vi } from 'vitest';
import { CommunicationProviderEventService } from '@/modules/automation/communication/communication-provider-event-service';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makeSideEffect() {
  return {
    id: 'side-effect-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    stepRunId: 'step-1',
    sideEffectType: 'communication.email',
    channel: 'email',
    provider: 'resend',
    status: 'sent',
    idempotencyKey: 'key',
    payloadJson: {},
    resultJson: {
      provider: 'resend',
      providerMessageId: 'resend_123',
      status: 'sent'
    },
    errorJson: null,
    templateVersionId: null,
    contactId: null,
    contactChannelId: null,
    attempts: 1,
    maxAttempts: 3,
    nextAttemptAt: baseDate,
    lockedAt: null,
    lockedBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    processedAt: baseDate
  };
}

function makeService(input?: { sideEffect?: any | null }) {
  const events: any[] = [];
  const sideEffect = input?.sideEffect === undefined ? makeSideEffect() : input.sideEffect;
  const prisma = {
    communicationProviderEvent: {
      findUnique: vi.fn(async ({ where }) =>
        events.find((event) => event.provider === where.provider_providerEventId.provider && event.providerEventId === where.provider_providerEventId.providerEventId) ?? null
      ),
      create: vi.fn(async ({ data }) => {
        const event = { id: `provider-event-${events.length + 1}`, createdAt: baseDate, updatedAt: baseDate, processedAt: null, errorJson: null, ...data };
        events.push(event);
        return event;
      }),
      update: vi.fn(async ({ where, data }) => {
        const event = events.find((candidate) => candidate.id === where.id);
        Object.assign(event, data);
        return event;
      })
    },
    automationSideEffect: {
      findFirst: vi.fn(async () => sideEffect),
      update: vi.fn(async ({ data }) => ({ ...sideEffect, ...data }))
    },
    communicationContactChannel: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({ id: 'channel-1' }))
    },
    communicationContact: {
      findFirst: vi.fn(async () => ({ id: 'contact-1', workspaceId: 'ws-1' }))
    },
    communicationInteraction: {
      create: vi.fn(async ({ data }) => ({ id: 'interaction-1', ...data }))
    },
    communicationConversationWindow: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => ({ id: 'window-1', ...data })),
      update: vi.fn(async ({ data }) => ({ id: 'window-1', ...data }))
    }
  };
  const eventService = { createEvent: vi.fn() };
  const suppressionService = { suppress: vi.fn() };
  const consentService = { optOut: vi.fn() };
  const contactService = {
    findOrCreateContact: vi.fn(async () => ({ id: 'contact-1', workspaceId: 'ws-1' })),
    upsertChannel: vi.fn(async () => ({ id: 'channel-1', contactId: 'contact-1' }))
  };
  const followupCoordinator = {
    cancelPendingFollowupsDueToReply: vi.fn(async () => ({
      relatedRunIds: ['run-1'],
      cancelledScheduledSteps: 1,
      cancelledSideEffects: 1
    }))
  };
  const service = new CommunicationProviderEventService(prisma as any, {
    eventService: eventService as any,
    suppressionService: suppressionService as any,
    consentService: consentService as any,
    contactService: contactService as any,
    followupCoordinator: followupCoordinator as any
  });

  return { service, prisma, events, eventService, suppressionService, consentService, contactService, followupCoordinator };
}

describe('CommunicationProviderEventService', () => {
  it('creates and processes provider events linked to side effects', async () => {
    const { service, prisma, eventService } = makeService();

    const result = await service.receiveEvent({
      event: {
        provider: 'resend',
        channel: 'email',
        providerEventId: 'evt-1',
        providerMessageId: 'resend_123',
        eventType: 'email.delivered',
        occurredAt: baseDate,
        recipient: 'person@example.com',
        raw: { id: 'evt-1' }
      }
    });

    expect(result.status).toBe('processed');
    expect(prisma.automationSideEffect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resultJson: expect.objectContaining({
            providerMessageId: 'resend_123',
            delivery: expect.objectContaining({ status: 'delivered' })
          })
        })
      })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'communication.email.delivered' })
    );
  });

  it('deduplicates by providerEventId', async () => {
    const { service, events } = makeService();
    const event = {
      provider: 'resend' as const,
      channel: 'email' as const,
      providerEventId: 'evt-1',
      providerMessageId: 'resend_123',
      eventType: 'email.delivered',
      raw: {}
    };

    await service.receiveEvent({ event });
    const duplicate = await service.receiveEvent({ event });

    expect(duplicate.status).toBe('duplicate');
    expect(events).toHaveLength(1);
  });

  it('marks events ignored when side effect is unresolved', async () => {
    const { service } = makeService({ sideEffect: null });

    const result = await service.receiveEvent({
      event: {
        provider: 'resend',
        channel: 'email',
        providerEventId: 'evt-unresolved',
        providerMessageId: 'missing',
        eventType: 'email.delivered',
        raw: {}
      }
    });

    expect(result.status).toBe('ignored');
    expect(result.event.status).toBe('ignored');
  });

  it('creates suppression for bounce and complaint and opt-out for unsubscribe', async () => {
    const { service, suppressionService, consentService } = makeService();

    await service.receiveEvent({
      event: {
        provider: 'resend',
        channel: 'email',
        providerEventId: 'evt-bounce',
        providerMessageId: 'resend_123',
        eventType: 'email.bounced',
        recipient: 'Bad@Example.com',
        raw: {}
      }
    });
    await service.receiveEvent({
      event: {
        provider: 'resend',
        channel: 'email',
        providerEventId: 'evt-complaint',
        providerMessageId: 'resend_123',
        eventType: 'email.complained',
        recipient: 'angry@example.com',
        raw: {}
      }
    });
    await service.receiveEvent({
      event: {
        provider: 'resend',
        channel: 'email',
        providerEventId: 'evt-unsub',
        providerMessageId: 'resend_123',
        eventType: 'email.unsubscribed',
        recipient: 'gone@example.com',
        raw: {}
      }
    });

    expect(suppressionService.suppress).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'bad@example.com', reason: 'bounce' })
    );
    expect(suppressionService.suppress).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'angry@example.com', reason: 'complaint' })
    );
    expect(consentService.optOut).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'gone@example.com' })
    );
  });

  it('links provider events to canonical contact and creates interaction', async () => {
    const { service, prisma, contactService } = makeService();

    await service.receiveEvent({
      event: {
        provider: 'resend',
        channel: 'email',
        providerEventId: 'evt-contact',
        providerMessageId: 'resend_123',
        eventType: 'email.opened',
        recipient: 'Person@Example.com',
        raw: {}
      }
    });

    expect(contactService.findOrCreateContact).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'person@example.com', sourceType: 'provider_event' })
    );
    expect(prisma.communicationInteraction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: 'contact-1',
          contactChannelId: 'channel-1',
          type: 'email.opened'
        })
      })
    );
  });

  it('processes inbound WhatsApp replies into interaction, conversation window and follow-up cancellation', async () => {
    const { service, prisma, followupCoordinator, eventService } = makeService({
      sideEffect: {
        ...makeSideEffect(),
        sideEffectType: 'communication.whatsapp',
        channel: 'whatsapp',
        provider: 'mock',
        resultJson: {
          provider: 'mock',
          providerMessageId: 'wamid.outbound.1',
          status: 'sent'
        },
        contactId: 'contact-1',
        contactChannelId: 'channel-1'
      }
    });

    const result = await service.receiveEvent({
      event: {
        provider: 'mock',
        channel: 'whatsapp',
        providerEventId: 'wamid.reply.1',
        providerMessageId: 'wamid.outbound.1',
        eventType: 'whatsapp.replied',
        occurredAt: baseDate,
        from: '+5549999999999',
        to: '+554933333333',
        text: 'Tenho interesse no orçamento',
        messageType: 'text',
        raw: { id: 'wamid.reply.1' }
      }
    });

    expect(result.status).toBe('processed');
    expect(prisma.communicationInteraction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'inbound',
          channel: 'whatsapp',
          type: 'whatsapp.replied',
          providerEventId: 'provider-event-1',
          contactId: 'contact-1',
          contactChannelId: 'channel-1'
        })
      })
    );
    expect(prisma.communicationConversationWindow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'whatsapp',
          provider: 'mock',
          status: 'open',
          lastInboundAt: baseDate
        })
      })
    );
    expect(followupCoordinator.cancelPendingFollowupsDueToReply).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        contactId: 'contact-1',
        contactChannelId: 'channel-1',
        messagePreview: 'Tenho interesse no orçamento'
      })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'communication.whatsapp.replied' })
    );
  });
});
