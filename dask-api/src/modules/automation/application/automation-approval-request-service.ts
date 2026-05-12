import type { AutomationApprovalRequest, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { maskEmail, maskPhone } from '@/core/security/redaction';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { CommunicationConversationService } from '@/modules/automation/communication/communication-conversation-service';
import { normalizeAutomationLimit } from '@/modules/automation/application/workflow-execution-types';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

export const automationApprovalRequestStatuses = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled'
] as const;
export type AutomationApprovalRequestStatus = (typeof automationApprovalRequestStatuses)[number];

export const automationApprovalRequestTypes = [
  'send_message',
  'move_card',
  'create_task',
  'apply_ai_recommendation'
] as const;
export type AutomationApprovalRequestType = (typeof automationApprovalRequestTypes)[number];

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeText(value: string | null | undefined, label: string): string {
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

function normalizeStatus(value: string): AutomationApprovalRequestStatus {
  if (automationApprovalRequestStatuses.includes(value as AutomationApprovalRequestStatus)) {
    return value as AutomationApprovalRequestStatus;
  }
  throw new AppError('Invalid automation approval status.', 422, { status: value });
}

function normalizeType(value: string): AutomationApprovalRequestType {
  if (automationApprovalRequestTypes.includes(value as AutomationApprovalRequestType)) {
    return value as AutomationApprovalRequestType;
  }
  throw new AppError('Invalid automation approval type.', 422, { type: value });
}

function publicApproval(approval: AutomationApprovalRequest): AutomationApprovalRequest {
  return {
    ...approval,
    payloadJson: sanitizeAutomationPayload(approval.payloadJson) as Prisma.JsonValue,
    decisionJson: sanitizeAutomationPayload(approval.decisionJson) as Prisma.JsonValue
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(source: unknown, keys: string[]): string | null {
  if (!isRecord(source)) {
    return null;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function approvalChannel(payload: unknown): string | null {
  const direct = readString(payload, ['channel']);
  if (direct) {
    return direct;
  }
  const metadata = isRecord(payload) ? payload.metadata : undefined;
  return readString(metadata, ['channel']);
}

function draftText(payload: unknown): string {
  const direct = readString(payload, ['text', 'draftText', 'body']);
  if (direct) {
    return direct;
  }
  const draft = isRecord(payload) ? payload.draft : undefined;
  return readString(draft, ['text', 'draftText', 'body']) ?? '';
}

function approvalPayload(approval: AutomationApprovalRequest, editedPayload?: unknown): Record<string, unknown> {
  const base = isRecord(approval.payloadJson) ? approval.payloadJson : {};
  const edited = isRecord(editedPayload) ? editedPayload : {};
  return {
    ...base,
    ...edited
  };
}

export class AutomationApprovalRequestService {
  private readonly eventService: AutomationRunEventService;
  private readonly conversationService: CommunicationConversationService;

  public constructor(
    private readonly prisma: PrismaClient,
    input?: {
      eventService?: AutomationRunEventService;
    }
  ) {
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
    this.conversationService = new CommunicationConversationService(prisma);
  }

  public async createApprovalRequest(input: {
    workspaceId: string;
    runId: string;
    stepRunId: string;
    type: string;
    title: string;
    description?: string | null;
    payload?: unknown;
    contactId?: string | null;
    workItemId?: string | null;
    requestedBy?: string | null;
    expiresAt?: Date | null;
  }): Promise<AutomationApprovalRequest> {
    const workspaceId = normalizeText(input.workspaceId, 'workspaceId');
    const runId = normalizeText(input.runId, 'runId');
    const stepRunId = normalizeText(input.stepRunId, 'stepRunId');
    const type = normalizeType(input.type);
    const title = normalizeText(input.title, 'title');
    const payload = sanitizeAutomationPayload(input.payload ?? {});

    const approval = await this.prisma.automationApprovalRequest.create({
      data: {
        workspaceId,
        runId,
        stepRunId,
        type,
        status: 'pending',
        title,
        description: normalizeOptionalText(input.description),
        payloadJson: toJsonValue(payload),
        contactId: normalizeOptionalText(input.contactId),
        workItemId: normalizeOptionalText(input.workItemId),
        requestedBy: normalizeOptionalText(input.requestedBy),
        expiresAt: input.expiresAt ?? null
      }
    });

    await this.eventService.createEvent({
      workspaceId,
      runId,
      stepRunId,
      eventType: 'approval.requested',
      message: 'Human approval was requested.',
      payload: {
        approvalRequestId: approval.id,
        type,
        status: approval.status,
        title,
        contactId: approval.contactId,
        workItemId: approval.workItemId,
        expiresAt: approval.expiresAt?.toISOString() ?? null
      }
    });

    await this.conversationService.syncApprovalMessage({
      workspaceId,
      approvalRequestId: approval.id
    }).catch(() => undefined);

    return publicApproval(approval);
  }

  public async listPending(input: {
    workspaceId: string;
    status?: string;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    return this.listApprovals({ ...input, status: input.status ?? 'pending' });
  }

  public async listApprovals(input: {
    workspaceId: string;
    status?: string;
    type?: string;
    channel?: string;
    workflowId?: string;
    contactId?: string;
    workItemId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    const status = input.status ? normalizeStatus(input.status) : undefined;
    const search = input.search?.trim();
    const approvals = await this.prisma.automationApprovalRequest.findMany({
      where: {
        workspaceId: input.workspaceId,
        status,
        type: input.type ? normalizeType(input.type) : undefined,
        contactId: input.contactId,
        workItemId: input.workItemId,
        run: {
          workflowId: input.workflowId
        },
        requestedAt: input.dateFrom || input.dateTo
          ? {
              ...(input.dateFrom ? { gte: input.dateFrom } : {}),
              ...(input.dateTo ? { lte: input.dateTo } : {})
            }
          : undefined,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { run: { workflow: { name: { contains: search, mode: 'insensitive' } } } }
              ]
            }
          : {})
      },
      include: {
        run: {
          select: {
            id: true,
            workflowId: true,
            workflow: { select: { id: true, name: true } },
            events: { orderBy: [{ createdAt: 'desc' }], take: 1 }
          }
        },
        contact: {
          select: {
            id: true,
            displayName: true,
            primaryEmail: true,
            primaryPhone: true
          }
        }
      },
      orderBy: [{ requestedAt: 'asc' }],
      take: normalizeAutomationLimit(input.limit, 100, 500)
    });

    return approvals
      .filter((approval) => !input.channel || approvalChannel(approval.payloadJson) === input.channel)
      .map((approval) => ({
        approvalId: approval.id,
        type: approval.type,
        status: approval.status,
        title: approval.title,
        channel: approvalChannel(approval.payloadJson),
        contactMasked: approval.contact?.primaryEmail
          ? maskEmail(approval.contact.primaryEmail)
          : maskPhone(approval.contact?.primaryPhone),
        contactName: approval.contact?.displayName ?? null,
        workflowId: approval.run?.workflowId ?? null,
        workflowName: approval.run?.workflow?.name ?? null,
        runId: approval.runId,
        stepRunId: approval.stepRunId,
        createdAt: approval.createdAt,
        requestedAt: approval.requestedAt,
        expiresAt: approval.expiresAt,
        lastEvent: approval.run?.events?.[0]
          ? {
              id: approval.run.events[0].id,
              eventType: approval.run.events[0].eventType,
              message: approval.run.events[0].message,
              createdAt: approval.run.events[0].createdAt
            }
          : null
      }));
  }

  public async getById(input: {
    workspaceId: string;
    approvalId: string;
  }): Promise<AutomationApprovalRequest> {
    const approval = await this.prisma.automationApprovalRequest.findFirst({
      where: {
        id: input.approvalId,
        workspaceId: input.workspaceId
      }
    });

    if (!approval) {
      throw new AppError('Automation approval request not found.', 404);
    }

    return publicApproval(approval);
  }

  public async getDetail(input: {
    workspaceId: string;
    approvalId: string;
  }): Promise<Record<string, unknown>> {
    const approval = await this.prisma.automationApprovalRequest.findFirst({
      where: {
        id: input.approvalId,
        workspaceId: input.workspaceId
      },
      include: {
        run: {
          include: {
            workflow: { select: { id: true, name: true, status: true } },
            workflowVersion: { select: { id: true, version: true, status: true } },
            events: { orderBy: [{ createdAt: 'asc' }] }
          }
        },
        stepRun: true,
        contact: {
          include: {
            channels: {
              orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
              take: 5
            }
          }
        },
        workItem: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            type: true,
            updatedAt: true
          }
        },
        sideEffects: {
          orderBy: [{ createdAt: 'desc' }],
          take: 5
        }
      }
    });

    if (!approval) {
      throw new AppError('Automation approval request not found.', 404);
    }

    const payload = sanitizeAutomationPayload(approval.payloadJson);
    const aiOutput = isRecord(payload)
      ? sanitizeAutomationPayload({
          classification: payload.classification,
          draft: payload.draft,
          contextSummary: payload.contextSummary,
          reason: payload.reason,
          risks: payload.risks
        })
      : {};

    return {
      approval: publicApproval(approval),
      run: {
        runId: approval.run.id,
        status: approval.run.status,
        triggerType: approval.run.triggerType,
        workflowId: approval.run.workflowId,
        workflowName: approval.run.workflow.name,
        workflowVersion: approval.run.workflowVersion.version,
        createdAt: approval.run.createdAt
      },
      stepRun: {
        id: approval.stepRun.id,
        nodeId: approval.stepRun.nodeId,
        nodeType: approval.stepRun.nodeType,
        status: approval.stepRun.status,
        output: sanitizeAutomationPayload(approval.stepRun.outputJson)
      },
      contact: approval.contact
        ? {
            id: approval.contact.id,
            displayName: approval.contact.displayName,
            primaryEmail: maskEmail(approval.contact.primaryEmail),
            primaryPhone: maskPhone(approval.contact.primaryPhone),
            status: approval.contact.status
          }
        : null,
      contactChannel: approval.contact?.channels[0]
        ? {
            id: approval.contact.channels[0].id,
            channel: approval.contact.channels[0].channel,
            address: approval.contact.channels[0].channel === 'email'
              ? maskEmail(approval.contact.channels[0].address)
              : maskPhone(approval.contact.channels[0].address),
            status: approval.contact.channels[0].status
          }
        : null,
      workItem: approval.workItem,
      aiOutput,
      draft: {
        channel: approvalChannel(approval.payloadJson),
        text: draftText(approval.payloadJson),
        subject: readString(approval.payloadJson, ['subject']),
        templateKey: readString(approval.payloadJson, ['templateKey'])
      },
      timeline: approval.run.events
        .filter((event) => event.stepRunId === approval.stepRunId || event.eventType.startsWith('approval.'))
        .map((event) => ({
          id: event.id,
          eventType: event.eventType,
          level: event.level,
          message: event.message,
          payload: sanitizeAutomationPayload(event.payloadJson),
          createdAt: event.createdAt
        })),
      decision: sanitizeAutomationPayload(approval.decisionJson),
      sideEffects: approval.sideEffects.map((sideEffect) => ({
        id: sideEffect.id,
        status: sideEffect.status,
        sideEffectType: sideEffect.sideEffectType,
        channel: sideEffect.channel,
        provider: sideEffect.provider,
        createdAt: sideEffect.createdAt
      }))
    };
  }

  public async approve(input: {
    workspaceId: string;
    approvalId: string;
    reviewedBy: string;
    decision?: unknown;
    editedPayload?: unknown;
    decisionReason?: string | null;
  }): Promise<AutomationApprovalRequest> {
    const approval = await this.review({
      ...input,
      status: 'approved',
      eventType: 'approval.approved',
      message: 'Human approval request was approved.',
      decision: {
        ...(isRecord(input.decision) ? input.decision : {}),
        ...(input.editedPayload !== undefined ? { editedPayload: sanitizeAutomationPayload(input.editedPayload) } : {}),
        ...(input.decisionReason ? { decisionReason: input.decisionReason } : {})
      }
    });

    if (approval.type === 'send_message') {
      await this.createApprovedMessageSideEffect({
        approval,
        editedPayload: input.editedPayload,
        approvedBy: input.reviewedBy
      });
    }

    await this.resumeApprovedRun(approval);
    return approval;
  }

  public async reject(input: {
    workspaceId: string;
    approvalId: string;
    reviewedBy: string;
    decision?: unknown;
    decisionReason?: string | null;
  }): Promise<AutomationApprovalRequest> {
    const approval = await this.review({
      ...input,
      status: 'rejected',
      eventType: 'approval.rejected',
      message: 'Human approval request was rejected.',
      decision: {
        ...(isRecord(input.decision) ? input.decision : {}),
        ...(input.decisionReason ? { decisionReason: input.decisionReason } : {})
      }
    });
    await this.rejectWaitingRun(approval);
    return approval;
  }

  public async expire(input: {
    workspaceId: string;
    approvalId: string;
    reason?: string | null;
  }): Promise<AutomationApprovalRequest> {
    return this.transitionPending({
      workspaceId: input.workspaceId,
      approvalId: input.approvalId,
      status: 'expired',
      eventType: 'approval.expired',
      message: 'Human approval request expired.',
      decision: { reason: input.reason ?? 'Approval request expired.' }
    });
  }

  public async cancel(input: {
    workspaceId: string;
    approvalId: string;
    reason?: string | null;
  }): Promise<AutomationApprovalRequest> {
    return this.transitionPending({
      workspaceId: input.workspaceId,
      approvalId: input.approvalId,
      status: 'cancelled',
      eventType: 'approval.cancelled',
      message: 'Human approval request was cancelled.',
      decision: { reason: input.reason ?? 'Approval request cancelled.' }
    });
  }

  public async cancelRunApprovals(input: {
    workspaceId: string;
    runId: string;
    reason?: string | null;
  }): Promise<{ count: number }> {
    const pending = await this.prisma.automationApprovalRequest.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        status: 'pending'
      }
    });

    if (pending.length === 0) {
      return { count: 0 };
    }

    const now = new Date();
    const decision = sanitizeAutomationPayload({
      reason: input.reason ?? 'Automation run was cancelled.'
    });
    const result = await this.prisma.automationApprovalRequest.updateMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        status: 'pending'
      },
      data: {
        status: 'cancelled',
        reviewedAt: now,
        decisionJson: toJsonValue(decision)
      }
    });

    for (const approval of pending) {
      await this.eventService.createEvent({
        workspaceId: approval.workspaceId,
        runId: approval.runId,
        stepRunId: approval.stepRunId,
        eventType: 'approval.cancelled',
        message: 'Human approval request was cancelled.',
        payload: {
          approvalRequestId: approval.id,
          reason: input.reason ?? 'Automation run was cancelled.'
        }
      });
    }

    return result;
  }

  public async assertApprovedForSensitiveAction(input: {
    workspaceId: string;
    approvalRequestId?: string | null;
    expectedType?: string;
  }): Promise<AutomationApprovalRequest> {
    const approvalRequestId = normalizeOptionalText(input.approvalRequestId);
    if (!approvalRequestId) {
      throw new AppError('Human approval is required for AI generated communication.', 422);
    }

    const approval = await this.getById({
      workspaceId: input.workspaceId,
      approvalId: approvalRequestId
    });

    if (approval.status !== 'approved') {
      throw new AppError('Human approval request is not approved.', 422, {
        approvalRequestId,
        status: approval.status
      });
    }

    if (input.expectedType && approval.type !== input.expectedType) {
      throw new AppError('Human approval request type does not match the action.', 422, {
        approvalRequestId,
        expectedType: input.expectedType,
        actualType: approval.type
      });
    }

    return approval;
  }

  private async review(input: {
    workspaceId: string;
    approvalId: string;
    reviewedBy: string;
    decision?: unknown;
    status: Extract<AutomationApprovalRequestStatus, 'approved' | 'rejected'>;
    eventType: 'approval.approved' | 'approval.rejected';
    message: string;
  }): Promise<AutomationApprovalRequest> {
    const reviewedBy = normalizeText(input.reviewedBy, 'reviewedBy');
    return this.transitionPending({
      workspaceId: input.workspaceId,
      approvalId: input.approvalId,
      status: input.status,
      reviewedBy,
      eventType: input.eventType,
      message: input.message,
      decision: input.decision ?? {}
    });
  }

  private async transitionPending(input: {
    workspaceId: string;
    approvalId: string;
    status: Exclude<AutomationApprovalRequestStatus, 'pending'>;
    reviewedBy?: string | null;
    decision?: unknown;
    eventType: 'approval.approved' | 'approval.rejected' | 'approval.expired' | 'approval.cancelled';
    message: string;
  }): Promise<AutomationApprovalRequest> {
    const current = await this.prisma.automationApprovalRequest.findFirst({
      where: {
        id: input.approvalId,
        workspaceId: input.workspaceId
      }
    });

    if (!current) {
      throw new AppError('Automation approval request not found.', 404);
    }

    if (current.status !== 'pending') {
      throw new AppError('Only pending automation approval requests can be reviewed.', 422, {
        approvalRequestId: current.id,
        status: current.status
      });
    }

    if (current.expiresAt && current.expiresAt.getTime() <= Date.now()) {
      const expired = await this.prisma.automationApprovalRequest.update({
        where: { id: current.id },
        data: {
          status: 'expired',
          reviewedAt: new Date(),
          decisionJson: toJsonValue(sanitizeAutomationPayload({ reason: 'Approval request expired.' }))
        }
      });
      await this.eventService.createEvent({
        workspaceId: expired.workspaceId,
        runId: expired.runId,
        stepRunId: expired.stepRunId,
        eventType: 'approval.expired',
        message: 'Human approval request expired.',
        payload: { approvalRequestId: expired.id }
      });
      throw new AppError('Automation approval request expired.', 422, {
        approvalRequestId: expired.id
      });
    }

    const approval = await this.prisma.automationApprovalRequest.update({
      where: { id: current.id },
      data: {
        status: input.status,
        reviewedBy: normalizeOptionalText(input.reviewedBy),
        reviewedAt: new Date(),
        decisionJson: toJsonValue(sanitizeAutomationPayload(input.decision ?? {}))
      }
    });

    await this.eventService.createEvent({
      workspaceId: approval.workspaceId,
      runId: approval.runId,
      stepRunId: approval.stepRunId,
      eventType: input.eventType,
      message: input.message,
      payload: {
        approvalRequestId: approval.id,
        type: approval.type,
        status: approval.status,
        reviewedBy: approval.reviewedBy
      }
    });

    await this.conversationService.syncApprovalMessage({
      workspaceId: approval.workspaceId,
      approvalRequestId: approval.id
    }).catch(() => undefined);

    return publicApproval(approval);
  }

  private async createApprovedMessageSideEffect(input: {
    approval: AutomationApprovalRequest;
    editedPayload?: unknown;
    approvedBy: string;
  }) {
    const payload = approvalPayload(input.approval, input.editedPayload);
    const channel = approvalChannel(payload) ?? 'whatsapp';
    const sideEffectType = channel === 'email' ? 'communication.email' : 'communication.whatsapp';
    const body = draftText(payload);
    const idempotencyKey = `approval:${input.approval.id}:send_message`;
    if (!this.prisma.automationSideEffect) {
      return null;
    }

    const existing = await this.prisma.automationSideEffect.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.approval.workspaceId,
          idempotencyKey
        }
      }
    });

    if (existing) {
      return existing;
    }

    const sideEffectPayload = sanitizeAutomationPayload({
        ...payload,
        ...(body ? { body, text: body } : {}),
        approvalRequestId: input.approval.id,
        aiGenerated: true,
        unsafeToAutoSend: true,
        source: 'human_approved_ai_draft',
        approvedBy: input.approvedBy,
        approvedAt: new Date().toISOString(),
        metadata: {
          ...(isRecord(payload.metadata) ? payload.metadata : {}),
          approvalRequestId: input.approval.id,
          aiGenerated: true,
          unsafeToAutoSend: true,
          source: 'human_approved_ai_draft',
          approvedBy: input.approvedBy
        }
      });

    const sideEffect = await this.prisma.automationSideEffect.create({
      data: {
        workspaceId: input.approval.workspaceId,
        runId: input.approval.runId,
        stepRunId: input.approval.stepRunId,
        sideEffectType,
        channel,
        provider: readString(payload, ['provider']) ?? 'mock',
        status: 'queued',
        idempotencyKey,
        payloadJson: toJsonValue(sideEffectPayload),
        contactId: input.approval.contactId,
        approvalRequestId: input.approval.id,
        maxAttempts: 3,
        nextAttemptAt: new Date()
      }
    });

    await this.eventService.createEvent({
      workspaceId: input.approval.workspaceId,
      runId: input.approval.runId,
      stepRunId: input.approval.stepRunId,
      eventType: 'communication.side_effect.created_after_approval',
      message: 'Approved AI draft was queued as a communication side effect.',
      payload: {
        approvalRequestId: input.approval.id,
        sideEffectId: sideEffect.id,
        sideEffectType,
        channel
      }
    });

    await this.conversationService.syncSideEffectMessage({
      workspaceId: input.approval.workspaceId,
      sideEffectId: sideEffect.id
    }).catch(() => undefined);

    return sideEffect;
  }

  private async resumeApprovedRun(approval: AutomationApprovalRequest): Promise<void> {
    if (!this.prisma.automationStepRun || !this.prisma.automationRun || !this.prisma.automationScheduledStep) {
      return;
    }
    const now = new Date();
    await this.prisma.automationStepRun.updateMany({
      where: {
        id: approval.stepRunId,
        workspaceId: approval.workspaceId,
        status: 'waiting'
      },
      data: {
        status: 'completed',
        finishedAt: now
      }
    });
    await this.prisma.automationRun.updateMany({
      where: {
        id: approval.runId,
        workspaceId: approval.workspaceId,
        status: 'waiting'
      },
      data: {
        status: 'completed',
        finishedAt: now
      }
    });
    await this.prisma.automationScheduledStep.updateMany({
      where: {
        workspaceId: approval.workspaceId,
        runId: approval.runId,
        stepRunId: approval.stepRunId,
        status: { in: ['scheduled', 'locked'] }
      },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: 'Human approval decided.'
      }
    });
    await this.eventService.createEvent({
      workspaceId: approval.workspaceId,
      runId: approval.runId,
      stepRunId: approval.stepRunId,
      eventType: 'run.resumed_after_approval',
      message: 'Automation run was safely completed after human approval.',
      payload: {
        approvalRequestId: approval.id,
        limitation: 'Automatic edge resume is deferred; approval step/run were completed safely.'
      }
    });
  }

  private async rejectWaitingRun(approval: AutomationApprovalRequest): Promise<void> {
    if (!this.prisma.automationStepRun || !this.prisma.automationRun || !this.prisma.automationScheduledStep) {
      return;
    }
    const now = new Date();
    await this.prisma.automationStepRun.updateMany({
      where: {
        id: approval.stepRunId,
        workspaceId: approval.workspaceId,
        status: 'waiting'
      },
      data: {
        status: 'skipped',
        finishedAt: now
      }
    });
    await this.prisma.automationRun.updateMany({
      where: {
        id: approval.runId,
        workspaceId: approval.workspaceId,
        status: 'waiting'
      },
      data: {
        status: 'completed',
        finishedAt: now
      }
    });
    await this.prisma.automationScheduledStep.updateMany({
      where: {
        workspaceId: approval.workspaceId,
        runId: approval.runId,
        stepRunId: approval.stepRunId,
        status: { in: ['scheduled', 'locked'] }
      },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: 'Human approval rejected.'
      }
    });
    await this.eventService.createEvent({
      workspaceId: approval.workspaceId,
      runId: approval.runId,
      stepRunId: approval.stepRunId,
      eventType: 'run.approval_rejected',
      message: 'Automation run approval path was rejected safely.',
      payload: {
        approvalRequestId: approval.id,
        limitation: 'Rejected edge routing is deferred; approval step was skipped and run completed safely.'
      }
    });
  }
}
