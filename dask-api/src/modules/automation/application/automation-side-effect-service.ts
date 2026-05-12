import { Prisma, type AutomationSideEffect, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { redactErrorMessage } from '@/core/security/redaction';
import { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { CommunicationConversationService } from '@/modules/automation/communication/communication-conversation-service';
import {
  calculateAutomationRetryAt,
  defaultAutomationRetryPolicy,
  normalizeAutomationRetryPolicy,
  type AutomationRetryPolicy
} from '@/modules/automation/runtime/automation-retry-policy';
import {
  normalizeAutomationError,
  sanitizeAutomationPayload
} from '@/modules/automation/runtime/automation-runtime-errors';

export const automationSideEffectStatuses = [
  'queued',
  'processing',
  'sent',
  'failed',
  'cancelled',
  'skipped'
] as const;
export type AutomationSideEffectStatus = (typeof automationSideEffectStatuses)[number];

export const automationSideEffectTypes = [
  'communication.email',
  'communication.whatsapp',
  'automation.mock'
] as const;
export type AutomationSideEffectType = (typeof automationSideEffectTypes)[number] | string;

type AutomationSideEffectDelegate = {
  create: (args: Prisma.AutomationSideEffectCreateArgs) => Promise<AutomationSideEffect>;
  findFirst: (args: Prisma.AutomationSideEffectFindFirstArgs) => Promise<AutomationSideEffect | null>;
  findMany: (args: Prisma.AutomationSideEffectFindManyArgs) => Promise<AutomationSideEffect[]>;
  findUnique: (args: Prisma.AutomationSideEffectFindUniqueArgs) => Promise<AutomationSideEffect | null>;
  update: (args: Prisma.AutomationSideEffectUpdateArgs) => Promise<AutomationSideEffect>;
  updateMany: (args: Prisma.AutomationSideEffectUpdateManyArgs) => Promise<{ count: number }>;
};

type PrismaWithSideEffects = PrismaClient | Prisma.TransactionClient;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function sideEffectDelegate(prisma: PrismaWithSideEffects): AutomationSideEffectDelegate {
  const delegate = (prisma as unknown as {
    automationSideEffect?: AutomationSideEffectDelegate;
  }).automationSideEffect;

  if (!delegate) {
    throw new AppError('Automation side effect outbox is not available. Run Prisma generate/migrations.', 500);
  }

  return delegate;
}

function normalizeRequiredText(value: string | null | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new AppError(`${label} is required.`, 422);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function terminalStatus(status: string): boolean {
  return ['sent', 'failed', 'cancelled', 'skipped'].includes(status);
}

function readResultSummary(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const key of ['provider', 'providerMessageId', 'status', 'sentAt']) {
    if (typeof record[key] === 'string') {
      summary[key] = record[key];
    }
  }

  return summary;
}

function readApprovalRequestId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const direct = typeof record.approvalRequestId === 'string' ? record.approvalRequestId.trim() : '';
  if (direct) {
    return direct;
  }

  const metadata = record.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const metadataRecord = metadata as Record<string, unknown>;
    const nested = typeof metadataRecord.approvalRequestId === 'string'
      ? metadataRecord.approvalRequestId.trim()
      : '';
    return nested || null;
  }

  return null;
}

function isAiGeneratedCommunication(input: {
  sideEffectType: string;
  payload: unknown;
}): boolean {
  if (!input.sideEffectType.startsWith('communication.')) {
    return false;
  }

  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    return false;
  }

  const record = input.payload as Record<string, unknown>;
  if (record.aiGenerated === true || record.unsafeToAutoSend === true) {
    return true;
  }

  const metadata = record.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  return metadataRecord.aiGenerated === true || metadataRecord.unsafeToAutoSend === true;
}

export class AutomationSideEffectService {
  private readonly eventService: AutomationRunEventService;
  private readonly approvalRequestService: AutomationApprovalRequestService;
  private readonly conversationService: CommunicationConversationService;
  private readonly retryPolicy: AutomationRetryPolicy;

  public constructor(
    private readonly prisma: PrismaClient,
    input?: {
      eventService?: AutomationRunEventService;
      retryPolicy?: Partial<AutomationRetryPolicy>;
    }
  ) {
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
    this.approvalRequestService = new AutomationApprovalRequestService(prisma, {
      eventService: this.eventService
    });
    this.conversationService = new CommunicationConversationService(prisma);
    this.retryPolicy = normalizeAutomationRetryPolicy(input?.retryPolicy ?? defaultAutomationRetryPolicy);
  }

  public async createSideEffect(input: {
    workspaceId: string;
    runId: string;
    stepRunId: string;
    sideEffectType: AutomationSideEffectType;
    channel?: string | null;
    provider?: string | null;
    idempotencyKey: string;
    payload: unknown;
    templateVersionId?: string | null;
    contactId?: string | null;
    contactChannelId?: string | null;
    approvalRequestId?: string | null;
    maxAttempts?: number;
    nextAttemptAt?: Date;
  }): Promise<AutomationSideEffect> {
    const workspaceId = normalizeRequiredText(input.workspaceId, 'workspaceId');
    const runId = normalizeRequiredText(input.runId, 'runId');
    const stepRunId = normalizeRequiredText(input.stepRunId, 'stepRunId');
    const idempotencyKey = normalizeRequiredText(input.idempotencyKey, 'idempotencyKey');
    const sideEffectType = normalizeRequiredText(input.sideEffectType, 'sideEffectType');
    const channel = normalizeOptionalText(input.channel);
    const provider = normalizeOptionalText(input.provider);
    const maxAttempts = Math.max(1, Math.trunc(input.maxAttempts ?? this.retryPolicy.maxAttempts));
    const sanitizedPayload = sanitizeAutomationPayload(input.payload);
    const approvalRequestId = normalizeOptionalText(
      input.approvalRequestId ?? readApprovalRequestId(input.payload)
    );

    if (isAiGeneratedCommunication({ sideEffectType, payload: input.payload })) {
      try {
        await this.approvalRequestService.assertApprovedForSensitiveAction({
          workspaceId,
          approvalRequestId,
          expectedType: 'send_message'
        });
      } catch (error) {
        await this.eventService.createEvent({
          workspaceId,
          runId,
          stepRunId,
          eventType: 'communication.blocked_missing_human_approval',
          level: 'warn',
          message: 'AI generated communication was blocked because human approval is missing.',
          payload: {
            sideEffectType,
            channel,
            provider,
            approvalRequestId,
            reason: redactErrorMessage(error)
          }
        });
        throw error;
      }
    }

    const existing = await sideEffectDelegate(this.prisma).findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId,
          idempotencyKey
        }
      }
    });

    if (existing) {
      return existing;
    }

    const sideEffect = await this.createSideEffectInTransaction({
      workspaceId,
      runId,
      stepRunId,
      sideEffectType,
      channel,
      provider,
      idempotencyKey,
      payload: sanitizedPayload,
      maxAttempts,
      templateVersionId: input.templateVersionId,
      contactId: input.contactId,
      contactChannelId: input.contactChannelId,
      approvalRequestId,
      nextAttemptAt: input.nextAttemptAt ?? new Date()
    });

    await this.eventService.createEvent({
      workspaceId,
      runId,
      stepRunId,
      eventType: 'side_effect.created',
      message: 'Automation side effect was queued.',
      payload: {
        sideEffectId: sideEffect.id,
        sideEffectType,
        channel,
        provider,
        status: sideEffect.status,
        idempotencyKey
      }
    });

    await this.conversationService.syncSideEffectMessage({
      workspaceId,
      sideEffectId: sideEffect.id
    }).catch(() => undefined);

    return sideEffect;
  }

  private async createSideEffectInTransaction(input: {
    workspaceId: string;
    runId: string;
    stepRunId: string;
    sideEffectType: string;
    channel: string | null;
    provider: string | null;
    idempotencyKey: string;
    payload: unknown;
    maxAttempts: number;
    templateVersionId?: string | null;
    contactId?: string | null;
    contactChannelId?: string | null;
    approvalRequestId?: string | null;
    nextAttemptAt: Date;
  }): Promise<AutomationSideEffect> {
    try {
      return await this.prisma.$transaction(async (db) => {
        const run = await db.automationRun.findFirst({
          where: { id: input.runId, workspaceId: input.workspaceId },
          select: { id: true }
        });
        if (!run) {
          throw new AppError('Automation run not found.', 404);
        }

        const stepRun = await db.automationStepRun.findFirst({
          where: {
            id: input.stepRunId,
            runId: input.runId,
            workspaceId: input.workspaceId
          },
          select: { id: true }
        });
        if (!stepRun) {
          throw new AppError('Automation step run not found.', 404);
        }

        const delegate = sideEffectDelegate(db);
        const existingInsideTx = await delegate.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey: input.idempotencyKey
            }
          }
        });
        if (existingInsideTx) {
          return existingInsideTx;
        }

        return delegate.create({
          data: {
            workspaceId: input.workspaceId,
            runId: input.runId,
            stepRunId: input.stepRunId,
            sideEffectType: input.sideEffectType,
            channel: input.channel,
            provider: input.provider,
            status: 'queued',
            idempotencyKey: input.idempotencyKey,
            payloadJson: toJsonValue(input.payload),
            templateVersionId: input.templateVersionId ?? null,
            contactId: input.contactId ?? null,
            contactChannelId: input.contactChannelId ?? null,
            approvalRequestId: input.approvalRequestId ?? null,
            maxAttempts: input.maxAttempts,
            nextAttemptAt: input.nextAttemptAt
          }
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await sideEffectDelegate(this.prisma).findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: input.workspaceId,
              idempotencyKey: input.idempotencyKey
            }
          }
        });
        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  public async listSideEffectsForRun(input: {
    workspaceId: string;
    runId: string;
    limit?: number;
  }): Promise<AutomationSideEffect[]> {
    return sideEffectDelegate(this.prisma).findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId
      },
      orderBy: [{ createdAt: 'asc' }],
      take: Math.min(Math.max(input.limit ?? 100, 1), 1000)
    });
  }

  public async findPendingSideEffects(input?: {
    now?: Date;
    limit?: number;
  }): Promise<AutomationSideEffect[]> {
    return sideEffectDelegate(this.prisma).findMany({
      where: {
        status: 'queued',
        nextAttemptAt: {
          lte: input?.now ?? new Date()
        }
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(Math.max(input?.limit ?? 50, 1), 500)
    });
  }

  public async lockNextPending(input: {
    lockedBy: string;
    now?: Date;
    limit?: number;
  }): Promise<AutomationSideEffect[]> {
    const now = input.now ?? new Date();
    const candidates = await this.findPendingSideEffects({ now, limit: input.limit });
    const locked: AutomationSideEffect[] = [];
    const delegate = sideEffectDelegate(this.prisma);

    for (const candidate of candidates) {
      const result = await delegate.updateMany({
        where: {
          id: candidate.id,
          status: 'queued',
          lockedAt: null,
          nextAttemptAt: { lte: now }
        },
        data: {
          status: 'processing',
          lockedAt: now,
          lockedBy: input.lockedBy,
          attempts: {
            increment: 1
          }
        }
      });

      if (result.count === 0) {
        continue;
      }

      const sideEffect = await delegate.findUnique({ where: { id: candidate.id } });
      if (sideEffect) {
        locked.push(sideEffect);
        await this.eventService.createEvent({
          workspaceId: sideEffect.workspaceId,
          runId: sideEffect.runId,
          stepRunId: sideEffect.stepRunId,
          eventType: 'side_effect.processing',
          message: 'Automation side effect processing started.',
          payload: {
            sideEffectId: sideEffect.id,
            sideEffectType: sideEffect.sideEffectType,
            channel: sideEffect.channel,
            provider: sideEffect.provider,
            attempt: sideEffect.attempts,
            maxAttempts: sideEffect.maxAttempts,
            lockedBy: input.lockedBy
          }
        });
      }
    }

    return locked;
  }

  public async markSent(input: {
    workspaceId: string;
    sideEffectId: string;
    result: unknown;
  }): Promise<AutomationSideEffect> {
    const sideEffect = await sideEffectDelegate(this.prisma).update({
      where: { id: input.sideEffectId },
      data: {
        status: 'sent',
        resultJson: toJsonValue(sanitizeAutomationPayload(input.result)),
        errorJson: Prisma.JsonNull,
        lockedAt: null,
        lockedBy: null,
        processedAt: new Date()
      }
    });

    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'side_effect.sent',
      message: 'Automation side effect was sent by provider.',
      payload: {
        sideEffectId: sideEffect.id,
        sideEffectType: sideEffect.sideEffectType,
        channel: sideEffect.channel,
        provider: sideEffect.provider,
        attempt: sideEffect.attempts,
        ...readResultSummary(sideEffect.resultJson)
      }
    });

    await this.conversationService.syncSideEffectMessage({
      workspaceId: sideEffect.workspaceId,
      sideEffectId: sideEffect.id
    }).catch(() => undefined);

    return sideEffect;
  }

  public async markFailed(input: {
    workspaceId: string;
    sideEffectId: string;
    error: unknown;
  }): Promise<AutomationSideEffect> {
    const safeError = normalizeAutomationError(input.error);
    const sideEffect = await sideEffectDelegate(this.prisma).update({
      where: { id: input.sideEffectId },
      data: {
        status: 'failed',
        errorJson: toJsonValue(safeError),
        lockedAt: null,
        lockedBy: null,
        processedAt: new Date()
      }
    });

    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'side_effect.failed',
      level: 'error',
      message: 'Automation side effect failed.',
      payload: {
        sideEffectId: sideEffect.id,
        sideEffectType: sideEffect.sideEffectType,
        channel: sideEffect.channel,
        provider: sideEffect.provider,
        attempt: sideEffect.attempts,
        maxAttempts: sideEffect.maxAttempts,
        error: safeError
      }
    });

    await this.conversationService.syncSideEffectMessage({
      workspaceId: sideEffect.workspaceId,
      sideEffectId: sideEffect.id
    }).catch(() => undefined);

    return sideEffect;
  }

  public async markSkipped(input: {
    workspaceId: string;
    sideEffectId: string;
    reason: string;
    payload?: unknown;
  }): Promise<AutomationSideEffect> {
    const sideEffect = await sideEffectDelegate(this.prisma).update({
      where: { id: input.sideEffectId },
      data: {
        status: 'skipped',
        errorJson: toJsonValue(sanitizeAutomationPayload({
          reason: input.reason,
          ...(input.payload && typeof input.payload === 'object' ? input.payload : {})
        })),
        lockedAt: null,
        lockedBy: null,
        processedAt: new Date()
      }
    });

    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'side_effect.skipped',
      message: 'Automation side effect was skipped.',
      payload: {
        sideEffectId: sideEffect.id,
        sideEffectType: sideEffect.sideEffectType,
        channel: sideEffect.channel,
        provider: sideEffect.provider,
        reason: input.reason,
        payload: input.payload
      }
    });

    return sideEffect;
  }

  public async updatePayload(input: {
    workspaceId: string;
    sideEffectId: string;
    payload: unknown;
    templateVersionId?: string | null;
    contactId?: string | null;
    contactChannelId?: string | null;
    approvalRequestId?: string | null;
  }): Promise<AutomationSideEffect> {
    return sideEffectDelegate(this.prisma).update({
      where: { id: input.sideEffectId },
      data: {
        payloadJson: toJsonValue(sanitizeAutomationPayload(input.payload)),
        templateVersionId: input.templateVersionId ?? undefined,
        contactId: input.contactId ?? undefined,
        contactChannelId: input.contactChannelId ?? undefined,
        approvalRequestId: input.approvalRequestId ?? undefined
      }
    });
  }

  public async scheduleRetry(input: {
    workspaceId: string;
    sideEffectId: string;
    error: unknown;
    now?: Date;
  }): Promise<AutomationSideEffect> {
    const current = await sideEffectDelegate(this.prisma).findFirst({
      where: {
        id: input.sideEffectId,
        workspaceId: input.workspaceId
      }
    });
    if (!current) {
      throw new AppError('Automation side effect not found.', 404);
    }

    const safeError = normalizeAutomationError(input.error);
    if (current.attempts >= current.maxAttempts || terminalStatus(current.status)) {
      await this.eventService.createEvent({
        workspaceId: current.workspaceId,
        runId: current.runId,
        stepRunId: current.stepRunId,
        eventType: 'side_effect.retry_exhausted',
        level: 'error',
        message: 'Automation side effect retry policy was exhausted.',
        payload: {
          sideEffectId: current.id,
          sideEffectType: current.sideEffectType,
          channel: current.channel,
          provider: current.provider,
          attempt: current.attempts,
          maxAttempts: current.maxAttempts,
          error: safeError
        }
      });
      return this.markFailed({
        workspaceId: input.workspaceId,
        sideEffectId: input.sideEffectId,
        error: safeError
      });
    }

    const nextAttemptAt = calculateAutomationRetryAt(
      current.attempts,
      input.now ?? new Date(),
      {
        ...this.retryPolicy,
        maxAttempts: current.maxAttempts
      }
    );
    const sideEffect = await sideEffectDelegate(this.prisma).update({
      where: { id: current.id },
      data: {
        status: 'queued',
        errorJson: toJsonValue(safeError),
        nextAttemptAt,
        lockedAt: null,
        lockedBy: null
      }
    });

    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'side_effect.retry_scheduled',
      level: 'warn',
      message: 'Automation side effect retry was scheduled.',
      payload: {
        sideEffectId: sideEffect.id,
        sideEffectType: sideEffect.sideEffectType,
        channel: sideEffect.channel,
        provider: sideEffect.provider,
        attempt: sideEffect.attempts,
        nextAttemptAt: sideEffect.nextAttemptAt.toISOString(),
        maxAttempts: sideEffect.maxAttempts,
        error: safeError
      }
    });

    return sideEffect;
  }

  public async cancelSideEffect(input: {
    workspaceId: string;
    sideEffectId: string;
    reason?: string | null;
  }): Promise<AutomationSideEffect> {
    const now = new Date();
    const reason = input.reason ?? 'Automation side effect was cancelled.';
    const sideEffect = await sideEffectDelegate(this.prisma).update({
      where: { id: input.sideEffectId },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: reason,
        lockedAt: null,
        lockedBy: null,
        processedAt: now
      }
    });

    await this.eventService.createEvent({
      workspaceId: sideEffect.workspaceId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      eventType: 'side_effect.cancelled',
      message: 'Automation side effect was cancelled.',
      payload: {
        sideEffectId: sideEffect.id,
        sideEffectType: sideEffect.sideEffectType,
        channel: sideEffect.channel,
        provider: sideEffect.provider,
        reason
      }
    });

    return sideEffect;
  }

  public async cancelRunSideEffects(input: {
    workspaceId: string;
    runId: string;
    reason?: string | null;
  }): Promise<{ count: number }> {
    const now = new Date();
    const reason = input.reason ?? 'Automation run was cancelled.';
    const sideEffects = await sideEffectDelegate(this.prisma).findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        status: { in: ['queued', 'processing'] }
      }
    });

    if (sideEffects.length === 0) {
      return { count: 0 };
    }

    const result = await sideEffectDelegate(this.prisma).updateMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        status: { in: ['queued', 'processing'] }
      },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: reason,
        lockedAt: null,
        lockedBy: null,
        processedAt: now
      }
    });

    for (const sideEffect of sideEffects) {
      await this.eventService.createEvent({
        workspaceId: sideEffect.workspaceId,
        runId: sideEffect.runId,
        stepRunId: sideEffect.stepRunId,
        eventType: 'side_effect.cancelled',
        message: 'Automation side effect was cancelled.',
        payload: {
          sideEffectId: sideEffect.id,
          sideEffectType: sideEffect.sideEffectType,
          channel: sideEffect.channel,
          provider: sideEffect.provider,
          reason
        }
      });
    }

    return result;
  }
}
