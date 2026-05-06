import { AppError } from '@/core/errors/app-error';
import type { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

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

function normalizeChannel(value: unknown): 'email' | 'whatsapp' {
  const channel = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (channel === 'email' || channel === 'whatsapp') {
    return channel;
  }

  throw new AppError('communication_send node channel must be "email" or "whatsapp".', 422, {
    channel: value
  });
}

export class CommunicationSendNodeExecutor implements AutomationNodeExecutor {
  public readonly type = 'communication_send';

  public constructor(private readonly sideEffectService: AutomationSideEffectService) {}

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    const config = isRecord(input.node.config) ? input.node.config : {};
    const templateContext = {
      ...input.context,
      input: input.input,
      previousOutput: input.input.previousOutput
    };
    const channel = normalizeChannel(config.channel);
    const provider = renderLiteral(config.provider ?? 'mock', templateContext) ?? 'mock';
    const to = renderLiteral(config.to, templateContext);
    const from = renderLiteral(config.from, templateContext);
    const replyTo = renderLiteral(config.replyTo, templateContext);
    const templateKey = renderLiteral(config.templateKey, templateContext);
    const templateVersionId = renderLiteral(config.templateVersionId, templateContext);
    const category = renderLiteral(config.category, templateContext);
    const subject = renderLiteral(config.subject, templateContext);
    const text = renderLiteral(config.text, templateContext);
    const html = renderLiteral(config.html, templateContext);
    const body = renderLiteral(config.body, templateContext) ?? text ?? html;
    const approvalRequestId = renderLiteral(config.approvalRequestId, templateContext)
      ?? renderLiteral(config.humanApprovalRequestId, templateContext);
    const recipient = isRecord(config.recipient) ? renderValue(config.recipient, templateContext) : undefined;
    const variables = isRecord(config.variables) ? renderValue(config.variables, templateContext) : undefined;
    const metadata = isRecord(config.metadata) ? config.metadata : undefined;
    const aiGenerated = config.aiGenerated === true || metadata?.aiGenerated === true;

    if (!to && !recipient) {
      throw new AppError('communication_send node requires a recipient.', 422, {
        nodeId: input.node.id
      });
    }
    if (!body && !templateKey && !templateVersionId) {
      throw new AppError('communication_send node requires a body.', 422, {
        nodeId: input.node.id
      });
    }

    const sideEffectType = channel === 'email'
      ? 'communication.email'
      : 'communication.whatsapp';
    const idempotencyKey = typeof config.idempotencyKey === 'string' && config.idempotencyKey.trim().length > 0
      ? renderLiteral(config.idempotencyKey, templateContext) ?? ''
      : `${input.run.id}:${input.stepRun.id}:${input.node.id}:${sideEffectType}`;

    const sideEffect = await this.sideEffectService.createSideEffect({
      workspaceId: input.run.workspaceId,
      runId: input.run.id,
      stepRunId: input.stepRun.id,
      sideEffectType,
      channel,
      provider,
      idempotencyKey,
      payload: {
        ...(to ? { to } : {}),
        ...(recipient ? { recipient } : {}),
        ...(variables ? { variables } : {}),
        ...(from ? { from } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(templateKey ? { templateKey } : {}),
        ...(templateVersionId ? { templateVersionId } : {}),
        ...(category ? { category } : {}),
        ...(subject ? { subject } : {}),
        ...(body ? { body } : {}),
        ...(text ? { text } : {}),
        ...(html ? { html } : {}),
        metadata: {
          ...(metadata ?? {}),
          nodeId: input.node.id,
          nodeType: input.node.type,
          ...(aiGenerated ? { aiGenerated: true, unsafeToAutoSend: true } : {}),
          ...(approvalRequestId ? { approvalRequestId } : {})
        }
      },
      templateVersionId,
      approvalRequestId
    });

    return {
      status: 'completed',
      output: {
        sideEffectId: sideEffect.id,
        sideEffectStatus: sideEffect.status,
        sideEffectType: sideEffect.sideEffectType,
        channel: sideEffect.channel,
        provider: sideEffect.provider,
        idempotencyKey: sideEffect.idempotencyKey
      }
    };
  }
}
