import { describe, expect, it, vi } from 'vitest';
import { AutomationSideEffectProcessor } from '@/modules/automation/runtime/automation-side-effect-processor';
import { CommunicationProviderError } from '@/modules/automation/communication/communication-provider';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makeSideEffect(overrides: Record<string, unknown> = {}) {
  return {
    id: 'side-effect-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    stepRunId: 'step-1',
    sideEffectType: 'communication.email',
    channel: 'email',
    provider: 'mock',
    status: 'processing',
    idempotencyKey: 'key-1',
    payloadJson: {
      to: 'person@example.com',
      subject: 'Hello',
      body: 'Body'
    },
    resultJson: null,
    errorJson: null,
    attempts: 1,
    maxAttempts: 2,
    nextAttemptAt: baseDate,
    lockedAt: baseDate,
    lockedBy: 'worker-1',
    cancelledAt: null,
    cancelReason: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    processedAt: null,
    ...overrides
  };
}

function makeProcessor(input?: {
  sideEffects?: any[];
  run?: { status: string; cancelledAt?: Date | null; cancelReason?: string | null } | null;
  providerSend?: ReturnType<typeof vi.fn>;
}) {
  const sideEffects = input?.sideEffects ?? [makeSideEffect()];
  const providerSend = input?.providerSend ?? vi.fn(async () => ({
    providerMessageId: 'mock_email_1',
    status: 'mock_sent'
  }));
  const sideEffectService = {
    lockNextPending: vi.fn(async () => sideEffects),
    markSent: vi.fn(),
    markFailed: vi.fn(),
    markSkipped: vi.fn(),
    updatePayload: vi.fn(async ({ sideEffectId, payload, templateVersionId }) => ({
      ...sideEffects.find((entry) => entry.id === sideEffectId),
      payloadJson: payload,
      templateVersionId
    })),
    scheduleRetry: vi.fn(),
    cancelSideEffect: vi.fn()
  };
  const providerRegistry = {
    resolve: vi.fn(() => ({
      channel: 'email',
      provider: 'mock',
      send: providerSend
    }))
  };
  const prisma = {
    automationRun: {
      findFirst: vi.fn(async () => input?.run ?? {
        id: 'run-1',
        status: 'running',
        cancelledAt: null,
        cancelReason: null
      })
    }
  };
  const eventService = {
    createEvent: vi.fn()
  };
  const templateService = {
    renderPublishedTemplate: vi.fn(async () => ({
      templateId: 'template-1',
      templateVersionId: 'template-version-1',
      category: 'follow_up',
      channel: 'email',
      subject: 'Rendered subject',
      text: 'Rendered text',
      html: '<p>Rendered text</p>'
    })),
    renderApprovedWhatsAppTemplate: vi.fn(async () => ({
      templateId: 'template-whatsapp-1',
      templateVersionId: 'template-version-whatsapp-1',
      category: 'utility',
      channel: 'whatsapp',
      approvalStatus: 'approved',
      providerTemplateName: 'proposal_followup_whatsapp',
      providerTemplateId: 'provider-template-1',
      language: 'pt_BR',
      text: 'WhatsApp rendered text'
    }))
  };
  const consentService = {
    checkConsent: vi.fn(async () => ({
      allowed: true,
      status: 'unknown',
      address: 'person@example.com',
      recipientMasked: 'p***@example.com'
    }))
  };
  const suppressionService = {
    checkSuppression: vi.fn(async () => ({
      blocked: false,
      address: 'person@example.com',
      recipientMasked: 'p***@example.com'
    }))
  };
  const recipientResolver = {
    resolveRecipient: vi.fn(async () => ({
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      channel: 'email',
      address: 'person@example.com',
      normalizedAddress: 'person@example.com',
      recipientMasked: 'p***@example.com',
      consentStatus: 'unknown',
      suppressed: false,
      blocked: false
    }))
  };
  const processor = new AutomationSideEffectProcessor(prisma as any, {
    sideEffectService: sideEffectService as any,
    providerRegistry: providerRegistry as any,
    eventService: eventService as any,
    templateService: templateService as any,
    consentService: consentService as any,
    suppressionService: suppressionService as any,
    recipientResolver: recipientResolver as any
  });

  return {
    processor,
    sideEffectService,
    providerRegistry,
    providerSend,
    prisma,
    eventService,
    templateService,
    consentService,
    suppressionService,
    recipientResolver
  };
}

describe('AutomationSideEffectProcessor', () => {
  it('processes queued side effects through the mock provider and marks sent', async () => {
    const { processor, sideEffectService, providerRegistry, providerSend } = makeProcessor();

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ locked: 1, sent: 1 });
    expect(providerRegistry.resolve).toHaveBeenCalledWith({ channel: 'email', provider: 'mock' });
    expect(providerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        to: 'person@example.com',
        body: 'Body'
      })
    );
    expect(sideEffectService.markSent).toHaveBeenCalledWith(
      expect.objectContaining({ sideEffectId: 'side-effect-1' })
    );
  });

  it('processes email side effects with a resend provider and persists providerMessageId', async () => {
    const { processor, sideEffectService, providerRegistry, providerSend } = makeProcessor({
      sideEffects: [makeSideEffect({ provider: 'resend' })],
      providerSend: vi.fn(async () => ({
        provider: 'resend',
        providerMessageId: 'resend_123',
        status: 'sent',
        sentAt: '2026-05-05T12:00:00.000Z'
      }))
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ sent: 1 });
    expect(providerRegistry.resolve).toHaveBeenCalledWith({ channel: 'email', provider: 'resend' });
    expect(providerSend).toHaveBeenCalled();
    expect(sideEffectService.markSent).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      sideEffectId: 'side-effect-1',
      result: {
        provider: 'resend',
        providerMessageId: 'resend_123',
        status: 'sent',
        sentAt: '2026-05-05T12:00:00.000Z'
      }
    });
  });

  it('does not reprocess side effects that are already sent', async () => {
    const { processor, sideEffectService, providerSend } = makeProcessor({
      sideEffects: [makeSideEffect({
        status: 'sent',
        resultJson: {
          providerMessageId: 'resend_123'
        }
      })]
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ sent: 1 });
    expect(providerSend).not.toHaveBeenCalled();
    expect(sideEffectService.markSent).not.toHaveBeenCalled();
  });

  it('cancels side effects for cancelled runs without calling provider', async () => {
    const { processor, sideEffectService, providerSend } = makeProcessor({
      run: { status: 'cancelled', cancelledAt: baseDate, cancelReason: 'user cancelled' }
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ cancelled: 1 });
    expect(providerSend).not.toHaveBeenCalled();
    expect(sideEffectService.cancelSideEffect).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'user cancelled' })
    );
  });

  it('schedules retry for retryable provider failures without duplicating side effects', async () => {
    const { processor, sideEffectService } = makeProcessor({
      providerSend: vi.fn(async () => {
        throw new CommunicationProviderError({
          message: 'temporary',
          retryable: true
        });
      })
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ retried: 1 });
    expect(sideEffectService.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ sideEffectId: 'side-effect-1' })
    );
    expect(sideEffectService.markSent).not.toHaveBeenCalled();
  });

  it('marks failed after retry attempts are exhausted', async () => {
    const { processor, sideEffectService } = makeProcessor({
      sideEffects: [makeSideEffect({ attempts: 2, maxAttempts: 2 })],
      providerSend: vi.fn(async () => {
        throw new CommunicationProviderError({
          message: 'temporary',
          retryable: true
        });
      })
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ failed: 1 });
    expect(sideEffectService.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ sideEffectId: 'side-effect-1' })
    );
  });

  it('renders a published template before sending', async () => {
    const { processor, sideEffectService, templateService, providerSend, eventService } = makeProcessor({
      sideEffects: [makeSideEffect({
        payloadJson: {
          to: 'person@example.com',
          templateKey: 'proposal_followup',
          context: {
            contact: { name: 'Maria' }
          }
        }
      })]
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ sent: 1 });
    expect(templateService.renderPublishedTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: 'proposal_followup' })
    );
    expect(sideEffectService.updatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        templateVersionId: 'template-version-1',
        payload: expect.objectContaining({
          subject: 'Rendered subject',
          text: 'Rendered text',
          templateVersionId: 'template-version-1'
        })
      })
    );
    expect(providerSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Rendered subject', text: 'Rendered text' })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'template.rendered' })
    );
  });

  it('skips side effects blocked by consent', async () => {
    const { processor, sideEffectService, consentService, providerSend, eventService } = makeProcessor();
    consentService.checkConsent.mockResolvedValue({
      allowed: false,
      status: 'opted_out',
      reason: 'contact_opted_out',
      address: 'person@example.com',
      recipientMasked: 'p***@example.com'
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ skipped: 1 });
    expect(providerSend).not.toHaveBeenCalled();
    expect(sideEffectService.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'contact_opted_out' })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'communication.consent_blocked' })
    );
  });

  it('skips side effects blocked by suppression', async () => {
    const { processor, sideEffectService, suppressionService, providerSend, eventService } = makeProcessor();
    suppressionService.checkSuppression.mockResolvedValue({
      blocked: true,
      reason: 'unsubscribe',
      suppressionId: 'suppression-1',
      address: 'person@example.com',
      recipientMasked: 'p***@example.com'
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ skipped: 1 });
    expect(providerSend).not.toHaveBeenCalled();
    expect(sideEffectService.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'suppressed' })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'communication.suppression_blocked' })
    );
  });

  it('processes WhatsApp side effects only after opt-in, suppression and approved template checks', async () => {
    const whatsappSideEffect = makeSideEffect({
      sideEffectType: 'communication.whatsapp',
      channel: 'whatsapp',
      payloadJson: {
        to: '+5549999999999',
        templateKey: 'proposal_followup_whatsapp',
        variables: {
          'proposal.code': 'P-123'
        }
      }
    });
    const { processor, sideEffectService, providerRegistry, providerSend, templateService, consentService, recipientResolver, eventService } = makeProcessor({
      sideEffects: [whatsappSideEffect],
      providerSend: vi.fn(async () => ({
        provider: 'mock',
        providerMessageId: 'mock_whatsapp_1',
        status: 'mock_sent'
      }))
    });
    consentService.checkConsent.mockResolvedValue({
      allowed: true,
      status: 'opted_in',
      address: '+5549999999999',
      recipientMasked: '+55******9999'
    });
    recipientResolver.resolveRecipient.mockResolvedValue({
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      normalizedAddress: '+5549999999999',
      recipientMasked: '+55******9999',
      consentStatus: 'opted_in',
      suppressed: false,
      blocked: false
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ sent: 1 });
    expect(templateService.renderApprovedWhatsAppTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: 'proposal_followup_whatsapp' })
    );
    expect(sideEffectService.updatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        templateVersionId: 'template-version-whatsapp-1',
        contactId: 'contact-1',
        contactChannelId: 'channel-1',
        payload: expect.objectContaining({
          to: '+5549999999999',
          channel: 'whatsapp',
          body: 'WhatsApp rendered text',
          approvalStatus: 'approved'
        })
      })
    );
    expect(providerRegistry.resolve).toHaveBeenCalledWith({ channel: 'whatsapp', provider: 'mock' });
    expect(providerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        body: 'WhatsApp rendered text'
      })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'communication.whatsapp.sent' })
    );
  });

  it('skips WhatsApp side effects when opt-in is unknown', async () => {
    const whatsappSideEffect = makeSideEffect({
      sideEffectType: 'communication.whatsapp',
      channel: 'whatsapp',
      payloadJson: {
        to: '+5549999999999',
        templateKey: 'proposal_followup_whatsapp'
      }
    });
    const { processor, sideEffectService, recipientResolver, providerSend, eventService } = makeProcessor({
      sideEffects: [whatsappSideEffect]
    });
    recipientResolver.resolveRecipient.mockResolvedValue({
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      normalizedAddress: '+5549999999999',
      recipientMasked: '+55******9999',
      consentStatus: 'unknown',
      suppressed: false,
      blocked: true,
      blockReason: 'whatsapp_requires_opt_in'
    });

    const result = await processor.processPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });

    expect(result).toMatchObject({ skipped: 1 });
    expect(providerSend).not.toHaveBeenCalled();
    expect(sideEffectService.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'whatsapp_requires_opt_in' })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'communication.whatsapp.consent_blocked' })
    );
  });
});
