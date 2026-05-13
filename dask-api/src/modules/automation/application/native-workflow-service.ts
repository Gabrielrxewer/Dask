import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  automationNativeWorkflowCatalog,
  type AutomationNativeWorkflowDefinition
} from '@/modules/automation/application/automation-capabilities';
import {
  buildCanonicalAutomationWorkflowGraph,
  validateAutomationWorkflowGraph
} from '@/modules/automation/application/automation-workflow-graph-validation';
import type {
  AutomationGraphEdge,
  AutomationGraphNode,
  AutomationWorkflowDefinition,
  AutomationWorkflowGraph
} from '@/modules/automation/application/workflow-execution-types';

const SYSTEM_ACTOR = 'system';
const commercialNativeWorkflowKeys = automationNativeWorkflowCatalog
  .filter((workflow) => workflow.nativeDomain === 'commercial')
  .map((workflow) => workflow.nativeKey);

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNativeSchemaVersion(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }

  const native = isRecord(value.native) ? value.native : null;
  const schemaVersion = native?.schemaVersion;
  return typeof schemaVersion === 'number' && Number.isInteger(schemaVersion) ? schemaVersion : null;
}

function normalizeGraphFromVersion(version: {
  definitionJson: unknown;
  graphNodesJson: unknown;
  graphEdgesJson: unknown;
}): AutomationWorkflowGraph | null {
  try {
    return buildCanonicalAutomationWorkflowGraph({
      definition: isRecord(version.definitionJson)
        ? version.definitionJson as AutomationWorkflowDefinition
        : undefined,
      graphNodes: Array.isArray(version.graphNodesJson)
        ? version.graphNodesJson as AutomationGraphNode[]
        : undefined,
      graphEdges: Array.isArray(version.graphEdgesJson)
        ? version.graphEdgesJson as AutomationGraphEdge[]
        : undefined
    });
  } catch {
    return null;
  }
}

function mergeLocalConfigOverrides(
  nativeGraph: AutomationWorkflowGraph,
  localGraph: AutomationWorkflowGraph | null
): AutomationWorkflowGraph {
  if (!localGraph) {
    return nativeGraph;
  }

  const localNodes = new Map(localGraph.nodes.map((node) => [node.id, node]));
  return {
    ...nativeGraph,
    nodes: nativeGraph.nodes.map((node) => {
      const localNode = localNodes.get(node.id);
      if (!localNode || localNode.type !== node.type) {
        return node;
      }

      return {
        ...node,
        label: localNode.label ?? node.label,
        config: {
          ...node.config,
          ...localNode.config
        }
      };
    })
  };
}

function buildNativeDefinition(nativeWorkflow: AutomationNativeWorkflowDefinition, localGraph?: AutomationWorkflowGraph | null): {
  definition: AutomationWorkflowDefinition;
  graph: AutomationWorkflowGraph;
} {
  const graph = buildCanonicalAutomationWorkflowGraph({
    graph: nativeWorkflow.graph
  });
  const mergedGraph = mergeLocalConfigOverrides(graph, localGraph ?? null);
  validateAutomationWorkflowGraph(mergedGraph);

  return {
    graph: mergedGraph,
    definition: {
      graph: mergedGraph,
      native: {
        nativeKey: nativeWorkflow.nativeKey,
        legacyRecipeId: nativeWorkflow.legacyRecipeId,
        nativeDomain: nativeWorkflow.nativeDomain,
        schemaVersion: nativeWorkflow.schemaVersion,
        systemManaged: nativeWorkflow.isSystemManaged
      }
    }
  };
}

function selectNativeWorkflows(nativeKeys?: string[]): AutomationNativeWorkflowDefinition[] {
  if (!nativeKeys || nativeKeys.length === 0) {
    return automationNativeWorkflowCatalog;
  }

  const catalog = new Map(automationNativeWorkflowCatalog.map((workflow) => [workflow.nativeKey, workflow]));
  const selected = nativeKeys.map((nativeKey) => catalog.get(nativeKey));
  const missing = nativeKeys.filter((nativeKey, index) => !selected[index]);

  if (missing.length > 0) {
    throw new AppError(`Unknown native automation workflow: ${missing.join(', ')}`, 422);
  }

  return selected as AutomationNativeWorkflowDefinition[];
}

function hasValueChanged(current: unknown, next: unknown): boolean {
  return current !== next;
}

export class AutomationNativeWorkflowService {
  public constructor(private readonly prisma: PrismaClient) {}

  public listNativeWorkflowCatalog() {
    return automationNativeWorkflowCatalog;
  }

  public async installNativeWorkflows(input: {
    workspaceId: string;
    nativeKeys?: string[];
    activate?: boolean;
    installedById?: string | null;
    now?: Date;
  }) {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      throw new AppError('workspaceId is required to install native automation workflows.', 422);
    }

    const nativeWorkflows = selectNativeWorkflows(input.nativeKeys);
    const now = input.now ?? new Date();
    const installedById = input.installedById ?? null;
    const shouldActivate = input.activate ?? false;

    const items = await this.prisma.$transaction(async (db) => {
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true }
      });

      if (!workspace) {
        throw new AppError('Workspace not found for native automation workflow install.', 404);
      }

      const installed = [];
      for (const nativeWorkflow of nativeWorkflows) {
        installed.push(await this.upsertNativeWorkflow(db, {
          workspaceId,
          nativeWorkflow,
          activate: shouldActivate,
          installedById,
          now
        }));
      }

      return installed;
    });

    return { items };
  }

  public async installNativeCommercialWorkflows(input: {
    workspaceId: string;
    activate?: boolean;
    installedById?: string | null;
    now?: Date;
  }) {
    return this.installNativeWorkflows({
      ...input,
      nativeKeys: commercialNativeWorkflowKeys,
      activate: input.activate ?? false
    });
  }

  private async upsertNativeWorkflow(
    db: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      nativeWorkflow: AutomationNativeWorkflowDefinition;
      activate: boolean;
      installedById: string | null;
      now: Date;
    }
  ) {
    const existing = await db.automationWorkflow.findFirst({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { nativeKey: input.nativeWorkflow.nativeKey },
          ...(input.nativeWorkflow.legacyRecipeId ? [{ nativeKey: input.nativeWorkflow.legacyRecipeId }] : [])
        ]
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        currentVersionId: true,
        origin: true,
        nativeKey: true,
        nativeDomain: true,
        isSystemManaged: true,
        isProtected: true,
        editableMode: true,
        installedAt: true,
        installedById: true,
        schemaVersion: true,
        currentVersion: {
          select: {
            definitionJson: true,
            graphNodesJson: true,
            graphEdgesJson: true
          }
        }
      }
    });
    const localGraph = existing?.currentVersion
      ? normalizeGraphFromVersion(existing.currentVersion)
      : null;
    const { definition, graph } = buildNativeDefinition(input.nativeWorkflow, localGraph);

    const workflow = existing
      ? await this.updateExistingNativeWorkflow(db, {
          existing,
          nativeWorkflow: input.nativeWorkflow,
          activate: input.activate,
          installedById: input.installedById,
          now: input.now
        })
      : await db.automationWorkflow.create({
          data: {
            workspaceId: input.workspaceId,
            name: input.nativeWorkflow.name,
            description: input.nativeWorkflow.description,
            status: input.activate ? 'active' : 'paused',
            createdById: input.installedById,
            origin: 'native',
            nativeKey: input.nativeWorkflow.nativeKey,
            nativeDomain: input.nativeWorkflow.nativeDomain,
            isSystemManaged: input.nativeWorkflow.isSystemManaged,
            isProtected: input.nativeWorkflow.isProtected,
            editableMode: input.nativeWorkflow.editableMode,
            installedAt: input.now,
            installedById: input.installedById ?? SYSTEM_ACTOR,
            schemaVersion: input.nativeWorkflow.schemaVersion
          },
          select: {
            id: true,
            status: true,
            currentVersionId: true,
            currentVersion: {
              select: {
                definitionJson: true,
                graphNodesJson: true,
                graphEdgesJson: true
              }
            }
          }
        });

    const version = await this.upsertNativeWorkflowVersion(db, {
      workspaceId: input.workspaceId,
      workflowId: workflow.id,
      nativeWorkflow: input.nativeWorkflow,
      definition,
      graph,
      publishedById: input.installedById,
      now: input.now
    });

    const finalStatus = input.activate ? 'active' : workflow.status;
    if (workflow.currentVersionId !== version.id || workflow.status !== finalStatus) {
      return db.automationWorkflow.update({
        where: { id: workflow.id },
        data: {
          currentVersionId: version.id,
          status: finalStatus
        },
        include: {
          currentVersion: true
        }
      });
    }

    const result = await db.automationWorkflow.findUnique({
      where: { id: workflow.id },
      include: {
        currentVersion: true
      }
    });
    if (!result) {
      throw new AppError('Native automation workflow not found after install.', 404);
    }

    return result;
  }

  private async updateExistingNativeWorkflow(
    db: Prisma.TransactionClient,
    input: {
      existing: {
        id: string;
        name: string;
        description: string | null;
        status: string;
        currentVersionId: string | null;
        origin: string;
        nativeKey: string | null;
        nativeDomain: string | null;
        isSystemManaged: boolean;
        isProtected: boolean;
        editableMode: string;
        installedAt: Date | null;
        installedById: string | null;
        schemaVersion: number;
        currentVersion: {
          definitionJson: unknown;
          graphNodesJson: unknown;
          graphEdgesJson: unknown;
        } | null;
      };
      nativeWorkflow: AutomationNativeWorkflowDefinition;
      activate: boolean;
      installedById: string | null;
      now: Date;
    }
  ) {
    const data: Prisma.AutomationWorkflowUpdateInput = {};
    if (hasValueChanged(input.existing.name, input.nativeWorkflow.name)) data.name = input.nativeWorkflow.name;
    if (hasValueChanged(input.existing.description, input.nativeWorkflow.description)) data.description = input.nativeWorkflow.description;
    if (hasValueChanged(input.existing.origin, 'native')) data.origin = 'native';
    if (hasValueChanged(input.existing.nativeKey, input.nativeWorkflow.nativeKey)) data.nativeKey = input.nativeWorkflow.nativeKey;
    if (hasValueChanged(input.existing.nativeDomain, input.nativeWorkflow.nativeDomain)) data.nativeDomain = input.nativeWorkflow.nativeDomain;
    if (hasValueChanged(input.existing.isSystemManaged, input.nativeWorkflow.isSystemManaged)) data.isSystemManaged = input.nativeWorkflow.isSystemManaged;
    if (hasValueChanged(input.existing.isProtected, input.nativeWorkflow.isProtected)) data.isProtected = input.nativeWorkflow.isProtected;
    if (hasValueChanged(input.existing.editableMode, input.nativeWorkflow.editableMode)) data.editableMode = input.nativeWorkflow.editableMode;
    if (!input.existing.installedAt) data.installedAt = input.now;
    if (!input.existing.installedById) data.installedById = input.installedById ?? SYSTEM_ACTOR;
    if (hasValueChanged(input.existing.schemaVersion, input.nativeWorkflow.schemaVersion)) data.schemaVersion = input.nativeWorkflow.schemaVersion;
    if (input.activate && input.existing.status !== 'active') data.status = 'active';

    if (Object.keys(data).length === 0) {
      return input.existing;
    }

    return db.automationWorkflow.update({
      where: { id: input.existing.id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        currentVersionId: true,
        origin: true,
        nativeKey: true,
        nativeDomain: true,
        isSystemManaged: true,
        isProtected: true,
        editableMode: true,
        installedAt: true,
        installedById: true,
        schemaVersion: true,
        currentVersion: {
          select: {
            definitionJson: true,
            graphNodesJson: true,
            graphEdgesJson: true
          }
        }
      }
    });
  }

  private async upsertNativeWorkflowVersion(
    db: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      workflowId: string;
      nativeWorkflow: AutomationNativeWorkflowDefinition;
      definition: AutomationWorkflowDefinition;
      graph: AutomationWorkflowGraph;
      publishedById: string | null;
      now: Date;
    }
  ) {
    const versions = await db.automationWorkflowVersion.findMany({
      where: {
        workflowId: input.workflowId,
        workspaceId: input.workspaceId
      },
      orderBy: [{ version: 'desc' }],
      select: {
        id: true,
        version: true,
        status: true,
        definitionJson: true,
        publishedAt: true,
        publishedById: true
      }
    });
    const currentNativeVersion = versions.find(
      (version) => readNativeSchemaVersion(version.definitionJson) === input.nativeWorkflow.schemaVersion
    );

    const data = {
      status: 'published',
      definitionJson: toJsonValue(input.definition),
      graphNodesJson: toJsonValue(input.graph.nodes as AutomationGraphNode[]),
      graphEdgesJson: toJsonValue(input.graph.edges as AutomationGraphEdge[]),
      publishedAt: currentNativeVersion?.publishedAt ?? input.now,
      publishedById: currentNativeVersion?.publishedById ?? input.publishedById
    };

    if (currentNativeVersion) {
      return currentNativeVersion;
    }

    const aggregate = await db.automationWorkflowVersion.aggregate({
      where: {
        workflowId: input.workflowId
      },
      _max: { version: true }
    });

    return db.automationWorkflowVersion.create({
      data: {
        workspaceId: input.workspaceId,
        workflowId: input.workflowId,
        version: (aggregate._max.version ?? 0) + 1,
        ...data
      }
    });
  }
}
