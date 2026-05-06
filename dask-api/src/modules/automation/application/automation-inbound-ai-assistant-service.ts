import type { PrismaClient } from '@prisma/client';
import type { AutomationAIService } from '@/modules/automation/application/automation-ai-service';
import { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

export class AutomationInboundAIAssistantService {
  private readonly eventService: AutomationRunEventService;
  private readonly approvalRequestService: AutomationApprovalRequestService;

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly aiService: AutomationAIService,
    input?: {
      eventService?: AutomationRunEventService;
      approvalRequestService?: AutomationApprovalRequestService;
    }
  ) {
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
    this.approvalRequestService = input?.approvalRequestService ?? new AutomationApprovalRequestService(prisma, {
      eventService: this.eventService
    });
  }

  public async prepareInboundReplyReview(input: {
    workspaceId: string;
    runId: string;
    stepRunId: string;
    messageText: string;
    channel: 'whatsapp' | 'email';
    contactId?: string | null;
    workItemId?: string | null;
  }): Promise<{
    classification: Record<string, unknown>;
    draft: Record<string, unknown> | null;
    approvalRequestId: string | null;
  }> {
    const classification = await this.aiService.classifyReply(input);
    const intent = typeof classification.intent === 'string' ? classification.intent : 'unknown';

    if (intent === 'unsubscribe') {
      await this.eventService.createEvent({
        workspaceId: input.workspaceId,
        runId: input.runId,
        stepRunId: input.stepRunId,
        eventType: 'ai.reply_classified',
        message: 'Inbound reply was classified as unsubscribe; no commercial draft was created.',
        payload: { classification }
      });
      return { classification, draft: null, approvalRequestId: null };
    }

    const summary = await this.aiService.summarizeContext({
      workspaceId: input.workspaceId,
      workItemId: input.workItemId,
      contactId: input.contactId,
      include: ['workItem', 'lastInteractions']
    });
    const draft = await this.aiService.generateMessageDraft({
      workspaceId: input.workspaceId,
      channel: input.channel,
      contactId: input.contactId,
      workItemId: input.workItemId,
      goal: 'respond_to_inbound_reply',
      contextSummary: typeof summary.summary === 'string' ? summary.summary : undefined
    });
    const approval = await this.approvalRequestService.createApprovalRequest({
      workspaceId: input.workspaceId,
      runId: input.runId,
      stepRunId: input.stepRunId,
      type: 'send_message',
      title: 'Aprovar resposta gerada por IA',
      description: `Resposta inbound classificada como ${intent}.`,
      contactId: input.contactId,
      workItemId: input.workItemId,
      requestedBy: 'automation-inbound-ai-assistant',
      payload: sanitizeAutomationPayload({
        classification,
        draft,
        channel: input.channel,
        aiGenerated: true,
        unsafeToAutoSend: true
      })
    });

    return {
      classification,
      draft,
      approvalRequestId: approval.id
    };
  }
}
