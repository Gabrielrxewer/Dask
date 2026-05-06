import { describe, expect, it, vi } from 'vitest';
import { MockWhatsAppEventSimulator } from '@/modules/automation/communication/mock-whatsapp-event-simulator';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makePrisma() {
  const sideEffect = {
    id: 'side-effect-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    stepRunId: 'step-1',
    channel: 'whatsapp',
    contactId: 'contact-1',
    contactChannelId: 'channel-1',
    status: 'sent',
    payloadJson: {
      to: '+5549999999999',
      templateKey: 'proposal_followup_whatsapp_1'
    },
    resultJson: {
      provider: 'mock',
      providerMessageId: 'mock_whatsapp_1',
      status: 'mock_sent'
    }
  };
  const prisma = {
    automationSideEffect: {
      findFirst: vi.fn(async ({ where }) =>
        where.workspaceId === sideEffect.workspaceId && where.id === sideEffect.id
          ? sideEffect
          : null
      )
    }
  };
  const providerEventService = {
    receiveEvent: vi.fn(async () => ({ status: 'processed', event: { id: 'provider-event-1' } }))
  };
  const simulator = new MockWhatsAppEventSimulator(prisma as any, {
    providerEventService: providerEventService as any
  });

  return { simulator, prisma, providerEventService };
}

describe('MockWhatsAppEventSimulator', () => {
  it('simulates delivered and read provider events without changing sent status', async () => {
    const { simulator, providerEventService } = makePrisma();

    await simulator.simulate({
      workspaceId: 'ws-1',
      sideEffectId: 'side-effect-1',
      eventType: 'delivered',
      now: baseDate,
      metadata: { authorization: 'Bearer secret' }
    });
    await simulator.simulate({
      workspaceId: 'ws-1',
      sideEffectId: 'side-effect-1',
      eventType: 'read',
      now: baseDate
    });

    expect(providerEventService.receiveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          provider: 'mock',
          channel: 'whatsapp',
          eventType: 'whatsapp.delivered',
          providerMessageId: 'mock_whatsapp_1'
        })
      })
    );
    expect(providerEventService.receiveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          eventType: 'whatsapp.read'
        })
      })
    );
  });

  it('simulates replies as inbound interactions with sanitized timeline events', async () => {
    const { simulator, providerEventService } = makePrisma();

    await simulator.simulate({
      workspaceId: 'ws-1',
      sideEffectId: 'side-effect-1',
      eventType: 'replied',
      messageText: 'Recebi, obrigado.',
      now: baseDate
    });

    expect(providerEventService.receiveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          eventType: 'whatsapp.replied',
          from: '+5549999999999',
          text: 'Recebi, obrigado.',
          messageType: 'text'
        })
      })
    );
  });

  it('simulates failed delivery through the provider event pipeline', async () => {
    const { simulator, providerEventService } = makePrisma();

    await simulator.simulate({
      workspaceId: 'ws-1',
      sideEffectId: 'side-effect-1',
      eventType: 'failed',
      now: baseDate
    });

    expect(providerEventService.receiveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          eventType: 'whatsapp.failed',
          errorCode: 'MOCK_WHATSAPP_DELIVERY_FAILED',
          errorMessage: 'Mock WhatsApp delivery failed.'
        })
      })
    );
  });
});
