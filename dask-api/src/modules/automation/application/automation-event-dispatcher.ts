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

export class AutomationEventDispatcher {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly runner: RunnerLike
  ) {}

  public async dispatch(event: DomainEvent): Promise<void> {
    const payload = isRecord(event.payload) ? event.payload : {};
    const workspaceId = readString(payload, 'workspaceId');
    if (!workspaceId) {
      return;
    }

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
        const triggerRefId = `${event.id}:${matchedTrigger.id}`;
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
      return event.name === DomainEventNames.ProposalCreated;
    }

    if (triggerType === 'proposal_status_changed') {
      return new Set<string>([DomainEventNames.ProposalSent, DomainEventNames.ProposalApproved, DomainEventNames.ProposalRejected]).has(event.name) &&
        hasFilterValue(config.status, payload.status);
    }

    if (triggerType === 'contract_created') {
      return event.name === DomainEventNames.ContractCreated;
    }

    if (triggerType === 'contract_status_changed') {
      return new Set<string>([DomainEventNames.ContractSent, DomainEventNames.ContractAccepted, DomainEventNames.ContractRejected]).has(event.name) &&
        hasFilterValue(config.status, payload.status);
    }

    if (triggerType === 'billing_payment_confirmed') {
      return event.name === DomainEventNames.BillingPaymentConfirmed &&
        hasFilterValue(config.status, payload.status);
    }

    if (triggerType === 'billing_requested') {
      return event.name === DomainEventNames.BillingRequested &&
        hasFilterValue(config.status, payload.status);
    }

    if (triggerType === 'billing_payment_failed') {
      return event.name === DomainEventNames.BillingPaymentFailed &&
        hasFilterValue(config.status, payload.status);
    }

    if (triggerType === 'billing_overdue') {
      return event.name === DomainEventNames.BillingOverdue &&
        hasFilterValue(config.status, payload.status);
    }

    if (triggerType === 'commercial_work_item_created') {
      return event.name === DomainEventNames.CommercialWorkItemCreated;
    }

    return false;
  }

  private filtersMatch(config: Record<string, unknown>, payload: Record<string, unknown>): boolean {
    return hasFilterValue(config.itemTypeSlug ?? config.itemTypeSlugs, payload.itemTypeSlug) &&
      hasFilterValue(config.column ?? config.columnSlug ?? config.toColumnKey, payload.toColumnKey) &&
      hasFilterValue(config.status ?? config.stateSlug, payload.status) &&
      hasFilterValue(config.customerId, payload.customerId);
  }
}
