import type { AutomationWorkflowVersion, PrismaClient } from '@prisma/client';
import { DomainEventNames } from '@/core/events/event-names';
import type { DomainEvent } from '@/core/events/domain-event';
import type { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';
import type {
  AutomationWorkflowGraph,
  AutomationWorkflowEdge,
  AutomationWorkflowNode
} from '@/modules/automation/application/workflow-execution-types';

type RunnerLike = Pick<AutomationWorkflowRunnerService, 'startRun'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }

  return typeof value === 'string' && value.trim().length > 0 ? [value.trim()] : [];
}

function normalizeNodes(value: unknown): AutomationWorkflowNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry, index) => ({
      id: readString(entry, 'id') ?? `node-${index + 1}`,
      type: readString(entry, 'type') ?? 'noop',
      label: readString(entry, 'label') ?? undefined,
      config: isRecord(entry.config) ? entry.config : {},
      position: isRecord(entry.position) && typeof entry.position.x === 'number' && typeof entry.position.y === 'number'
        ? { x: entry.position.x, y: entry.position.y }
        : undefined
    }));
}

function normalizeEdges(value: unknown): AutomationWorkflowEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry, index) => ({
      id: readString(entry, 'id') ?? `edge-${index + 1}`,
      source: readString(entry, 'source') ?? '',
      target: readString(entry, 'target') ?? '',
      sourceHandle: readString(entry, 'sourceHandle'),
      targetHandle: readString(entry, 'targetHandle'),
      condition: isRecord(entry.condition) ? entry.condition : undefined
    }))
    .filter((edge) => edge.source.length > 0 && edge.target.length > 0);
}

function buildGraph(version: AutomationWorkflowVersion): AutomationWorkflowGraph {
  const definition = isRecord(version.definitionJson) ? version.definitionJson : {};
  const definitionGraph = isRecord(definition.graph) ? definition.graph : {};

  return {
    version: 1,
    nodes: normalizeNodes(
      Array.isArray(version.graphNodesJson)
        ? version.graphNodesJson
        : definitionGraph.nodes
    ),
    edges: normalizeEdges(
      Array.isArray(version.graphEdgesJson)
        ? version.graphEdgesJson
        : definitionGraph.edges
    ),
    metadata: isRecord(definitionGraph.metadata) ? definitionGraph.metadata : {}
  };
}

function hasFilterValue(filter: unknown, actual: unknown): boolean {
  const filters = readStringList(filter);
  if (filters.length === 0) {
    return true;
  }

  return typeof actual === 'string' && filters.includes(actual);
}

function normalizeWorkItemEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const itemId = readString(payload, 'itemId');
  const workItemId = readString(payload, 'workItemId');
  const linkedWorkItemId = readString(payload, 'linkedEntityType') === 'work_item'
    ? readString(payload, 'linkedEntityId')
    : null;
  const resolvedWorkItemId = itemId ?? workItemId ?? linkedWorkItemId;

  return {
    ...payload,
    itemId: resolvedWorkItemId ?? payload.itemId,
    workItemId: resolvedWorkItemId ?? payload.workItemId
  };
}

function isCommercialWorkItemPayload(payload: Record<string, unknown>): boolean {
  return readString(payload, 'itemTypeSlug') === 'commercial' ||
    readString(payload, 'itemType') === 'commercial' ||
    readString(payload, 'nativeDomain') === 'commercial' ||
    readString(payload, 'domain') === 'commercial';
}

function readEventIdempotencyKey(event: DomainEvent, payload: Record<string, unknown>): string {
  return readString(payload, 'idempotencyKey') ?? event.id;
}

export class AutomationEventDispatcher {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly runner: RunnerLike
  ) {}

  public async dispatch(event: DomainEvent): Promise<void> {
    const rawPayload = isRecord(event.payload) ? event.payload : {};
    let payload = normalizeWorkItemEventPayload(rawPayload);
    const workspaceId = readString(payload, 'workspaceId');
    if (!workspaceId) {
      return;
    }
    payload = await this.enrichWorkItemPayload(workspaceId, payload);

    const workflows = await this.prisma.automationWorkflow.findMany({
      where: {
        workspaceId,
        status: 'active',
        currentVersion: {
          is: {
            status: 'published'
          }
        }
      },
      include: {
        currentVersion: true
      },
      orderBy: { updatedAt: 'asc' }
    });

    for (const workflow of workflows) {
      if (!workflow.currentVersion) {
        continue;
      }

      const graph = buildGraph(workflow.currentVersion);
      const matchedTriggers = graph.nodes.filter((node) => node.type === 'trigger' && this.triggerMatches(node.config, event, payload));
      if (matchedTriggers.length === 0) {
        continue;
      }

      for (const matchedTrigger of matchedTriggers) {
        const triggerRefId = `${readEventIdempotencyKey(event, payload)}:${matchedTrigger.id}`;
        const existingRun = await this.prisma.automationRun.findFirst({
          where: {
            workspaceId,
            workflowId: workflow.id,
            workflowVersionId: workflow.currentVersion.id,
            triggerType: event.name,
            triggerRefId
          },
          select: { id: true }
        });

        if (existingRun) {
          continue;
        }

        await this.runner.startRun({
          workspaceId,
          workflowId: workflow.id,
          triggerType: event.name,
          triggerRefId,
          startNodeId: matchedTrigger.id,
          context: {
            ...payload,
            event: {
              id: event.id,
              name: event.name,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              occurredAt: event.occurredAt.toISOString(),
              payload
            },
            matchedTrigger: {
              nodeId: matchedTrigger.id,
              config: matchedTrigger.config
            },
            actor: {
              userId: readString(payload, 'requestedBy')
            }
          }
        });
      }
    }
  }

  private triggerMatches(config: Record<string, unknown>, event: DomainEvent, payload: Record<string, unknown>): boolean {
    const explicitEvents = [
      ...readStringList(config.eventName),
      ...readStringList(config.eventNames),
      ...readStringList(config.domainEvent),
      ...readStringList(config.domainEvents)
    ];

    if (explicitEvents.length > 0) {
      return explicitEvents.includes(event.name) && this.filtersMatch(config, payload);
    }

    const triggerType = readString(config, 'triggerType') ?? readString(config, 'type');
    if (!triggerType || triggerType === 'manual') {
      return false;
    }

    if (triggerType === 'work_item_moved_to_column') {
      return event.name === DomainEventNames.ItemMoved &&
        hasFilterValue(config.column ?? config.columnSlug ?? config.toColumnKey, payload.toColumnKey) &&
        hasFilterValue(config.itemTypeSlug ?? config.itemTypeSlugs, payload.itemTypeSlug);
    }

    if (triggerType === 'work_item_created') {
      return event.name === DomainEventNames.ItemCreated &&
        hasFilterValue(config.itemTypeSlug ?? config.itemTypeSlugs, payload.itemTypeSlug);
    }

    if (triggerType === 'work_item_state_changed') {
      return event.name === DomainEventNames.ItemStateChanged &&
        hasFilterValue(config.state ?? config.stateSlug ?? config.toStateSlug, payload.status) &&
        hasFilterValue(config.itemTypeSlug ?? config.itemTypeSlugs, payload.itemTypeSlug);
    }

    if (triggerType === 'work_item_updated') {
      return event.name === DomainEventNames.ItemUpdated &&
        hasFilterValue(config.itemTypeSlug ?? config.itemTypeSlugs, payload.itemTypeSlug);
    }

    if (triggerType === 'work_item_field_updated') {
      return event.name === DomainEventNames.ItemFieldUpdated &&
        hasFilterValue(config.itemTypeSlug ?? config.itemTypeSlugs, payload.itemTypeSlug);
    }

    if (triggerType === 'proposal_created') {
      return event.name === DomainEventNames.ProposalCreated &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'proposal_status_changed') {
      return new Set<string>([DomainEventNames.ProposalSent, DomainEventNames.ProposalApproved, DomainEventNames.ProposalRejected]).has(event.name) &&
        hasFilterValue(config.status, payload.status) &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'contract_created') {
      return event.name === DomainEventNames.ContractCreated &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'contract_status_changed') {
      return new Set<string>([DomainEventNames.ContractSent, DomainEventNames.ContractAccepted, DomainEventNames.ContractRejected]).has(event.name) &&
        hasFilterValue(config.status, payload.status) &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'billing_payment_confirmed') {
      return event.name === DomainEventNames.BillingPaymentConfirmed &&
        hasFilterValue(config.status, payload.status) &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'billing_requested') {
      return event.name === DomainEventNames.BillingRequested &&
        hasFilterValue(config.status, payload.status) &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'billing_payment_failed') {
      return event.name === DomainEventNames.BillingPaymentFailed &&
        hasFilterValue(config.status, payload.status) &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'billing_overdue') {
      return event.name === DomainEventNames.BillingOverdue &&
        hasFilterValue(config.status, payload.status) &&
        this.filtersMatch(config, payload);
    }

    if (triggerType === 'commercial_work_item_created') {
      return event.name === DomainEventNames.CommercialWorkItemCreated &&
        isCommercialWorkItemPayload(payload);
    }

    return false;
  }

  private filtersMatch(config: Record<string, unknown>, payload: Record<string, unknown>): boolean {
    return hasFilterValue(config.itemTypeSlug ?? config.itemTypeSlugs, payload.itemTypeSlug) &&
      hasFilterValue(config.column ?? config.columnSlug ?? config.toColumnKey, payload.toColumnKey) &&
      hasFilterValue(config.status ?? config.stateSlug, payload.status) &&
      hasFilterValue(config.customerId, payload.customerId);
  }

  private async enrichWorkItemPayload(workspaceId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const itemId = readString(payload, 'itemId') ?? readString(payload, 'workItemId');
    if (!itemId) {
      return payload;
    }

    if (
      readString(payload, 'itemTypeSlug') &&
      readString(payload, 'status') &&
      readString(payload, 'toColumnKey')
    ) {
      return payload;
    }

    const itemDelegate = (this.prisma as PrismaClient & {
      item?: {
        findFirst(input: unknown): Promise<{
          id: string;
          type: string;
          typeId: string | null;
          stateId: string | null;
          status: string;
          boardColumnId: string | null;
          typeDefinition: { slug: string } | null;
          workflowState: { slug: string } | null;
          boardColumn: { slug: string } | null;
        } | null>;
      };
    }).item;
    if (!itemDelegate?.findFirst) {
      return payload;
    }

    const item = await itemDelegate.findFirst({
      where: {
        id: itemId,
        workspaceId
      },
      select: {
        id: true,
        type: true,
        typeId: true,
        stateId: true,
        status: true,
        boardColumnId: true,
        typeDefinition: {
          select: {
            slug: true
          }
        },
        workflowState: {
          select: {
            slug: true
          }
        },
        boardColumn: {
          select: {
            slug: true
          }
        }
      }
    });

    if (!item) {
      return payload;
    }

    return {
      ...payload,
      itemId: item.id,
      workItemId: item.id,
      itemTypeId: readString(payload, 'itemTypeId') ?? item.typeId ?? undefined,
      itemTypeSlug: readString(payload, 'itemTypeSlug') ?? item.typeDefinition?.slug ?? item.type,
      status: readString(payload, 'status') ?? item.workflowState?.slug ?? item.status,
      stateId: readString(payload, 'stateId') ?? item.stateId ?? undefined,
      toColumnId: readString(payload, 'toColumnId') ?? item.boardColumnId ?? undefined,
      toColumnKey: readString(payload, 'toColumnKey') ?? item.boardColumn?.slug ?? undefined
    };
  }
}
