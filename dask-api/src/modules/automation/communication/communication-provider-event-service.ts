import type { AutomationSideEffect, CommunicationProviderEvent, Prisma, PrismaClient } from '@prisma/client';
import { AutomationFollowupCoordinatorService } from '@/modules/automation/application/automation-followup-coordinator-service';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { maskCommunicationAddress, normalizeCommunicationAddress } from '@/modules/automation/communication/communication-address';
import { CommunicationConsentService } from '@/modules/automation/communication/communication-consent-service';
import { CommunicationConversationService } from '@/modules/automation/communication/communication-conversation-service';
import { CommunicationContactService } from '@/modules/automation/communication/communication-contact-service';
import { CommunicationSuppressionService } from '@/modules/automation/communication/communication-suppression-service';
import type { NormalizedCommunicationProviderEvent } from '@/modules/automation/communication/resend-webhook-event-normalizer';
import type { NormalizedWhatsAppProviderEvent } from '@/modules/automation/communication/meta-whatsapp-webhook-normalizer';
import { normalizeAutomationError, sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

type NormalizedProviderEvent = NormalizedCommunicationProviderEvent | NormalizedWhatsAppProviderEvent;

type ProviderEventResult = {
  event: CommunicationProviderEvent;
  status: 'processed' | 'ignored' | 'duplicate' | 'failed';
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDelivery(resultJson: unknown, input: {
  eventType: string;
  occurredAt?: Date;
  reason?: string;
}): Record<string, unknown> {
  const base = isRecord(resultJson) ? { ...resultJson } : {};
  const delivery = isRecord(base.delivery) ? { ...base.delivery } : {};
  const status = input.eventType.replace(/^(email|whatsapp)\./, '').replace('inbound_message', 'replied');
  delivery.status = status;
  delivery[`${status}At`] = (input.occurredAt ?? new Date()).toISOString();
  if (input.reason) {
    delivery.reason = input.reason;
  }
  base.delivery = delivery;
  return base;
}

function timelineEventType(eventType: string): Parameters<AutomationRunEventService['createEvent']>[0]['eventType'] {
  const supported = [
    'communication.email.sent',
    'communication.email.delivered',
    'communication.email.delivery_delayed',
    'communication.email.bounced',
    'communication.email.complained',
    'communication.email.opened',
    'communication.email.clicked',
    'communication.email.unsubscribed',
    'communication.email.failed',
    'communication.whatsapp.sent',
    'communication.whatsapp.delivered',
    'communication.whatsapp.read',
    'communication.whatsapp.failed',
    'communication.whatsapp.replied',
    'communication.whatsapp.message_received'
  ];
  const candidate = eventType === 'whatsapp.inbound_message'
    ? 'communication.whatsapp.message_received'
    : `communication.${eventType}`;
  return supported.includes(candidate)
    ? candidate as Parameters<AutomationRunEventService['createEvent']>[0]['eventType']
    : 'provider_event.received';
}

function isWhatsAppInbound(event: NormalizedProviderEvent): event is NormalizedWhatsAppProviderEvent {
  return event.channel === 'whatsapp' && (event.eventType === 'whatsapp.replied' || event.eventType === 'whatsapp.inbound_message');
}

function previewText(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function getEventRecipient(event: NormalizedProviderEvent): string | undefined {
  if ('recipient' in event) {
    return event.recipient;
  }
  return 'from' in event ? event.from : undefined;
}

export class CommunicationProviderEventService {
  private readonly eventService: AutomationRunEventService;
  private readonly consentService: CommunicationConsentService;
  private readonly suppressionService: CommunicationSuppressionService;
  private readonly contactService: CommunicationContactService;
  private readonly conversationService: CommunicationConversationService;
  private readonly followupCoordinator: AutomationFollowupCoordinatorService;

  public constructor(private readonly prisma: PrismaClient, input?: {
    eventService?: AutomationRunEventService;
    consentService?: CommunicationConsentService;
    suppressionService?: CommunicationSuppressionService;
    contactService?: CommunicationContactService;
    followupCoordinator?: AutomationFollowupCoordinatorService;
  }) {
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
    this.consentService = input?.consentService ?? new CommunicationConsentService(prisma);
    this.suppressionService = input?.suppressionService ?? new CommunicationSuppressionService(prisma);
    this.contactService = input?.contactService ?? new CommunicationContactService(prisma);
    this.conversationService = new CommunicationConversationService(prisma, {
      consentService: this.consentService,
      suppressionService: this.suppressionService
    });
    this.followupCoordinator = input?.followupCoordinator ?? new AutomationFollowupCoordinatorService(prisma, {
      eventService: this.eventService
    });
  }

  public async receiveEvent(input: {
    event: NormalizedProviderEvent;
  }): Promise<ProviderEventResult> {
    const existing = await this.prisma.communicationProviderEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: input.event.provider,
          providerEventId: input.event.providerEventId
        }
      }
    });
    if (existing) {
      return { event: existing, status: 'duplicate' };
    }

    const sideEffect = input.event.providerMessageId
      ? await this.findSideEffect(input.event.providerMessageId)
      : null;
    const resolvedChannel = !sideEffect && isWhatsAppInbound(input.event) && input.event.from
      ? await this.findUniqueWhatsAppChannel(input.event.from)
      : null;
    const workspaceId = sideEffect?.workspaceId ?? resolvedChannel?.workspaceId ?? null;
    const received = await this.prisma.communicationProviderEvent.create({
      data: {
        workspaceId,
        provider: input.event.provider,
        channel: input.event.channel,
        providerEventId: input.event.providerEventId,
        providerMessageId: input.event.providerMessageId ?? null,
        eventType: input.event.eventType,
        status: 'received',
        sideEffectId: sideEffect?.id ?? null,
        contactId: resolvedChannel?.contactId ?? sideEffect?.contactId ?? null,
        contactChannelId: resolvedChannel?.id ?? sideEffect?.contactChannelId ?? null,
        payloadJson: toJsonValue(sanitizeAutomationPayload(input.event.raw)),
        normalizedJson: toJsonValue(sanitizeAutomationPayload({
          ...input.event,
          raw: undefined
        })),
        receivedAt: input.event.occurredAt ?? new Date()
      }
    });

    if (isWhatsAppInbound(input.event)) {
      return this.processWhatsAppInbound({
        providerEvent: received,
        event: input.event,
        sideEffect,
        resolvedChannel
      });
    }

    if (!sideEffect) {
      return {
        event: await this.markEvent(received.id, 'ignored'),
        status: 'ignored'
      };
    }

    try {
      await this.applyToSideEffect(sideEffect, input.event);
      const processed = await this.markEvent(received.id, 'processed');
      await this.syncProviderStatusMessage(sideEffect, processed, input.event).catch(() => undefined);
      await this.logTimeline(sideEffect, input.event);
      return { event: processed, status: 'processed' };
    } catch (error) {
      const failed = await this.prisma.communicationProviderEvent.update({
        where: { id: received.id },
        data: {
          status: 'failed',
          errorJson: toJsonValue(normalizeAutomationError(error))
        }
      });
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'provider_event.failed',
        level: 'error',
        message: 'Communication provider event failed.',
        payload: {
          providerEventId: input.event.providerEventId,
          providerMessageId: input.event.providerMessageId,
          sideEffectId: sideEffect.id,
          eventType: input.event.eventType,
          error: normalizeAutomationError(error)
        }
      });
      return { event: failed, status: 'failed' };
    }
  }

  private async findSideEffect(providerMessageId: string): Promise<AutomationSideEffect | null> {
    return this.prisma.automationSideEffect.findFirst({
      where: {
        resultJson: {
          path: ['providerMessageId'],
          equals: providerMessageId
        }
      }
    });
  }

  private async findUniqueWhatsAppChannel(address: string) {
    const normalized = this.contactService.normalizeChannelAddress('whatsapp', address);
    const matches = await this.prisma.communicationContactChannel.findMany({
      where: {
        channel: 'whatsapp',
        normalizedAddress: normalized.normalizedAddress,
        status: { not: 'invalid' }
      },
      take: 2
    });
    return matches.length === 1 ? matches[0] : null;
  }

  private async applyToSideEffect(
    sideEffect: AutomationSideEffect,
    event: NormalizedProviderEvent
  ): Promise<void> {
    const resultJson = mergeDelivery(sideEffect.resultJson, {
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      reason: 'errorMessage' in event ? event.errorMessage : undefined
    });
    await this.prisma.automationSideEffect.update({
      where: { id: sideEffect.id },
      data: {
        resultJson: toJsonValue(resultJson)
      }
    });

    const eventRecipient = getEventRecipient(event);
    const recipient = eventRecipient
      ? normalizeCommunicationAddress(event.channel, eventRecipient)
      : null;
    if (!recipient) {
      return;
    }
    const contact = await this.contactService.findOrCreateContact({
      workspaceId: sideEffect.workspaceId,
      sourceType: 'provider_event',
      sourceId: event.providerMessageId,
      channel: event.channel,
      address: recipient
    });
    const channel = await this.contactService.upsertChannel({
      workspaceId: sideEffect.workspaceId,
      contactId: contact.id,
      channel: event.channel,
      address: recipient,
      isPrimary: true
    });
    await this.prisma.automationSideEffect.update({
      where: { id: sideEffect.id },
      data: {
        contactId: sideEffect.contactId ?? contact.id,
        contactChannelId: sideEffect.contactChannelId ?? channel.id
      }
    });
    await this.conversationService.syncSideEffectMessage({
      workspaceId: sideEffect.workspaceId,
      sideEffectId: sideEffect.id
    }).catch(() => undefined);
    await this.prisma.communicationInteraction.create({
      data: {
        workspaceId: sideEffect.workspaceId,
        contactId: sideEffect.contactId ?? contact.id,
        contactChannelId: sideEffect.contactChannelId ?? channel.id,
        sideEffectId: sideEffect.id,
        providerEventId: undefined,
        direction: 'system',
        channel: event.channel,
        provider: event.provider,
        type: event.eventType,
        status: event.eventType.replace(/^email\./, ''),
        occurredAt: event.occurredAt ?? new Date(),
        metadataJson: toJsonValue(sanitizeAutomationPayload({
          provider: event.provider,
          providerEventId: event.providerEventId,
          providerMessageId: event.providerMessageId
        }))
      }
    });

    if (event.eventType === 'email.bounced') {
      await this.prisma.communicationContactChannel.update({
        where: { id: channel.id },
        data: { status: 'invalid' }
      });
      await this.suppressionService.suppress({
        workspaceId: sideEffect.workspaceId,
        channel: event.channel,
        address: recipient,
        reason: 'bounce',
        source: event.provider,
        metadata: { providerEventId: event.providerEventId }
      });
    }
    if (event.eventType === 'email.complained') {
      await this.prisma.communicationContactChannel.update({
        where: { id: channel.id },
        data: { status: 'suppressed' }
      });
      await this.suppressionService.suppress({
        workspaceId: sideEffect.workspaceId,
        channel: event.channel,
        address: recipient,
        reason: 'complaint',
        source: event.provider,
        metadata: { providerEventId: event.providerEventId }
      });
    }
    if (event.eventType === 'email.unsubscribed') {
      await this.prisma.communicationContactChannel.update({
        where: { id: channel.id },
        data: { status: 'opted_out' }
      });
      await this.consentService.optOut({
        workspaceId: sideEffect.workspaceId,
        channel: event.channel,
        address: recipient,
        source: event.provider,
        reason: 'provider_unsubscribe'
      });
      await this.suppressionService.suppress({
        workspaceId: sideEffect.workspaceId,
        channel: event.channel,
        address: recipient,
        reason: 'unsubscribe',
        source: event.provider,
        metadata: { providerEventId: event.providerEventId }
      });
    }
  }

  private async processWhatsAppInbound(input: {
    providerEvent: CommunicationProviderEvent;
    event: NormalizedWhatsAppProviderEvent;
    sideEffect: AutomationSideEffect | null;
    resolvedChannel: { id: string; workspaceId: string; contactId: string } | null;
  }): Promise<ProviderEventResult> {
    const workspaceId = input.sideEffect?.workspaceId ?? input.resolvedChannel?.workspaceId;
    if (!workspaceId || !input.event.from) {
      return {
        event: await this.markEvent(input.providerEvent.id, 'ignored'),
        status: 'ignored'
      };
    }

    try {
      const contact = input.resolvedChannel
        ? await this.prisma.communicationContact.findFirst({
            where: { id: input.resolvedChannel.contactId, workspaceId }
          })
        : await this.contactService.findOrCreateContact({
            workspaceId,
            sourceType: 'provider_event',
            sourceId: input.event.from,
            channel: 'whatsapp',
            address: input.event.from,
            metadata: {
              provider: input.event.provider,
              phoneNumberId: input.event.phoneNumberId
            }
          });
      if (!contact) {
        return {
          event: await this.markEvent(input.providerEvent.id, 'ignored'),
          status: 'ignored'
        };
      }

      const channel = input.resolvedChannel
        ? input.resolvedChannel
        : await this.contactService.upsertChannel({
            workspaceId,
            contactId: contact.id,
            channel: 'whatsapp',
            address: input.event.from,
            isPrimary: true,
            metadata: {
              provider: input.event.provider,
              phoneNumberId: input.event.phoneNumberId
            }
          });
      const occurredAt = input.event.occurredAt ?? new Date();
      const messagePreview = previewText(input.event.text);

      await this.prisma.communicationProviderEvent.update({
        where: { id: input.providerEvent.id },
        data: {
          workspaceId,
          contactId: contact.id,
          contactChannelId: channel.id,
          sideEffectId: input.sideEffect?.id ?? undefined
        }
      });

      await this.conversationService.appendMessage({
        workspaceId,
        contactId: contact.id,
        contactChannelId: channel.id,
        sideEffectId: input.sideEffect?.id ?? null,
        providerEventId: input.providerEvent.id,
        direction: 'inbound',
        channel: 'whatsapp',
        provider: input.event.provider,
        type: input.event.eventType,
        status: 'received',
        text: input.event.text,
        body: { text: input.event.text, messageType: input.event.messageType },
        occurredAt,
        metadata: {
          provider: input.event.provider,
          providerEventId: input.event.providerEventId,
          providerMessageId: input.event.providerMessageId,
          fromMasked: maskCommunicationAddress('whatsapp', input.event.from),
          toMasked: input.event.to ? maskCommunicationAddress('whatsapp', input.event.to) : undefined,
          messageType: input.event.messageType,
          textPreview: messagePreview
        }
      }).catch(async () => {
        await this.prisma.communicationInteraction.create({
          data: {
            workspaceId,
            contactId: contact.id,
            contactChannelId: channel.id,
            sideEffectId: input.sideEffect?.id ?? null,
            providerEventId: input.providerEvent.id,
            direction: 'inbound',
            channel: 'whatsapp',
            type: input.event.eventType,
            status: 'received',
            occurredAt,
            metadataJson: toJsonValue(sanitizeAutomationPayload({
              provider: input.event.provider,
              providerEventId: input.event.providerEventId,
              providerMessageId: input.event.providerMessageId,
              fromMasked: maskCommunicationAddress('whatsapp', input.event.from!),
              toMasked: input.event.to ? maskCommunicationAddress('whatsapp', input.event.to) : undefined,
              messageType: input.event.messageType,
              textPreview: messagePreview
            }))
          }
        });
      });
      await this.openConversationWindow({
        workspaceId,
        contactId: contact.id,
        contactChannelId: channel.id,
        provider: input.event.provider,
        occurredAt,
        event: input.event
      });

      if (input.sideEffect) {
        await this.logTimeline(input.sideEffect, input.event);
      }

      await this.followupCoordinator.cancelPendingFollowupsDueToReply({
        workspaceId,
        contactId: contact.id,
        contactChannelId: channel.id,
        sideEffectId: input.sideEffect?.id,
        runId: input.sideEffect?.runId,
        from: input.event.from,
        messagePreview,
        occurredAt
      });

      return {
        event: await this.markEvent(input.providerEvent.id, 'processed'),
        status: 'processed'
      };
    } catch (error) {
      const failed = await this.prisma.communicationProviderEvent.update({
        where: { id: input.providerEvent.id },
        data: {
          status: 'failed',
          errorJson: toJsonValue(normalizeAutomationError(error))
        }
      });
      return { event: failed, status: 'failed' };
    }
  }

  private async openConversationWindow(input: {
    workspaceId: string;
    contactId: string;
    contactChannelId: string;
    provider: string;
    occurredAt: Date;
    event: NormalizedWhatsAppProviderEvent;
  }): Promise<void> {
    const expiresAt = new Date(input.occurredAt.getTime() + 24 * 60 * 60 * 1000);
    const existing = await this.prisma.communicationConversationWindow.findFirst({
      where: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        contactChannelId: input.contactChannelId,
        channel: 'whatsapp',
        status: 'open'
      },
      orderBy: { updatedAt: 'desc' }
    });

    const metadata = toJsonValue(sanitizeAutomationPayload({
      providerEventId: input.event.providerEventId,
      providerMessageId: input.event.providerMessageId,
      phoneNumberId: input.event.phoneNumberId,
      messageType: input.event.messageType
    }));

    if (existing) {
      await this.prisma.communicationConversationWindow.update({
        where: { id: existing.id },
        data: {
          provider: input.provider,
          expiresAt,
          lastInboundAt: input.occurredAt,
          status: 'open',
          metadataJson: metadata
        }
      });
      return;
    }

    await this.prisma.communicationConversationWindow.create({
      data: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        contactChannelId: input.contactChannelId,
        channel: 'whatsapp',
        provider: input.provider,
        openedAt: input.occurredAt,
        expiresAt,
        lastInboundAt: input.occurredAt,
        status: 'open',
        source: 'inbound_webhook',
        metadataJson: metadata
      }
    });
  }

  private async logTimeline(
    sideEffect: AutomationSideEffect,
    event: NormalizedProviderEvent
  ): Promise<void> {
    const recipient = getEventRecipient(event);
    const recipientMasked = recipient
      ? maskCommunicationAddress(event.channel, recipient)
      : undefined;
    const messagePreview = 'text' in event ? previewText(event.text) : undefined;
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: timelineEventType(event.eventType),
      message: event.channel === 'whatsapp'
        ? 'WhatsApp provider event received.'
        : 'Communication email provider event received.',
      payload: {
        provider: event.provider,
        channel: event.channel,
        providerEventId: event.providerEventId,
        providerMessageId: event.providerMessageId,
        eventType: event.eventType,
        recipientMasked,
        messagePreview,
        sideEffectId: sideEffect.id
      }
    });
  }

  private async syncProviderStatusMessage(
    sideEffect: AutomationSideEffect,
    providerEvent: CommunicationProviderEvent,
    event: NormalizedProviderEvent
  ): Promise<void> {
    const status = event.eventType.replace(/^(email|whatsapp)\./, '').replace('bounced', 'failed');
    const existing = await this.prisma.communicationInteraction.findFirst({
      where: {
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        direction: 'outbound'
      },
      orderBy: [{ occurredAt: 'desc' }]
    });

    if (existing) {
      await this.prisma.communicationInteraction.update({
        where: { id: existing.id },
        data: {
          providerEventId: providerEvent.id,
          status,
          provider: event.provider,
          metadataJson: toJsonValue(sanitizeAutomationPayload({
            ...(isRecord(existing.metadataJson) ? existing.metadataJson : {}),
            providerEventId: event.providerEventId,
            providerMessageId: event.providerMessageId,
            eventType: event.eventType,
            reason: 'errorMessage' in event ? event.errorMessage : undefined
          }))
        }
      });
      return;
    }

    await this.conversationService.syncSideEffectMessage({
      workspaceId: sideEffect.workspaceId,
      sideEffectId: sideEffect.id
    });
  }

  private async markEvent(id: string, status: 'processed' | 'ignored'): Promise<CommunicationProviderEvent> {
    return this.prisma.communicationProviderEvent.update({
      where: { id },
      data: {
        status,
        processedAt: new Date()
      }
    });
  }
}
