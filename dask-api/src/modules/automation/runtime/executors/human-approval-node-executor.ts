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

function renderLiteral(value: unknown, context: Record<string, unknown>): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const resolved = readPath(context, path);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
}

function renderValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return renderLiteral(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => renderValue(entry, context));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderValue(entry, context)])
    );
  }

  return value;
}

function readRenderedPath(config: Record<string, unknown>, context: Record<string, unknown>, key: string): string | undefined {
  const path = typeof config[key] === 'string' ? config[key].trim() : '';
  if (!path) {
    return undefined;
  }

  const value = readPath(context, path);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
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
    const templateContext = {
      ...input.context,
      input: input.input,
      previousOutput
    };
    const payloadFromNode = typeof config.payloadFromNode === 'string' ? config.payloadFromNode.trim() : '';
    const payload = payloadFromNode
      ? readPath({ previousOutput }, payloadFromNode) ?? previousOutput
      : config.payload
        ? renderValue(config.payload, templateContext)
        : previousOutput;
    const expiresInDays = typeof config.expiresInDays === 'number'
      ? Math.min(Math.max(Math.trunc(config.expiresInDays), 1), 30)
      : 7;
    const expiresAt = daysFromNow(expiresInDays, input.now);
    const requestedBy = renderLiteral(config.requestedBy, templateContext) ??
      readRenderedPath(config, templateContext, 'requestedByPath') ??
      'automation-runtime';
    const workItemId = renderLiteral(config.workItemId, templateContext) ??
      readRenderedPath(config, templateContext, 'workItemIdPath');
    const approval = await this.approvalRequestService.createApprovalRequest({
      workspaceId: input.run.workspaceId,
      runId: input.run.id,
      stepRunId: input.stepRun.id,
      type: text(renderLiteral(config.type, templateContext), 'send_message'),
      title: text(renderLiteral(config.title, templateContext), 'Aprovar acao de automacao'),
      description: renderLiteral(config.description, templateContext) ?? null,
      payload: sanitizeAutomationPayload(payload),
      contactId: renderLiteral(config.contactId, templateContext) ?? readRenderedPath(config, templateContext, 'contactIdPath'),
      workItemId,
      requestedBy,
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
