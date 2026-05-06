import type { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (!isRecord(current)) {
        return undefined;
      }
      return current[segment];
    }, source);
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function daysFromNow(days: number, now: Date): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export class HumanApprovalNodeExecutor implements AutomationNodeExecutor {
  public readonly type = 'human_approval';

  public constructor(private readonly approvalRequestService: AutomationApprovalRequestService) {}

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    const config = isRecord(input.node.config) ? input.node.config : {};
    const previousOutput = isRecord(input.input.previousOutput) ? input.input.previousOutput : {};
    const payloadFromNode = typeof config.payloadFromNode === 'string' ? config.payloadFromNode.trim() : '';
    const payload = payloadFromNode
      ? readPath({ previousOutput }, payloadFromNode) ?? previousOutput
      : config.payload ?? previousOutput;
    const expiresInDays = typeof config.expiresInDays === 'number'
      ? Math.min(Math.max(Math.trunc(config.expiresInDays), 1), 30)
      : 7;
    const expiresAt = daysFromNow(expiresInDays, input.now);
    const approval = await this.approvalRequestService.createApprovalRequest({
      workspaceId: input.run.workspaceId,
      runId: input.run.id,
      stepRunId: input.stepRun.id,
      type: text(config.type, 'send_message'),
      title: text(config.title, 'Aprovar acao de automacao'),
      description: typeof config.description === 'string' ? config.description : null,
      payload: sanitizeAutomationPayload(payload),
      contactId: typeof config.contactId === 'string' ? config.contactId : undefined,
      workItemId: typeof config.workItemId === 'string' ? config.workItemId : undefined,
      requestedBy: typeof config.requestedBy === 'string' ? config.requestedBy : 'automation-runtime',
      expiresAt
    });

    return {
      status: 'waiting',
      resumeAt: expiresAt,
      reason: 'waiting_for_human_approval',
      output: {
        approvalRequestId: approval.id,
        approvalStatus: approval.status,
        approvalType: approval.type,
        requiresHumanApproval: true,
        expiresAt: expiresAt.toISOString()
      }
    };
  }
}
