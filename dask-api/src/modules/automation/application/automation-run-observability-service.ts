import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { maskEmail, maskPhone } from '@/core/security/redaction';
import {
  isAutomationRunStatus,
  normalizeAutomationLimit,
  type AutomationRunStatus
} from '@/modules/automation/application/workflow-execution-types';
import {
  normalizeAutomationError,
  sanitizeAutomationPayload
} from '@/modules/automation/runtime/automation-runtime-errors';

type RunListInput = {
  workspaceId: string;
  workflowId?: string;
  status?: string;
  triggerType?: string;
  triggerTypes?: string[];
  triggerRefIdContains?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
};

type RunDetailInput = {
  workspaceId: string;
  runId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isJsonNull(value: unknown): boolean {
  return value === null || value === Prisma.JsonNull;
}

function sanitizeJson(value: unknown): unknown {
  if (isJsonNull(value)) {
    return null;
  }

  return sanitizeAutomationPayload(value);
}

function sanitizeError(value: unknown): unknown {
  if (isJsonNull(value)) {
    return null;
  }

  return normalizeAutomationError(value);
}

function summarizePayload(value: unknown): unknown {
  const safe = sanitizeJson(value);
  if (!isRecord(safe)) {
    return safe;
  }

  const summary: Record<string, unknown> = {};
  for (const key of [
    'workflowId',
    'workflowVersionId',
    'triggerType',
    'status',
    'nodeId',
    'nodeType',
    'sideEffectId',
    'sideEffectType',
    'channel',
    'provider',
    'providerMessageId',
    'attempt',
    'maxAttempts',
    'nextAttemptAt',
    'reason',
    'error'
  ]) {
    if (safe[key] !== undefined) {
      summary[key] = safe[key];
    }
  }

  return Object.keys(summary).length > 0 ? summary : safe;
}

function millisecondsBetween(start: Date | null, end: Date | null): number | null {
  if (!start) {
    return null;
  }

  const finalDate = end ?? new Date();
  return Math.max(0, finalDate.getTime() - start.getTime());
}

function buildDateWhere(input: Pick<RunListInput, 'dateFrom' | 'dateTo'>) {
  if (!input.dateFrom && !input.dateTo) {
    return undefined;
  }

  return {
    ...(input.dateFrom ? { gte: input.dateFrom } : {}),
    ...(input.dateTo ? { lte: input.dateTo } : {})
  };
}

export class AutomationRunObservabilityService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listRuns(input: RunListInput) {
    if (input.status && !isAutomationRunStatus(input.status)) {
      throw new AppError('Invalid automation run status.', 422);
    }

    const search = input.search?.trim();
    const where: Prisma.AutomationRunWhereInput = {
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      status: input.status as AutomationRunStatus | undefined,
      triggerType: input.triggerTypes?.length ? { in: input.triggerTypes } : input.triggerType,
      triggerRefId: input.triggerRefIdContains
        ? { contains: input.triggerRefIdContains, mode: 'insensitive' }
        : undefined,
      createdAt: buildDateWhere(input),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { triggerType: { contains: search, mode: 'insensitive' } },
              { workflow: { name: { contains: search, mode: 'insensitive' } } }
            ]
          }
        : {})
    };

    const runs = await this.prisma.automationRun.findMany({
      where,
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        workflowVersion: {
          select: {
            id: true,
            version: true,
            status: true
          }
        },
        events: {
          orderBy: [{ createdAt: 'desc' }],
          take: 1
        },
        _count: {
          select: {
            stepRuns: true,
            sideEffects: true,
            events: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }],
      take: normalizeAutomationLimit(input.limit, 50, 500)
    });

    const runIds = runs.map((run) => run.id);
    const failedStepsByRun = await this.countFailedSteps(runIds, input.workspaceId);

    return {
      items: runs.map((run) => ({
        runId: run.id,
        workspaceId: run.workspaceId,
        workflowId: run.workflowId,
        workflowName: run.workflow.name,
        workflowStatus: run.workflow.status,
        workflowVersionId: run.workflowVersionId,
        workflowVersion: run.workflowVersion.version,
        workflowVersionStatus: run.workflowVersion.status,
        status: run.status,
        triggerType: run.triggerType,
        triggerRefId: run.triggerRefId,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        cancelledAt: run.cancelledAt,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        durationMs: millisecondsBetween(run.startedAt, run.finishedAt),
        stepsCount: run._count.stepRuns,
        failedStepsCount: failedStepsByRun.get(run.id) ?? 0,
        sideEffectsCount: run._count.sideEffects,
        eventsCount: run._count.events,
        lastEvent: run.events[0]
          ? this.serializeEvent(run.events[0])
          : null,
        error: sanitizeError(run.errorJson)
      }))
    };
  }

  public async getRunDetail(input: RunDetailInput) {
    const run = await this.prisma.automationRun.findFirst({
      where: {
        id: input.runId,
        workspaceId: input.workspaceId
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        workflowVersion: {
          select: {
            id: true,
            version: true,
            status: true
          }
        },
        stepRuns: {
          include: {
            scheduledSteps: {
              orderBy: [{ executeAt: 'asc' }]
            }
          },
          orderBy: [{ createdAt: 'asc' }, { attempt: 'asc' }]
        },
        events: {
          orderBy: [{ createdAt: 'asc' }]
        },
        sideEffects: {
          include: {
            contact: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                companyName: true,
                primaryEmail: true,
                primaryPhone: true,
                status: true
              }
            },
            contactChannel: {
              select: {
                id: true,
                channel: true,
                address: true,
                normalizedAddress: true,
                label: true,
                status: true
              }
            },
            providerEvents: {
              orderBy: [{ receivedAt: 'desc' }],
              take: 10
            }
          },
          orderBy: [{ createdAt: 'asc' }]
        }
      }
    });

    if (!run) {
      throw new AppError('Automation run not found.', 404);
    }

    const steps = run.stepRuns.map((step) => this.serializeStepRun(step));
    const sideEffects = run.sideEffects.map((sideEffect) => this.serializeSideEffect(sideEffect));
    const emailSideEffects = sideEffects.filter((sideEffect) => sideEffect.channel === 'email');

    return {
      run: {
        runId: run.id,
        workspaceId: run.workspaceId,
        workflowId: run.workflowId,
        workflowVersionId: run.workflowVersionId,
        status: run.status,
        triggerType: run.triggerType,
        triggerRefId: run.triggerRefId,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        cancelledAt: run.cancelledAt,
        cancelReason: run.cancelReason,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        durationMs: millisecondsBetween(run.startedAt, run.finishedAt),
        context: summarizePayload(run.contextJson),
        error: sanitizeError(run.errorJson),
        canCancel: ['queued', 'running', 'waiting'].includes(run.status),
        canRetry: false
      },
      workflow: run.workflow,
      workflowVersion: run.workflowVersion,
      summary: {
        stepsCount: steps.length,
        failedStepsCount: steps.filter((step) => step.status === 'failed').length,
        sideEffectsCount: sideEffects.length,
        sentEmailsCount: emailSideEffects.filter((sideEffect) => sideEffect.status === 'sent').length,
        retriesCount: steps.reduce((total, step) => total + Math.max(0, step.attempt - 1), 0) +
          sideEffects.reduce((total, sideEffect) => total + Math.max(0, sideEffect.attempts - 1), 0),
        eventsCount: run.events.length
      },
      steps,
      events: run.events.map((event) => this.serializeEvent(event)),
      sideEffects
    };
  }

  public async listEvents(input: RunDetailInput & { limit?: number }) {
    await this.ensureRun(input);
    const events = await this.prisma.automationRunEvent.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId
      },
      orderBy: [{ createdAt: 'asc' }],
      take: normalizeAutomationLimit(input.limit, 100, 1000)
    });

    return { items: events.map((event) => this.serializeEvent(event)) };
  }

  public async listSteps(input: RunDetailInput) {
    await this.ensureRun(input);
    const steps = await this.prisma.automationStepRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId
      },
      include: {
        scheduledSteps: {
          orderBy: [{ executeAt: 'asc' }]
        }
      },
      orderBy: [{ createdAt: 'asc' }, { attempt: 'asc' }]
    });

    return { items: steps.map((step) => this.serializeStepRun(step)) };
  }

  public async listSideEffects(input: RunDetailInput & { limit?: number }) {
    await this.ensureRun(input);
    const sideEffects = await this.prisma.automationSideEffect.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId
      },
      include: {
        contact: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            companyName: true,
            primaryEmail: true,
            primaryPhone: true,
            status: true
          }
        },
        contactChannel: {
          select: {
            id: true,
            channel: true,
            address: true,
            normalizedAddress: true,
            label: true,
            status: true
          }
        },
        providerEvents: {
          orderBy: [{ receivedAt: 'desc' }],
          take: 10
        }
      },
      orderBy: [{ createdAt: 'asc' }],
      take: normalizeAutomationLimit(input.limit, 100, 1000)
    });

    return { items: sideEffects.map((sideEffect) => this.serializeSideEffect(sideEffect)) };
  }

  private async ensureRun(input: RunDetailInput): Promise<void> {
    const run = await this.prisma.automationRun.findFirst({
      where: {
        id: input.runId,
        workspaceId: input.workspaceId
      },
      select: { id: true }
    });

    if (!run) {
      throw new AppError('Automation run not found.', 404);
    }
  }

  private async countFailedSteps(runIds: string[], workspaceId: string): Promise<Map<string, number>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.automationStepRun.groupBy({
      by: ['runId'],
      where: {
        workspaceId,
        runId: { in: runIds },
        status: 'failed'
      },
      _count: {
        _all: true
      }
    });

    return new Map(rows.map((row) => [row.runId, row._count._all]));
  }

  private serializeEvent(event: {
    id: string;
    runId: string;
    stepRunId: string | null;
    eventType: string;
    level: string;
    message: string;
    payloadJson: Prisma.JsonValue | null;
    createdAt: Date;
  }) {
    return {
      id: event.id,
      runId: event.runId,
      stepRunId: event.stepRunId,
      eventType: event.eventType,
      level: event.level,
      message: event.message,
      payload: summarizePayload(event.payloadJson),
      createdAt: event.createdAt
    };
  }

  private serializeStepRun(step: {
    id: string;
    runId: string;
    nodeId: string;
    nodeType: string;
    status: string;
    inputJson: Prisma.JsonValue | null;
    outputJson: Prisma.JsonValue | null;
    errorJson: Prisma.JsonValue | null;
    attempt: number;
    idempotencyKey: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    scheduledSteps?: Array<{
      id: string;
      nodeId: string;
      purpose: string;
      executeAt: Date;
      status: string;
      attempts: number;
      cancelledAt: Date | null;
      cancelReason: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }) {
    return {
      id: step.id,
      runId: step.runId,
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      stepStatus: step.status,
      status: step.status,
      attempt: step.attempt,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
      durationMs: millisecondsBetween(step.startedAt, step.finishedAt),
      input: summarizePayload(step.inputJson),
      output: summarizePayload(step.outputJson),
      error: sanitizeError(step.errorJson),
      idempotencyKey: step.idempotencyKey ? '[REDACTED]' : null,
      scheduledSteps: (step.scheduledSteps ?? []).map((scheduledStep) => ({
        id: scheduledStep.id,
        nodeId: scheduledStep.nodeId,
        purpose: scheduledStep.purpose,
        executeAt: scheduledStep.executeAt,
        status: scheduledStep.status,
        attempts: scheduledStep.attempts,
        cancelledAt: scheduledStep.cancelledAt,
        cancelReason: scheduledStep.cancelReason,
        createdAt: scheduledStep.createdAt,
        updatedAt: scheduledStep.updatedAt
      }))
    };
  }

  private serializeSideEffect(sideEffect: {
    id: string;
    runId: string;
    stepRunId: string;
    sideEffectType: string;
    channel: string | null;
    provider: string | null;
    status: string;
    idempotencyKey: string;
    payloadJson: Prisma.JsonValue;
    resultJson: Prisma.JsonValue | null;
    errorJson: Prisma.JsonValue | null;
    templateVersionId: string | null;
    contactId: string | null;
    contactChannelId: string | null;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt: Date;
    lockedAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    processedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    contact?: {
      id: string;
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
      companyName: string | null;
      primaryEmail: string | null;
      primaryPhone: string | null;
      status: string;
    } | null;
    contactChannel?: {
      id: string;
      channel: string;
      address: string;
      normalizedAddress: string;
      label: string | null;
      status: string;
    } | null;
    providerEvents?: Array<{
      id: string;
      provider: string;
      channel: string;
      providerEventId: string;
      providerMessageId: string | null;
      eventType: string;
      status: string;
      payloadJson: Prisma.JsonValue | null;
      normalizedJson: Prisma.JsonValue | null;
      errorJson: Prisma.JsonValue | null;
      receivedAt: Date;
      processedAt: Date | null;
    }>;
  }) {
    const result = sanitizeJson(sideEffect.resultJson);
    const providerMessageId = isRecord(result) && typeof result.providerMessageId === 'string'
      ? result.providerMessageId
      : null;

    return {
      id: sideEffect.id,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      sideEffectType: sideEffect.sideEffectType,
      channel: sideEffect.channel,
      provider: sideEffect.provider,
      status: sideEffect.status,
      providerMessageId,
      attempts: sideEffect.attempts,
      maxAttempts: sideEffect.maxAttempts,
      nextAttemptAt: sideEffect.nextAttemptAt,
      processedAt: sideEffect.processedAt,
      cancelledAt: sideEffect.cancelledAt,
      cancelReason: sideEffect.cancelReason,
      createdAt: sideEffect.createdAt,
      updatedAt: sideEffect.updatedAt,
      locked: Boolean(sideEffect.lockedAt),
      idempotencyKey: '[REDACTED]',
      templateVersionId: sideEffect.templateVersionId,
      contact: sideEffect.contact
        ? {
            id: sideEffect.contact.id,
            displayName: sideEffect.contact.displayName,
            firstName: sideEffect.contact.firstName,
            lastName: sideEffect.contact.lastName,
            companyName: sideEffect.contact.companyName,
            primaryEmail: maskEmail(sideEffect.contact.primaryEmail),
            primaryPhone: maskPhone(sideEffect.contact.primaryPhone),
            status: sideEffect.contact.status
          }
        : null,
      contactChannel: sideEffect.contactChannel
        ? {
            id: sideEffect.contactChannel.id,
            channel: sideEffect.contactChannel.channel,
            label: sideEffect.contactChannel.label,
            address: sideEffect.contactChannel.channel === 'email'
              ? maskEmail(sideEffect.contactChannel.address)
              : maskPhone(sideEffect.contactChannel.address),
            normalizedAddress: sideEffect.contactChannel.channel === 'email'
              ? maskEmail(sideEffect.contactChannel.normalizedAddress)
              : maskPhone(sideEffect.contactChannel.normalizedAddress),
            status: sideEffect.contactChannel.status
          }
        : null,
      payload: summarizePayload(sideEffect.payloadJson),
      result,
      error: sanitizeError(sideEffect.errorJson),
      providerEvents: (sideEffect.providerEvents ?? []).map((providerEvent) => ({
        id: providerEvent.id,
        provider: providerEvent.provider,
        channel: providerEvent.channel,
        providerEventId: '[REDACTED]',
        providerMessageId: providerEvent.providerMessageId,
        eventType: providerEvent.eventType,
        status: providerEvent.status,
        payload: summarizePayload(providerEvent.payloadJson),
        normalized: summarizePayload(providerEvent.normalizedJson),
        error: sanitizeError(providerEvent.errorJson),
        receivedAt: providerEvent.receivedAt,
        processedAt: providerEvent.processedAt
      }))
    };
  }
}
