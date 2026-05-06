import type { PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { CommunicationProviderEventService } from '@/modules/automation/communication/communication-provider-event-service';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

export type MockWhatsAppEventType = 'delivered' | 'read' | 'failed' | 'replied';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readProviderMessageId(value: unknown): string | null {
  return isRecord(value) && typeof value.providerMessageId === 'string'
    ? value.providerMessageId
    : null;
}

export class MockWhatsAppEventSimulator {
  private readonly providerEventService: CommunicationProviderEventService;

  public constructor(private readonly prisma: PrismaClient, input?: {
    providerEventService?: CommunicationProviderEventService;
  }) {
    this.providerEventService = input?.providerEventService ?? new CommunicationProviderEventService(prisma);
  }

  public async simulate(input: {
    workspaceId: string;
    sideEffectId: string;
    eventType: MockWhatsAppEventType;
    messageText?: string;
    now?: Date;
    metadata?: unknown;
  }) {
    const now = input.now ?? new Date();
    const sideEffect = await this.prisma.automationSideEffect.findFirst({
      where: {
        id: input.sideEffectId,
        workspaceId: input.workspaceId,
        channel: 'whatsapp'
      }
    });

    if (!sideEffect) {
      throw new AppError('WhatsApp side effect not found.', 404);
    }

    const payload = isRecord(sideEffect.payloadJson) ? sideEffect.payloadJson : {};
    const previousResult = isRecord(sideEffect.resultJson) ? sideEffect.resultJson : {};
    const providerMessageId =
      readProviderMessageId(previousResult) ??
      `mock_whatsapp_event_${sideEffect.id}`;
    const recipient = typeof payload.to === 'string' ? payload.to : undefined;
    const eventType = input.eventType === 'replied'
      ? 'whatsapp.replied'
      : `whatsapp.${input.eventType}` as 'whatsapp.delivered' | 'whatsapp.read' | 'whatsapp.failed';

    await this.providerEventService.receiveEvent({
      event: {
        provider: 'mock',
        channel: 'whatsapp',
        providerEventId: `mock_whatsapp_${input.eventType}_${sideEffect.id}_${now.getTime()}`,
        providerMessageId,
        eventType,
        occurredAt: now,
        from: input.eventType === 'replied' ? recipient : undefined,
        to: recipient,
        text: input.messageText,
        messageType: input.eventType === 'replied' ? 'text' : undefined,
        errorCode: input.eventType === 'failed' ? 'MOCK_WHATSAPP_DELIVERY_FAILED' : undefined,
        errorMessage: input.eventType === 'failed' ? 'Mock WhatsApp delivery failed.' : undefined,
        raw: sanitizeAutomationPayload({
          sideEffectId: sideEffect.id,
          providerMessageId,
          eventType: input.eventType,
          messageText: input.messageText,
          metadata: input.metadata
        }) as Record<string, unknown>
      }
    });

    return this.prisma.automationSideEffect.findFirst({
      where: {
        id: input.sideEffectId,
        workspaceId: input.workspaceId
      }
    });
  }
}
