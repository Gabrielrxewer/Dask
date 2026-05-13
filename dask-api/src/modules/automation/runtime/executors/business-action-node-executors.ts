import type { PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import type { AutomationBusinessActionService } from '@/modules/automation/application/automation-business-action-service';
import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

type BusinessNodeType =
  | 'move_work_item'
  | 'update_work_item_fields'
  | 'replicate_work_item_type_fields'
  | 'transform_work_item_type'
  | 'create_proposal'
  | 'create_contract'
  | 'send_document'
  | 'update_document_status'
  | 'ensure_customer_from_work_item'
  | 'create_billing_order'
  | 'create_followup_task'
  | 'register_card_activity';

type DocumentKind = 'wiki' | 'proposal' | 'contract';
type DocumentStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'accepted' | 'signed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function renderString(value: unknown, context: Record<string, unknown>): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  const rendered = value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const resolved = readPath(context, path);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  }).trim();

  return rendered.length > 0 ? rendered : undefined;
}

function renderValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return renderString(value, context);
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

function readRenderedString(
  config: Record<string, unknown>,
  context: Record<string, unknown>,
  key: string,
  fallbackPath?: string
): string | undefined {
  const direct = renderString(config[key], context);
  if (direct) {
    return direct;
  }

  const path = cleanText(config[`${key}Path`]) ?? fallbackPath;
  if (!path) {
    return undefined;
  }

  return renderString(readPath(context, path), context);
}

function readStringArray(value: unknown, context: Record<string, unknown>): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => renderString(entry, context))
    .filter((entry): entry is string => Boolean(entry));
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readDateFromConfig(config: Record<string, unknown>, now: Date): Date | null {
  const dueAt = cleanText(config.dueAt);
  if (dueAt) {
    const parsed = new Date(dueAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const dueInDays = readNumber(config.dueInDays);
  if (dueInDays !== undefined) {
    return new Date(now.getTime() + dueInDays * 24 * 60 * 60 * 1000);
  }

  return null;
}

function normalizeDocumentKind(value: unknown): DocumentKind {
  if (value === 'proposal' || value === 'contract' || value === 'wiki') {
    return value;
  }

  throw new AppError('Document action requires kind "proposal", "contract", or "wiki".', 422, { kind: value });
}

function normalizeDocumentStatus(value: unknown, fallback: DocumentStatus = 'draft'): DocumentStatus {
  if (
    value === 'draft' ||
    value === 'sent' ||
    value === 'viewed' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'accepted' ||
    value === 'signed'
  ) {
    return value;
  }

  return fallback;
}

function normalizeAmountUnit(value: unknown): 'major' | 'minor' {
  return value === 'minor' ? 'minor' : 'major';
}

export class BusinessActionNodeExecutor implements AutomationNodeExecutor {
  public constructor(
    public readonly type: BusinessNodeType,
    private readonly prisma: PrismaClient,
    private readonly businessActions: AutomationBusinessActionService
  ) {}

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    const config = isRecord(input.node.config) ? input.node.config : {};
    const context = this.buildContext(input);
    const itemId = readRenderedString(config, context, 'itemId', 'event.payload.itemId')
      ?? readRenderedString(config, context, 'workItemId', 'event.payload.workItemId')
      ?? readRenderedString(config, context, 'workItemId', 'event.payload.linkedEntityId');
    const userId = await this.resolveActorUserId(input, config, context);

    switch (this.type) {
      case 'move_work_item':
        return this.completed(await this.businessActions.moveWorkItem({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          columnId: readRenderedString(config, context, 'columnId'),
          columnSlug: readRenderedString(config, context, 'columnSlug') ?? readRenderedString(config, context, 'column'),
          stateId: readRenderedString(config, context, 'stateId'),
          stateSlug: readRenderedString(config, context, 'stateSlug') ?? readRenderedString(config, context, 'status'),
          position: readNumber(config.position)
        }));

      case 'update_work_item_fields':
        return this.completed(await this.businessActions.updateWorkItemFields({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          title: renderString(config.title, context),
          description: renderString(config.description, context),
          typeSlug: readRenderedString(config, context, 'typeSlug'),
          assigneeId: readRenderedString(config, context, 'assigneeId'),
          dueDate: readDateFromConfig(config, input.now),
          customFieldValues: isRecord(config.customFieldValues)
            ? renderValue(config.customFieldValues, context) as Record<string, unknown>
            : isRecord(config.fields)
              ? renderValue(config.fields, context) as Record<string, unknown>
              : undefined,
          metadata: isRecord(config.metadata)
            ? renderValue(config.metadata, context) as Record<string, unknown>
            : undefined
        }));

      case 'replicate_work_item_type_fields':
        return this.completed(await this.businessActions.replicateWorkItemTypeFields({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          transformationId: readRenderedString(config, context, 'transformationId'),
          toTypeId: readRenderedString(config, context, 'toTypeId'),
          toTypeSlug: readRenderedString(config, context, 'toTypeSlug'),
          defaultValuesForNewFields: isRecord(config.defaultValuesForNewFields)
            ? renderValue(config.defaultValuesForNewFields, context) as Record<string, unknown>
            : undefined
        }));

      case 'transform_work_item_type':
        return this.completed(await this.businessActions.transformWorkItemType({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          transformationId: readRenderedString(config, context, 'transformationId'),
          toTypeId: readRenderedString(config, context, 'toTypeId'),
          toTypeSlug: readRenderedString(config, context, 'toTypeSlug'),
          stateId: readRenderedString(config, context, 'stateId'),
          stateSlug: readRenderedString(config, context, 'stateSlug'),
          customFieldValues: isRecord(config.customFieldValues)
            ? renderValue(config.customFieldValues, context) as Record<string, unknown>
            : undefined,
          defaultValuesForNewFields: isRecord(config.defaultValuesForNewFields)
            ? renderValue(config.defaultValuesForNewFields, context) as Record<string, unknown>
            : undefined
        }));

      case 'create_proposal':
        return this.completed(await this.businessActions.createProposal({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          title: renderString(config.title, context),
          content: renderString(config.content, context),
          status: normalizeDocumentStatus(config.status, 'draft'),
          templateKey: readRenderedString(config, context, 'templateKey'),
          binding: readRenderedString(config, context, 'binding') ?? readRenderedString(config, context, 'templateKey'),
          targetFieldSlug: readRenderedString(config, context, 'targetFieldSlug'),
          skipIfExists: config.skipIfExists !== false
        }));

      case 'create_contract':
        return this.completed(await this.businessActions.createContract({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          proposalId: readRenderedString(config, context, 'proposalId'),
          proposalFieldSlug: readRenderedString(config, context, 'proposalFieldSlug'),
          title: renderString(config.title, context),
          content: renderString(config.content, context),
          status: normalizeDocumentStatus(config.status, 'draft'),
          templateKey: readRenderedString(config, context, 'templateKey'),
          binding: readRenderedString(config, context, 'binding') ?? readRenderedString(config, context, 'templateKey'),
          targetFieldSlug: readRenderedString(config, context, 'targetFieldSlug'),
          skipIfExists: config.skipIfExists !== false
        }));

      case 'send_document':
        return this.completed(await this.businessActions.sendDocument({
          workspaceId: input.run.workspaceId,
          userId,
          itemId,
          documentId: readRenderedString(config, context, 'documentId'),
          documentFieldSlug: readRenderedString(config, context, 'documentFieldSlug'),
          kind: config.kind ? normalizeDocumentKind(config.kind) : null,
          email: readRenderedString(config, context, 'email'),
          emails: readStringArray(config.emails, context),
          resend: config.resend === true
        }));

      case 'update_document_status':
        return this.completed(await this.businessActions.updateDocumentStatus({
          workspaceId: input.run.workspaceId,
          userId,
          itemId,
          documentId: readRenderedString(config, context, 'documentId'),
          documentFieldSlug: readRenderedString(config, context, 'documentFieldSlug'),
          kind: config.kind ? normalizeDocumentKind(config.kind) : null,
          status: normalizeDocumentStatus(config.status, 'draft')
        }));

      case 'ensure_customer_from_work_item':
        return this.completed(await this.businessActions.ensureCustomerFromWorkItem({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          status: config.status === 'prospect' || config.status === 'active' || config.status === 'inactive' || config.status === 'archived'
            ? config.status
            : 'active',
          targetFieldSlug: readRenderedString(config, context, 'targetFieldSlug')
        }));

      case 'create_billing_order':
        return this.completed(await this.businessActions.createBillingOrder({
          workspaceId: input.run.workspaceId,
          userId,
          itemId: this.requireItemId(itemId),
          targetFieldSlug: readRenderedString(config, context, 'targetFieldSlug'),
          catalogItemId: readRenderedString(config, context, 'catalogItemId'),
          catalogItemFieldSlug: readRenderedString(config, context, 'catalogItemFieldSlug'),
          amountCents: readNumber(config.amountCents) ?? null,
          amountFieldSlug: readRenderedString(config, context, 'amountFieldSlug'),
          amountFieldUnit: normalizeAmountUnit(config.amountFieldUnit),
          description: renderString(config.description, context),
          customerIdFieldSlug: readRenderedString(config, context, 'customerIdFieldSlug'),
          sendEmail: config.sendEmail !== false,
          skipIfExists: config.skipIfExists !== false
        }));

      case 'create_followup_task':
        return this.completed(await this.businessActions.createFollowupTask({
          workspaceId: input.run.workspaceId,
          userId,
          sourceItemId: this.requireItemId(itemId),
          title: renderString(config.title, context),
          description: renderString(config.description, context),
          stateSlug: readRenderedString(config, context, 'stateSlug'),
          columnSlug: readRenderedString(config, context, 'columnSlug'),
          dueDate: readDateFromConfig(config, input.now),
          assigneeId: readRenderedString(config, context, 'assigneeId')
        }));

      case 'register_card_activity':
        return this.completed(await this.businessActions.registerCardActivity({
          workspaceId: input.run.workspaceId,
          itemId: this.requireItemId(itemId),
          eventName: readRenderedString(config, context, 'eventName') ?? 'automation.activity',
          payload: isRecord(config.payload)
            ? {
                ...renderValue(config.payload, context) as Record<string, unknown>,
                message: readRenderedString(config, context, 'message') ?? undefined,
                severity: readRenderedString(config, context, 'severity') ?? undefined
              }
            : {
                workflowId: input.run.workflowId,
                runId: input.run.id,
                nodeId: input.node.id,
                message: readRenderedString(config, context, 'message') ?? undefined,
                severity: readRenderedString(config, context, 'severity') ?? undefined
              }
        }));

      default:
        return {
          status: 'failed',
          error: {
            message: `Unsupported business action node type "${this.type}".`
          }
        };
    }
  }

  private completed(output: Record<string, unknown>): AutomationNodeExecutionResult {
    return {
      status: 'completed',
      output
    };
  }

  private requireItemId(itemId: string | undefined): string {
    if (!itemId) {
      throw new AppError(`${this.type} requires itemId.`, 422);
    }

    return itemId;
  }

  private buildContext(input: AutomationNodeExecutionInput): Record<string, unknown> {
    return {
      ...input.context,
      run: {
        id: input.run.id,
        workflowId: input.run.workflowId,
        workflowVersionId: input.run.workflowVersionId,
        triggerType: input.run.triggerType,
        triggerRefId: input.run.triggerRefId
      },
      input: input.input,
      previousOutput: input.input.previousOutput
    };
  }

  private async resolveActorUserId(
    input: AutomationNodeExecutionInput,
    config: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<string> {
    const actorFromConfig = readRenderedString(config, context, 'userId')
      ?? readRenderedString(config, context, 'actorUserId');
    const actorFromContext =
      cleanText(readPath(context, 'requestedBy')) ??
      cleanText(readPath(context, 'event.payload.requestedBy')) ??
      cleanText(readPath(context, 'event.payload.userId'));

    const actor = actorFromConfig ?? actorFromContext;
    if (actor) {
      return actor;
    }

    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: {
        id: input.run.workflowId,
        workspaceId: input.run.workspaceId
      },
      select: {
        createdById: true
      }
    });

    if (workflow?.createdById) {
      return workflow.createdById;
    }

    throw new AppError(`${this.type} requires an actor user id.`, 422, {
      nodeId: input.node.id,
      workflowId: input.run.workflowId
    });
  }
}

export const businessActionNodeTypes: BusinessNodeType[] = [
  'move_work_item',
  'update_work_item_fields',
  'replicate_work_item_type_fields',
  'transform_work_item_type',
  'create_proposal',
  'create_contract',
  'send_document',
  'update_document_status',
  'ensure_customer_from_work_item',
  'create_billing_order',
  'create_followup_task',
  'register_card_activity'
];
