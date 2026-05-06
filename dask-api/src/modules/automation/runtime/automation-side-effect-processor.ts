import type { AutomationSideEffect, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import { maskCommunicationAddress, normalizeCommunicationAddress } from '@/modules/automation/communication/communication-address';
import { CommunicationConsentService } from '@/modules/automation/communication/communication-consent-service';
import { CommunicationRecipientResolver } from '@/modules/automation/communication/communication-recipient-resolver';
import {
  CommunicationProviderError,
  type CommunicationChannel,
  type CommunicationSendInput
} from '@/modules/automation/communication/communication-provider';
import type { CommunicationProviderRegistry } from '@/modules/automation/communication/communication-provider-registry';
import { createDefaultCommunicationProviderRegistry } from '@/modules/automation/communication/default-communication-provider-registry';
import { CommunicationSuppressionService } from '@/modules/automation/communication/communication-suppression-service';
import { CommunicationTemplateService } from '@/modules/automation/communication/communication-template-service';

export type AutomationSideEffectProcessorResult = {
  locked: number;
  sent: number;
  failed: number;
  cancelled: number;
  retried: number;
  skipped: number;
};

const terminalRunStatuses = new Set(['cancelled', 'failed', 'completed']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeProviderError(error: unknown): Record<string, unknown> {
  if (error instanceof CommunicationProviderError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
      details: error.details
    };
  }

  if (error instanceof AppError) {
    return {
      message: error.message,
      code: 'APP_ERROR',
      retryable: error.statusCode >= 500,
      statusCode: error.statusCode,
      details: error.details
    };
  }

  if (isRecord(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNEXPECTED_PROVIDER_ERROR',
      retryable: false,
      name: error.name
    };
  }

  return {
    message: String(error),
    code: 'UNKNOWN_PROVIDER_ERROR',
    retryable: false
  };
}

function isRetryable(error: Record<string, unknown>): boolean {
  return error.retryable === true;
}

function buildCommunicationInput(sideEffect: AutomationSideEffect): CommunicationSendInput {
  const payload = isRecord(sideEffect.payloadJson) ? sideEffect.payloadJson : {};
  const channel = readString(sideEffect.channel) as CommunicationChannel | null;
  const to = readString(payload.to);
  const body = readString(payload.body) ?? readString(payload.text) ?? readString(payload.html);
  const subject = readString(payload.subject) ?? undefined;
  const from = readString(payload.from) ?? undefined;
  const replyTo = readString(payload.replyTo) ?? undefined;
  const text = readString(payload.text) ?? undefined;
  const html = readString(payload.html) ?? undefined;
  const metadata = isRecord(payload.metadata) ? payload.metadata : undefined;

  if (channel !== 'email' && channel !== 'whatsapp') {
    throw new AppError('Unsupported communication side effect channel.', 422, {
      sideEffectId: sideEffect.id,
      channel: sideEffect.channel
    });
  }
  if (!to) {
    throw new AppError('Communication side effect recipient is required.', 422, {
      sideEffectId: sideEffect.id
    });
  }
  if (!body) {
    throw new AppError('Communication side effect body is required.', 422, {
      sideEffectId: sideEffect.id
    });
  }

  return {
    workspaceId: sideEffect.workspaceId,
    runId: sideEffect.runId,
    stepRunId: sideEffect.stepRunId,
    channel,
    to,
    from,
    replyTo,
    subject,
    body,
    text,
    html,
    metadata
  };
}

function hasProviderMessageId(sideEffect: AutomationSideEffect): boolean {
  return isRecord(sideEffect.resultJson) && readString(sideEffect.resultJson.providerMessageId) !== null;
}

export class AutomationSideEffectProcessor {
  private readonly sideEffectService: AutomationSideEffectService;
  private readonly providerRegistry: CommunicationProviderRegistry;
  private readonly eventService: AutomationRunEventService;
  private readonly templateService: CommunicationTemplateService;
  private readonly consentService: CommunicationConsentService;
  private readonly suppressionService: CommunicationSuppressionService;
  private readonly recipientResolver: CommunicationRecipientResolver;

  public constructor(
    private readonly prisma: PrismaClient,
    input?: {
      sideEffectService?: AutomationSideEffectService;
      eventService?: AutomationRunEventService;
      providerRegistry?: CommunicationProviderRegistry;
      templateService?: CommunicationTemplateService;
      consentService?: CommunicationConsentService;
      suppressionService?: CommunicationSuppressionService;
      recipientResolver?: CommunicationRecipientResolver;
    }
  ) {
    const eventService = input?.eventService ?? new AutomationRunEventService(prisma);
    this.eventService = eventService;
    this.sideEffectService = input?.sideEffectService ?? new AutomationSideEffectService(prisma, {
      eventService
    });
    this.providerRegistry = input?.providerRegistry ?? createDefaultCommunicationProviderRegistry();
    this.templateService = input?.templateService ?? new CommunicationTemplateService(prisma);
    this.consentService = input?.consentService ?? new CommunicationConsentService(prisma);
    this.suppressionService = input?.suppressionService ?? new CommunicationSuppressionService(prisma);
    this.recipientResolver = input?.recipientResolver ?? new CommunicationRecipientResolver(prisma, {
      consentService: this.consentService,
      suppressionService: this.suppressionService
    });
  }

  public async processPending(input: {
    lockedBy: string;
    limit?: number;
    now?: Date;
  }): Promise<AutomationSideEffectProcessorResult> {
    const sideEffects = await this.sideEffectService.lockNextPending({
      lockedBy: input.lockedBy,
      limit: input.limit,
      now: input.now
    });

    const result: AutomationSideEffectProcessorResult = {
      locked: sideEffects.length,
      sent: 0,
      failed: 0,
      cancelled: 0,
      retried: 0,
      skipped: 0
    };

    for (const sideEffect of sideEffects) {
      const outcome = await this.processSideEffect(sideEffect, input.now ?? new Date());
      result[outcome] += 1;
    }

    return result;
  }

  private async processSideEffect(
    sideEffect: AutomationSideEffect,
    now: Date
  ): Promise<'sent' | 'failed' | 'cancelled' | 'retried' | 'skipped'> {
    if (sideEffect.status === 'sent' || hasProviderMessageId(sideEffect)) {
      return 'sent';
    }

    const run = await this.prisma.automationRun.findFirst({
      where: {
        id: sideEffect.runId,
        workspaceId: sideEffect.workspaceId
      },
      select: {
        id: true,
        status: true,
        cancelledAt: true,
        cancelReason: true,
        contextJson: true
      }
    });

    if (!run || run.cancelledAt || terminalRunStatuses.has(run.status)) {
      await this.sideEffectService.cancelSideEffect({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: run?.cancelReason ?? `Automation run is ${run?.status ?? 'missing'}.`
      });
      return 'cancelled';
    }

    try {
      const prepared = await this.prepareCommunicationSideEffect(sideEffect, toRecord(run.contextJson), now);
      if (prepared.status === 'skipped') {
        return 'skipped';
      }
      sideEffect = prepared.sideEffect;
      const providerName = readString(sideEffect.provider) ?? 'mock';
      const channel = readString(sideEffect.channel);
      if (!channel) {
        throw new AppError('Communication side effect channel is required.', 422, {
          sideEffectId: sideEffect.id
        });
      }

      const provider = this.providerRegistry.resolve({
        channel,
        provider: providerName
      });
      const sendInput = buildCommunicationInput(sideEffect);
      const sendResult = await provider.send(sendInput);
      await this.sideEffectService.markSent({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        result: sendResult
      });
      if (channel === 'whatsapp') {
        await this.eventService.createEvent({
          workspaceId: sideEffect.workspaceId,
          runId: sideEffect.runId,
          stepRunId: sideEffect.stepRunId,
          eventType: 'communication.whatsapp.sent',
          message: 'Mock WhatsApp message was sent.',
          payload: {
            sideEffectId: sideEffect.id,
            provider: providerName,
            providerMessageId: sendResult.providerMessageId,
            status: sendResult.status,
            recipientMasked: maskCommunicationAddress('whatsapp', sendInput.to)
          }
        });
      }
      return 'sent';
    } catch (error) {
      const safeError = normalizeProviderError(error);
      if (isRetryable(safeError) && sideEffect.attempts < sideEffect.maxAttempts) {
        await this.sideEffectService.scheduleRetry({
          workspaceId: sideEffect.workspaceId,
          sideEffectId: sideEffect.id,
          error: safeError,
          now
        });
        return 'retried';
      }

      if (isRetryable(safeError)) {
        await this.sideEffectService.scheduleRetry({
          workspaceId: sideEffect.workspaceId,
          sideEffectId: sideEffect.id,
          error: safeError,
          now
        });
      } else {
        await this.sideEffectService.markFailed({
          workspaceId: sideEffect.workspaceId,
          sideEffectId: sideEffect.id,
          error: safeError
        });
      }
      return 'failed';
    }
  }

  private async prepareCommunicationSideEffect(
    sideEffect: AutomationSideEffect,
    runContext: Record<string, unknown>,
    now: Date
  ): Promise<{ status: 'ready'; sideEffect: AutomationSideEffect } | { status: 'skipped' }> {
    if (sideEffect.channel === 'whatsapp') {
      return this.prepareWhatsAppSideEffect(sideEffect, runContext, now);
    }

    return this.prepareEmailSideEffect(sideEffect, runContext, now);
  }

  private async prepareWhatsAppSideEffect(
    sideEffect: AutomationSideEffect,
    runContext: Record<string, unknown>,
    now: Date
  ): Promise<{ status: 'ready'; sideEffect: AutomationSideEffect } | { status: 'skipped' }> {
    const payload = toRecord(sideEffect.payloadJson);
    const to = readString(payload.to);
    const recipientPayload = toRecord(payload.recipient);
    if (!to && Object.keys(recipientPayload).length === 0) {
      await this.sideEffectService.markFailed({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        error: {
          message: 'WhatsApp recipient is required.',
          code: 'WHATSAPP_RECIPIENT_REQUIRED',
          retryable: false
        }
      });
      return { status: 'skipped' };
    }

    const recipient = await this.recipientResolver.resolveRecipient({
      workspaceId: sideEffect.workspaceId,
      channel: 'whatsapp',
      address: to,
      recipient: recipientPayload,
      context: {
        ...runContext,
        ...toRecord(payload.context)
      },
      category: readString(payload.category) ?? 'utility'
    });
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: recipient.blocked ? 'communication.recipient.blocked' : 'communication.recipient.resolved',
      message: recipient.blocked
        ? 'WhatsApp recipient was blocked.'
        : 'WhatsApp recipient was resolved.',
      payload: {
        sideEffectId: sideEffect.id,
        contactId: recipient.contactId,
        contactChannelId: recipient.contactChannelId,
        channel: 'whatsapp',
        recipientMasked: recipient.recipientMasked,
        consentStatus: recipient.consentStatus,
        blocked: recipient.blocked,
        reason: recipient.blockReason
      }
    });
    if (recipient.blocked) {
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'communication.whatsapp.consent_blocked',
        message: 'WhatsApp side effect was blocked by consent or channel status.',
        payload: {
          sideEffectId: sideEffect.id,
          recipientMasked: recipient.recipientMasked,
          status: recipient.consentStatus,
          reason: recipient.blockReason
        }
      });
      await this.sideEffectService.updatePayload({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        contactId: recipient.contactId,
        contactChannelId: recipient.contactChannelId,
        payload: {
          ...payload,
          to: recipient.normalizedAddress
        }
      });
      await this.sideEffectService.markSkipped({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: recipient.blockReason ?? 'whatsapp_recipient_blocked',
        payload: {
          recipientMasked: recipient.recipientMasked,
          consentStatus: recipient.consentStatus
        }
      });
      return { status: 'skipped' };
    }

    const suppression = await this.suppressionService.checkSuppression({
      workspaceId: sideEffect.workspaceId,
      channel: 'whatsapp',
      address: recipient.normalizedAddress,
      now
    });
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'communication.suppression_checked',
      message: 'WhatsApp suppression was checked.',
      payload: {
        sideEffectId: sideEffect.id,
        channel: 'whatsapp',
        recipientMasked: recipient.recipientMasked,
        blocked: suppression.blocked,
        reason: suppression.reason
      }
    });
    if (suppression.blocked) {
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'communication.suppression_blocked',
        message: 'WhatsApp side effect was blocked by suppression.',
        payload: {
          sideEffectId: sideEffect.id,
          channel: 'whatsapp',
          recipientMasked: recipient.recipientMasked,
          reason: suppression.reason,
          suppressionId: suppression.suppressionId
        }
      });
      await this.sideEffectService.markSkipped({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: 'suppressed',
        payload: {
          recipientMasked: recipient.recipientMasked,
          suppressionId: suppression.suppressionId,
          suppressionReason: suppression.reason
        }
      });
      return { status: 'skipped' };
    }

    const templateKey = readString(payload.templateKey);
    const templateVersionId = readString(payload.templateVersionId) ?? sideEffect.templateVersionId;
    if (!templateKey && !templateVersionId) {
      await this.sideEffectService.markSkipped({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: 'whatsapp_template_required',
        payload: {
          recipientMasked: recipient.recipientMasked
        }
      });
      return { status: 'skipped' };
    }

    const rendered = await this.templateService.renderApprovedWhatsAppTemplate({
      workspaceId: sideEffect.workspaceId,
      templateKey,
      templateVersionId,
      context: {
        ...runContext,
        ...toRecord(payload.context),
        ...toRecord(payload.variables),
        payload,
        contact: {
          ...toRecord(toRecord(runContext).contact),
          ...toRecord(toRecord(payload.context).contact),
          phone: recipient.normalizedAddress
        }
      }
    });

    const consent = await this.consentService.checkConsent({
      workspaceId: sideEffect.workspaceId,
      channel: 'whatsapp',
      address: recipient.normalizedAddress,
      category: rendered.category
    });
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'communication.consent_checked',
      message: 'WhatsApp consent was checked.',
      payload: {
        sideEffectId: sideEffect.id,
        channel: 'whatsapp',
        recipientMasked: recipient.recipientMasked,
        category: rendered.category,
        status: consent.status,
        allowed: consent.allowed
      }
    });
    if (!consent.allowed) {
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'communication.whatsapp.consent_blocked',
        message: 'WhatsApp side effect was blocked by consent.',
        payload: {
          sideEffectId: sideEffect.id,
          recipientMasked: recipient.recipientMasked,
          category: rendered.category,
          status: consent.status,
          reason: consent.reason
        }
      });
      await this.sideEffectService.markSkipped({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: consent.reason ?? 'whatsapp_consent_blocked',
        payload: {
          recipientMasked: recipient.recipientMasked,
          category: rendered.category,
          consentStatus: consent.status
        }
      });
      return { status: 'skipped' };
    }

    const renderedSideEffect = await this.sideEffectService.updatePayload({
      workspaceId: sideEffect.workspaceId,
      sideEffectId: sideEffect.id,
      templateVersionId: rendered.templateVersionId,
      contactId: recipient.contactId,
      contactChannelId: recipient.contactChannelId,
      payload: {
        ...payload,
        to: recipient.normalizedAddress,
        channel: 'whatsapp',
        provider: readString(sideEffect.provider) ?? 'mock',
        category: rendered.category,
        body: rendered.text ?? rendered.html,
        text: rendered.text,
        templateId: rendered.templateId,
        templateKey,
        templateVersionId: rendered.templateVersionId,
        providerTemplateName: rendered.providerTemplateName,
        providerTemplateId: rendered.providerTemplateId,
        language: rendered.language ?? 'pt_BR',
        approvalStatus: rendered.approvalStatus,
        metadata: {
          ...toRecord(payload.metadata),
          mockWhatsapp: true
        }
      }
    });
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'template.rendered',
      message: 'WhatsApp template was rendered.',
      payload: {
        sideEffectId: sideEffect.id,
        channel: 'whatsapp',
        recipientMasked: recipient.recipientMasked,
        category: rendered.category,
        templateId: rendered.templateId,
        templateVersionId: rendered.templateVersionId,
        providerTemplateName: rendered.providerTemplateName,
        language: rendered.language,
        approvalStatus: rendered.approvalStatus
      }
    });

    return { status: 'ready', sideEffect: renderedSideEffect };
  }

  private async prepareEmailSideEffect(
    sideEffect: AutomationSideEffect,
    runContext: Record<string, unknown>,
    now: Date
  ): Promise<{ status: 'ready'; sideEffect: AutomationSideEffect } | { status: 'skipped' }> {
    if (sideEffect.channel !== 'email') {
      return { status: 'ready', sideEffect };
    }

    const payload = toRecord(sideEffect.payloadJson);
    const to = readString(payload.to);
    if (!to) {
      await this.sideEffectService.markFailed({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        error: {
          message: 'Email recipient is required.',
          code: 'EMAIL_RECIPIENT_REQUIRED',
          retryable: false
        }
      });
      return { status: 'skipped' };
    }

    const address = normalizeCommunicationAddress('email', to);
    const recipientMasked = maskCommunicationAddress('email', address);
    const recipient = await this.recipientResolver.resolveRecipient({
      workspaceId: sideEffect.workspaceId,
      channel: 'email',
      address,
      recipient: payload.recipient,
      context: {
        ...runContext,
        ...toRecord(payload.context)
      },
      category: readString(payload.category) ?? 'follow_up'
    });
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: recipient.blocked ? 'communication.recipient.blocked' : 'communication.recipient.resolved',
      message: recipient.blocked
        ? 'Communication recipient was blocked.'
        : 'Communication recipient was resolved.',
      payload: {
        sideEffectId: sideEffect.id,
        contactId: recipient.contactId,
        contactChannelId: recipient.contactChannelId,
        channel: 'email',
        recipientMasked: recipient.recipientMasked,
        blocked: recipient.blocked,
        reason: recipient.blockReason
      }
    });
    if (recipient.blocked) {
      await this.sideEffectService.updatePayload({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        contactId: recipient.contactId,
        contactChannelId: recipient.contactChannelId,
        payload: {
          ...payload,
          to: recipient.normalizedAddress
        }
      });
      await this.sideEffectService.markSkipped({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: recipient.blockReason ?? 'recipient_blocked',
        payload: {
          recipientMasked: recipient.recipientMasked,
          contactId: recipient.contactId,
          contactChannelId: recipient.contactChannelId
        }
      });
      return { status: 'skipped' };
    }

    const suppression = await this.suppressionService.checkSuppression({
      workspaceId: sideEffect.workspaceId,
      channel: 'email',
      address: recipient.normalizedAddress,
      now
    });
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'communication.suppression_checked',
      message: 'Communication suppression was checked.',
      payload: {
        sideEffectId: sideEffect.id,
        channel: 'email',
        recipientMasked: recipient.recipientMasked,
        blocked: suppression.blocked,
        reason: suppression.reason
      }
    });
    if (suppression.blocked) {
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'communication.suppression_blocked',
        message: 'Communication side effect was blocked by suppression.',
        payload: {
          sideEffectId: sideEffect.id,
          channel: 'email',
          recipientMasked: recipient.recipientMasked,
          reason: suppression.reason,
          suppressionId: suppression.suppressionId
        }
      });
      await this.sideEffectService.markSkipped({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: 'suppressed',
        payload: {
          recipientMasked: recipient.recipientMasked,
          suppressionId: suppression.suppressionId,
          suppressionReason: suppression.reason
        }
      });
      return { status: 'skipped' };
    }

    const templateKey = readString(payload.templateKey);
    const templateVersionId = readString(payload.templateVersionId) ?? sideEffect.templateVersionId;
    let category = readString(payload.category) ?? 'follow_up';
    let renderedSideEffect = sideEffect;
    if (templateKey || templateVersionId) {
      const rendered = await this.templateService.renderPublishedTemplate({
        workspaceId: sideEffect.workspaceId,
        templateKey,
        templateVersionId,
        context: {
          ...runContext,
          ...toRecord(payload.context),
          payload,
          contact: {
            ...toRecord(toRecord(runContext).contact),
            ...toRecord(toRecord(payload.context).contact),
            email: address
          }
        }
      });
      category = rendered.category;
      renderedSideEffect = await this.sideEffectService.updatePayload({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        templateVersionId: rendered.templateVersionId,
        contactId: recipient.contactId,
        contactChannelId: recipient.contactChannelId,
        payload: {
          ...payload,
          to: recipient.normalizedAddress,
          category,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          body: rendered.text ?? rendered.html,
          templateId: rendered.templateId,
          templateVersionId: rendered.templateVersionId
        }
      });
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'template.rendered',
        message: 'Communication template was rendered.',
        payload: {
          sideEffectId: sideEffect.id,
          channel: 'email',
          recipientMasked: recipient.recipientMasked,
          category,
          templateId: rendered.templateId,
          templateVersionId: rendered.templateVersionId
        }
      });
    } else if (!sideEffect.contactId || !sideEffect.contactChannelId || payload.to !== recipient.normalizedAddress) {
      renderedSideEffect = await this.sideEffectService.updatePayload({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        contactId: recipient.contactId,
        contactChannelId: recipient.contactChannelId,
        payload: {
          ...payload,
          to: recipient.normalizedAddress
        }
      });
    }

    const consent = await this.consentService.checkConsent({
      workspaceId: sideEffect.workspaceId,
      channel: 'email',
      address: recipient.normalizedAddress,
      category
    });
    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'communication.consent_checked',
      message: 'Communication consent was checked.',
      payload: {
        sideEffectId: sideEffect.id,
        channel: 'email',
        recipientMasked: recipient.recipientMasked,
        category,
        status: consent.status,
        allowed: consent.allowed
      }
    });
    if (!consent.allowed) {
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'communication.consent_blocked',
        message: 'Communication side effect was blocked by consent.',
        payload: {
          sideEffectId: sideEffect.id,
          channel: 'email',
          recipientMasked: recipient.recipientMasked,
          category,
          status: consent.status,
          reason: consent.reason
        }
      });
      await this.sideEffectService.markSkipped({
        workspaceId: sideEffect.workspaceId,
        sideEffectId: sideEffect.id,
        reason: consent.reason ?? 'consent_blocked',
        payload: {
          recipientMasked,
          category,
          consentStatus: consent.status
        }
      });
      return { status: 'skipped' };
    }

    return { status: 'ready', sideEffect: renderedSideEffect };
  }
}
