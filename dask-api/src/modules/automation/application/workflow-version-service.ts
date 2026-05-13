import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  buildCanonicalAutomationWorkflowGraph,
  validateAutomationWorkflowGraph
} from '@/modules/automation/application/automation-workflow-graph-validation';
import {
  isAutomationWorkflowVersionStatus,
  normalizeAutomationLimit,
  type AutomationGraphEdge,
  type AutomationGraphNode,
  type AutomationWorkflowDefinition,
  type AutomationWorkflowGraph,
  type AutomationWorkflowVersionStatus
} from '@/modules/automation/application/workflow-execution-types';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDefinition(value: AutomationWorkflowDefinition | undefined): AutomationWorkflowDefinition {
  return isRecord(value) ? value : {};
}

function buildDefinition(
  definition: AutomationWorkflowDefinition | undefined,
  graph: AutomationWorkflowGraph
): AutomationWorkflowDefinition {
  return {
    ...normalizeDefinition(definition),
    graph
  };
}

function isSystemWorkflow(workflow: {
  origin?: string | null;
  isSystemManaged?: boolean | null;
}): boolean {
  return workflow.origin === 'native' || workflow.isSystemManaged === true;
}

function assertVersionMutationAllowed(
  workflow: {
    origin?: string | null;
    isSystemManaged?: boolean | null;
    editableMode?: string | null;
  },
  action: 'create' | 'clone' | 'update' | 'publish'
): void {
  if (!isSystemWorkflow(workflow) || workflow.editableMode === 'full') {
    return;
  }

  if (workflow.editableMode === 'readonly') {
    throw new AppError('This native automation workflow is read-only.', 422);
  }

  if (workflow.editableMode === 'config_only' && action === 'create') {
    throw new AppError('Native automation workflows can only be configured from a cloned draft.', 422);
  }
}

function graphShapeSignature(graph: AutomationWorkflowGraph): string {
  return JSON.stringify({
    nodes: graph.nodes.map((node) => ({ id: node.id, type: node.type })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null
    }))
  });
}

function assertConfigOnlyGraphShape(currentGraph: AutomationWorkflowGraph, nextGraph: AutomationWorkflowGraph): void {
  if (graphShapeSignature(currentGraph) !== graphShapeSignature(nextGraph)) {
    throw new AppError('This native automation workflow only allows configuration changes.', 422);
  }
}

export class AutomationWorkflowVersionService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createDraftVersion(input: {
    workspaceId: string;
    workflowId: string;
    definition?: AutomationWorkflowDefinition;
    graph?: AutomationWorkflowGraph;
    graphNodes?: AutomationGraphNode[];
    graphEdges?: AutomationGraphEdge[];
  }) {
    return this.prisma.$transaction(async (db) => {
      const workflow = await db.automationWorkflow.findFirst({
        where: {
          id: input.workflowId,
          workspaceId: input.workspaceId
        },
        select: {
          id: true,
          origin: true,
          isSystemManaged: true,
          editableMode: true
        }
      });

      if (!workflow) {
        throw new AppError('Automation workflow not found.', 404);
      }

      assertVersionMutationAllowed(workflow, 'create');

      const aggregate = await db.automationWorkflowVersion.aggregate({
        where: {
          workflowId: input.workflowId
        },
        _max: { version: true }
      });

      const graph = buildCanonicalAutomationWorkflowGraph(input);
      validateAutomationWorkflowGraph(graph);
      const definition = buildDefinition(input.definition, graph);

      return db.automationWorkflowVersion.create({
        data: {
          workspaceId: input.workspaceId,
          workflowId: input.workflowId,
          version: (aggregate._max.version ?? 0) + 1,
          status: 'draft',
          definitionJson: toJsonValue(definition),
          graphNodesJson: toJsonValue(graph.nodes),
          graphEdgesJson: toJsonValue(graph.edges)
        }
      });
    });
  }

  public async updateDraftVersion(input: {
    workspaceId: string;
    workflowId: string;
    versionId: string;
    definition?: AutomationWorkflowDefinition;
    graph?: AutomationWorkflowGraph;
    graphNodes?: AutomationGraphNode[];
    graphEdges?: AutomationGraphEdge[];
  }) {
    return this.prisma.$transaction(async (db) => {
      const version = await db.automationWorkflowVersion.findFirst({
        where: {
          id: input.versionId,
          workflowId: input.workflowId,
          workspaceId: input.workspaceId
        },
        select: {
          id: true,
          status: true,
          definitionJson: true,
          graphNodesJson: true,
          graphEdgesJson: true
        }
      });

      if (!version) {
        throw new AppError('Automation workflow version not found.', 404);
      }

      if (version.status !== 'draft') {
        throw new AppError('Published or archived workflow versions are immutable.', 422);
      }

      const workflow = await db.automationWorkflow.findFirst({
        where: {
          id: input.workflowId,
          workspaceId: input.workspaceId
        },
        select: {
          id: true,
          origin: true,
          isSystemManaged: true,
          editableMode: true
        }
      });

      if (!workflow) {
        throw new AppError('Automation workflow not found.', 404);
      }

      assertVersionMutationAllowed(workflow, 'update');

      const currentDefinition = normalizeDefinition(version.definitionJson as AutomationWorkflowDefinition);
      const currentGraph = buildCanonicalAutomationWorkflowGraph({
        definition: currentDefinition,
        graphNodes: version.graphNodesJson as AutomationGraphNode[],
        graphEdges: version.graphEdgesJson as AutomationGraphEdge[]
      });
      const graph = buildCanonicalAutomationWorkflowGraph({
        definition: input.definition ?? currentDefinition,
        graph: input.graph,
        graphNodes: input.graphNodes ?? (version.graphNodesJson as AutomationGraphNode[]),
        graphEdges: input.graphEdges ?? (version.graphEdgesJson as AutomationGraphEdge[])
      });
      validateAutomationWorkflowGraph(graph);
      if (isSystemWorkflow(workflow) && workflow.editableMode === 'config_only') {
        assertConfigOnlyGraphShape(currentGraph, graph);
      }
      const definition = buildDefinition(input.definition ?? currentDefinition, graph);

      return db.automationWorkflowVersion.update({
        where: { id: version.id },
        data: {
          definitionJson: toJsonValue(definition),
          graphNodesJson: toJsonValue(graph.nodes),
          graphEdgesJson: toJsonValue(graph.edges)
        }
      });
    });
  }

  public async cloneVersion(input: {
    workspaceId: string;
    workflowId: string;
    versionId: string;
  }) {
    return this.prisma.$transaction(async (db) => {
      const source = await db.automationWorkflowVersion.findFirst({
        where: {
          id: input.versionId,
          workflowId: input.workflowId,
          workspaceId: input.workspaceId
        }
      });

      if (!source) {
        throw new AppError('Automation workflow version not found.', 404);
      }

      const workflow = await db.automationWorkflow.findFirst({
        where: {
          id: input.workflowId,
          workspaceId: input.workspaceId
        },
        select: {
          id: true,
          origin: true,
          isSystemManaged: true,
          editableMode: true
        }
      });

      if (!workflow) {
        throw new AppError('Automation workflow not found.', 404);
      }

      assertVersionMutationAllowed(workflow, 'clone');

      const graph = buildCanonicalAutomationWorkflowGraph({
        definition: source.definitionJson as AutomationWorkflowDefinition,
        graphNodes: source.graphNodesJson as AutomationGraphNode[],
        graphEdges: source.graphEdgesJson as AutomationGraphEdge[]
      });
      validateAutomationWorkflowGraph(graph);
      const definition = buildDefinition(source.definitionJson as AutomationWorkflowDefinition, graph);

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
          status: 'draft',
          definitionJson: toJsonValue(definition),
          graphNodesJson: toJsonValue(graph.nodes),
          graphEdgesJson: toJsonValue(graph.edges)
        }
      });
    });
  }

  public async publishVersion(input: {
    workspaceId: string;
    workflowId: string;
    versionId: string;
    publishedById?: string | null;
    activateWorkflow?: boolean;
  }) {
    return this.prisma.$transaction(async (db) => {
      const version = await db.automationWorkflowVersion.findFirst({
        where: {
          id: input.versionId,
          workflowId: input.workflowId,
          workspaceId: input.workspaceId
        }
      });

      if (!version) {
        throw new AppError('Automation workflow version not found.', 404);
      }

      if (version.status === 'archived') {
        throw new AppError('Archived workflow versions cannot be published.', 422);
      }

      const workflow = await db.automationWorkflow.findFirst({
        where: {
          id: input.workflowId,
          workspaceId: input.workspaceId
        },
        select: {
          id: true,
          origin: true,
          isSystemManaged: true,
          editableMode: true
        }
      });

      if (!workflow) {
        throw new AppError('Automation workflow not found.', 404);
      }

      assertVersionMutationAllowed(workflow, 'publish');

      const graph = buildCanonicalAutomationWorkflowGraph({
        definition: version.definitionJson as AutomationWorkflowDefinition,
        graphNodes: version.graphNodesJson as AutomationGraphNode[],
        graphEdges: version.graphEdgesJson as AutomationGraphEdge[]
      });
      validateAutomationWorkflowGraph(graph);

      const publishedAt = version.publishedAt ?? new Date();
      const published = version.status === 'published'
        ? version
        : await db.automationWorkflowVersion.update({
            where: { id: version.id },
            data: {
              status: 'published',
              publishedAt,
              publishedById: input.publishedById ?? null
            }
          });

      await db.automationWorkflow.update({
        where: { id: input.workflowId },
        data: {
          currentVersionId: published.id,
          status: input.activateWorkflow ? 'active' : undefined
        }
      });

      return published;
    });
  }

  public async archiveVersion(input: { workspaceId: string; workflowId: string; versionId: string }) {
    return this.prisma.$transaction(async (db) => {
      const workflow = await db.automationWorkflow.findFirst({
        where: {
          id: input.workflowId,
          workspaceId: input.workspaceId
        },
        select: {
          id: true,
          currentVersionId: true
        }
      });

      if (!workflow) {
        throw new AppError('Automation workflow not found.', 404);
      }

      if (workflow.currentVersionId === input.versionId) {
        throw new AppError('Current workflow version cannot be archived.', 422);
      }

      const version = await db.automationWorkflowVersion.findFirst({
        where: {
          id: input.versionId,
          workflowId: workflow.id,
          workspaceId: input.workspaceId
        },
        select: { id: true }
      });

      if (!version) {
        throw new AppError('Automation workflow version not found.', 404);
      }

      return db.automationWorkflowVersion.update({
        where: { id: version.id },
        data: { status: 'archived' }
      });
    });
  }

  public async listVersions(input: {
    workspaceId: string;
    workflowId: string;
    status?: AutomationWorkflowVersionStatus;
    limit?: number;
  }) {
    if (input.status && !isAutomationWorkflowVersionStatus(input.status)) {
      throw new AppError('Invalid automation workflow version status.', 422);
    }

    return this.prisma.automationWorkflowVersion.findMany({
      where: {
        workspaceId: input.workspaceId,
        workflowId: input.workflowId,
        status: input.status
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      take: normalizeAutomationLimit(input.limit)
    });
  }

  public async getVersion(input: { workspaceId: string; workflowId: string; versionId: string }) {
    const version = await this.prisma.automationWorkflowVersion.findFirst({
      where: {
        id: input.versionId,
        workflowId: input.workflowId,
        workspaceId: input.workspaceId
      }
    });

    if (!version) {
      throw new AppError('Automation workflow version not found.', 404);
    }

    return version;
  }
}
