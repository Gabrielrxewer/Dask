import type { AutomationRunEvent, Prisma, PrismaClient } from '@prisma/client';
import { normalizeAutomationLimit } from '@/modules/automation/application/workflow-execution-types';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

export const automationRunEventLevels = ['debug', 'info', 'warn', 'error'] as const;
export type AutomationRunEventLevel = (typeof automationRunEventLevels)[number];

export const automationRunEventTypes = [
  'run.created',
  'run.started',
  'run.waiting',
  'run.completed',
  'run.failed',
  'run.cancelled',
  'step.created',
  'step.started',
  'step.waiting',
  'step.completed',
  'step.failed',
  'step.skipped',
  'step.cancelled',
  'scheduled_step.created',
  'scheduled_step.locked',
  'scheduled_step.executed',
  'scheduled_step.cancelled',
  'scheduled_step.failed',
  'retry.scheduled',
  'retry.exhausted',
  'side_effect.created',
  'side_effect.processing',
  'side_effect.sent',
  'side_effect.failed',
  'side_effect.cancelled',
  'side_effect.retry_scheduled',
  'side_effect.retry_exhausted',
  'side_effect.skipped',
  'template.version_published',
  'template.rendered',
  'communication.consent_checked',
  'communication.consent_blocked',
  'communication.suppression_checked',
  'communication.suppression_blocked',
  'communication.unsubscribe_registered',
  'communication.email.sent',
  'communication.email.delivered',
  'communication.email.delivery_delayed',
  'communication.email.bounced',
  'communication.email.complained',
  'communication.email.opened',
  'communication.email.clicked',
  'communication.email.unsubscribed',
  'communication.email.failed',
  'communication.whatsapp.opt_in_registered',
  'communication.whatsapp.opt_out_registered',
  'communication.whatsapp.consent_blocked',
  'communication.whatsapp.sent',
  'communication.whatsapp.delivered',
  'communication.whatsapp.read',
  'communication.whatsapp.failed',
  'communication.whatsapp.replied',
  'communication.whatsapp.message_received',
  'automation.followup.cancelled_due_to_reply',
  'provider_event.received',
  'provider_event.duplicate',
  'provider_event.ignored',
  'provider_event.failed',
  'communication.contact.created',
  'communication.contact.updated',
  'communication.channel.created',
  'communication.channel.updated',
  'communication.recipient.resolved',
  'communication.recipient.blocked',
  'communication.channel.suppressed',
  'communication.channel.opted_out',
  'ai.node_started',
  'ai.node_completed',
  'ai.node_failed',
  'ai.context_summarized',
  'ai.reply_classified',
  'ai.intent_extracted',
  'ai.message_draft_created',
  'ai.next_action_recommended',
  'ai.template_variables_filled',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'approval.expired',
  'approval.cancelled',
  'run.resumed_after_approval',
  'run.approval_rejected',
  'communication.side_effect.created_after_approval',
  'communication.blocked_missing_human_approval'
] as const;
export type AutomationRunEventType = (typeof automationRunEventTypes)[number];

type AutomationRunEventDelegate = {
  create: (args: Prisma.AutomationRunEventCreateArgs) => Promise<AutomationRunEvent>;
  findMany: (args: Prisma.AutomationRunEventFindManyArgs) => Promise<AutomationRunEvent[]>;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeLevel(level: AutomationRunEventLevel | undefined): AutomationRunEventLevel {
  return level && automationRunEventLevels.includes(level) ? level : 'info';
}

function eventDelegate(prisma: PrismaClient): AutomationRunEventDelegate | null {
  return (prisma as unknown as { automationRunEvent?: AutomationRunEventDelegate }).automationRunEvent ?? null;
}

export class AutomationRunEventService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createEvent(input: {
    workspaceId: string;
    runId: string;
    stepRunId?: string | null;
    eventType: AutomationRunEventType;
    level?: AutomationRunEventLevel;
    message: string;
    payload?: unknown;
  }): Promise<AutomationRunEvent | null> {
    const delegate = eventDelegate(this.prisma);
    if (!delegate) {
      return null;
    }

    return delegate.create({
      data: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        stepRunId: input.stepRunId ?? undefined,
        eventType: input.eventType,
        level: normalizeLevel(input.level),
        message: input.message,
        payloadJson: input.payload !== undefined
          ? toJsonValue(sanitizeAutomationPayload(input.payload))
          : undefined
      }
    });
  }

  public async listEventsForRun(input: {
    workspaceId: string;
    runId: string;
    limit?: number;
  }): Promise<AutomationRunEvent[]> {
    const delegate = eventDelegate(this.prisma);
    if (!delegate) {
      return [];
    }

    return delegate.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId
      },
      orderBy: [{ createdAt: 'asc' }],
      take: normalizeAutomationLimit(input.limit, 100, 1000)
    });
  }
}
