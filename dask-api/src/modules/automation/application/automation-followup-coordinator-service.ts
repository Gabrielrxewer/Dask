import type { PrismaClient } from '@prisma/client';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { maskCommunicationAddress } from '@/modules/automation/communication/communication-address';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export type FollowupCancellationSummary = {
  relatedRunIds: string[];
  cancelledScheduledSteps: number;
  cancelledSideEffects: number;
};

export class AutomationFollowupCoordinatorService {
  private readonly eventService: AutomationRunEventService;

  public constructor(
    private readonly prisma: PrismaClient,
    input?: {
      eventService?: AutomationRunEventService;
    }
  ) {
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
  }

  public async cancelPendingFollowupsDueToReply(input: {
    workspaceId: string;
    contactId?: string | null;
    contactChannelId?: string | null;
    sideEffectId?: string | null;
    runId?: string | null;
    from?: string | null;
    messagePreview?: string | null;
    occurredAt?: Date;
  }): Promise<FollowupCancellationSummary> {
    const relatedRunIds = await this.findRelatedRunIds(input);
    if (relatedRunIds.length === 0) {
      return {
        relatedRunIds: [],
        cancelledScheduledSteps: 0,
        cancelledSideEffects: 0
      };
    }

    const now = new Date();
    const reason = 'Client replied on WhatsApp.';
    const [scheduledResult, sideEffectResult] = await this.prisma.$transaction([
      this.prisma.automationScheduledStep.updateMany({
        where: {
          workspaceId: input.workspaceId,
          runId: { in: relatedRunIds },
          status: { in: ['scheduled', 'locked'] },
          purpose: 'follow_up'
        },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: reason
        }
      }),
      this.prisma.automationSideEffect.updateMany({
        where: {
          workspaceId: input.workspaceId,
          runId: { in: relatedRunIds },
          channel: 'whatsapp',
          status: { in: ['queued', 'processing'] },
          ...(input.contactId ? { contactId: input.contactId } : {}),
          ...(input.sideEffectId ? { id: { not: input.sideEffectId } } : {})
        },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: reason,
          lockedAt: null,
          lockedBy: null,
          processedAt: now
        }
      })
    ]);

    for (const runId of relatedRunIds) {
      await this.eventService.createEvent({
        workspaceId: input.workspaceId,
        runId,
        eventType: 'automation.followup.cancelled_due_to_reply',
        message: 'Pending WhatsApp follow-ups were cancelled because the client replied.',
        payload: {
          contactId: input.contactId,
          contactChannelId: input.contactChannelId,
          sideEffectId: input.sideEffectId,
          fromMasked: input.from ? maskCommunicationAddress('whatsapp', input.from) : undefined,
          messagePreview: input.messagePreview,
          occurredAt: input.occurredAt?.toISOString(),
          cancelledScheduledSteps: scheduledResult.count,
          cancelledSideEffects: sideEffectResult.count
        }
      });
    }

    return {
      relatedRunIds,
      cancelledScheduledSteps: scheduledResult.count,
      cancelledSideEffects: sideEffectResult.count
    };
  }

  private async findRelatedRunIds(input: {
    workspaceId: string;
    contactId?: string | null;
    contactChannelId?: string | null;
    sideEffectId?: string | null;
    runId?: string | null;
  }): Promise<string[]> {
    const explicitRunId = readString(input.runId);
    if (explicitRunId) {
      return [explicitRunId];
    }

    if (input.sideEffectId) {
      const sideEffect = await this.prisma.automationSideEffect.findFirst({
        where: {
          id: input.sideEffectId,
          workspaceId: input.workspaceId
        },
        select: { runId: true }
      });
      if (sideEffect) {
        return [sideEffect.runId];
      }
    }

    if (!input.contactId && !input.contactChannelId) {
      return [];
    }

    const sideEffects = await this.prisma.automationSideEffect.findMany({
      where: {
        workspaceId: input.workspaceId,
        channel: 'whatsapp',
        OR: [
          ...(input.contactId ? [{ contactId: input.contactId }] : []),
          ...(input.contactChannelId ? [{ contactChannelId: input.contactChannelId }] : [])
        ]
      },
      select: {
        runId: true,
        payloadJson: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const followupRunIds = sideEffects
      .filter((sideEffect) => {
        const payload = isRecord(sideEffect.payloadJson) ? sideEffect.payloadJson : {};
        const metadata = isRecord(payload.metadata) ? payload.metadata : {};
        return (
          readString(metadata.followupGroupId) !== null ||
          readString(payload.followupGroupId) !== null ||
          readString(payload.workItemId) !== null ||
          readString(metadata.workItemId) !== null ||
          readString(payload.category) === 'follow_up'
        );
      })
      .map((sideEffect) => sideEffect.runId);

    return Array.from(new Set(followupRunIds));
  }
}
