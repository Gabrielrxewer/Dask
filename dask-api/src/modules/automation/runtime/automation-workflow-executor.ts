import type {
  AutomationRun,
  AutomationWorkflowVersion,
  Prisma,
  PrismaClient
} from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import type { AutomationAIService } from '@/modules/automation/application/automation-ai-service';
import { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AutomationScheduledStepService } from '@/modules/automation/application/automation-scheduled-step-service';
import { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import { AutomationStepRunService } from '@/modules/automation/application/automation-step-run-service';
import type {
  AutomationWorkflowEdge,
  AutomationWorkflowGraph,
  AutomationWorkflowNode
} from '@/modules/automation/application/workflow-execution-types';
import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult
} from '@/modules/automation/runtime/automation-node-executor';
import { createDefaultAutomationNodeRegistry } from '@/modules/automation/runtime/automation-node-registry';
import type { AutomationNodeRegistry } from '@/modules/automation/runtime/automation-node-registry';
import type {
  AutomationWorkflowExecutionResult,
  AutomationWorkflowExecutionStatus
} from '@/modules/automation/runtime/automation-runtime-context';
import {
  calculateAutomationRetryAt,
  canRetryAutomationAttempt,
  normalizeAutomationRetryPolicy,
  type AutomationRetryPolicy
} from '@/modules/automation/runtime/automation-retry-policy';
import {
  isRetryableAutomationError,
  normalizeAutomationError,
  sanitizeAutomationPayload
} from '@/modules/automation/runtime/automation-runtime-errors';

type StepRunServiceLike = Pick<
  AutomationStepRunService,
  | 'createStepRun'
  | 'startStepRun'
  | 'markStepRunWaiting'
  | 'completeStepRun'
  | 'skipStepRun'
  | 'failStepRun'
  | 'cancelStepRun'
>;

type ScheduledStepServiceLike = Pick<
  AutomationScheduledStepService,
  'scheduleStep' | 'cancelRunScheduledSteps'
>;

type RunEventServiceLike = Pick<AutomationRunEventService, 'createEvent'>;

type ApprovalRequestServiceLike = Pick<AutomationApprovalRequestService, 'cancelRunApprovals'>;

type ExecuteWorkflowInput = {
  workspaceId: string;
  runId: string;
  startNodeId?: string;
  startNodeIds?: string[];
  retryOfStepRunId?: string;
  now?: Date;
};

type ResumeAfterNodeInput = {
  workspaceId: string;
  runId: string;
  completedNodeId: string;
  now?: Date;
};

const terminalRunStatuses = new Set(['completed', 'failed', 'cancelled']);
const terminalStepRunStatuses = new Set(['completed', 'skipped', 'failed', 'cancelled']);
const maxNodesPerExecution = 100;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeNodes(value: unknown): AutomationWorkflowNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rawNodes = value.filter((entry): entry is Record<string, unknown> => isRecord(entry));

  return rawNodes
    .map((node, index) => {
      const id = typeof node.id === 'string' && node.id.trim().length > 0 ? node.id.trim() : `node-${index + 1}`;
      const type = typeof node.type === 'string' && node.type.trim().length > 0 ? node.type.trim() : 'unknown';
      return {
        id,
        type,
        label: typeof node.label === 'string' ? node.label : undefined,
        config: isRecord(node.config) ? node.config : {},
        position: isRecord(node.position)
          && typeof node.position.x === 'number'
          && typeof node.position.y === 'number'
          ? { x: node.position.x, y: node.position.y }
          : undefined
      };
    });
}

function normalizeEdges(value: unknown): AutomationWorkflowEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rawEdges = value.filter((entry): entry is Record<string, unknown> => isRecord(entry));

  return rawEdges
    .map((edge, index) => {
      const id = typeof edge.id === 'string' && edge.id.trim().length > 0 ? edge.id.trim() : `edge-${index + 1}`;
      const source = typeof edge.source === 'string' ? edge.source.trim() : '';
      const target = typeof edge.target === 'string' ? edge.target.trim() : '';
      return {
        id,
        source,
        target,
        sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : null,
        targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : null,
        condition: isRecord(edge.condition) ? edge.condition : undefined
      };
    })
    .filter((edge) => edge.source.length > 0 && edge.target.length > 0);
}

function buildGraph(version: AutomationWorkflowVersion): AutomationWorkflowGraph {
  const definition = toRecord(version.definitionJson);
  const definitionGraph = isRecord(definition.graph) ? definition.graph : {};
  const graphNodes = normalizeNodes(version.graphNodesJson);
  const graphEdges = normalizeEdges(version.graphEdgesJson);
  const fallbackNodes = normalizeNodes(definitionGraph.nodes ?? []);
  const fallbackEdges = normalizeEdges(definitionGraph.edges ?? []);

  return {
    version: 1,
    nodes: graphNodes.length > 0 ? graphNodes : fallbackNodes,
    edges: graphEdges.length > 0 ? graphEdges : fallbackEdges,
    metadata: isRecord(definitionGraph.metadata) ? definitionGraph.metadata : undefined
  };
}

function readPersistedNextNodeIds(output: Prisma.JsonValue | null): string[] | null {
  if (!isRecord(output) || !Array.isArray(output.nextNodeIds)) {
    return null;
  }

  const nextNodeIds = output.nextNodeIds.filter((nodeId): nodeId is string => {
    return typeof nodeId === 'string' && nodeId.trim().length > 0;
  });

  return nextNodeIds;
}

function buildNodeOutput(result: AutomationNodeExecutionResult): Record<string, unknown> | undefined {
  if (result.status === 'failed') {
    return undefined;
  }

  const output = result.output ? { ...result.output } : {};
  if (result.status === 'completed' || result.status === 'skipped') {
    if (result.nextNodeIds) {
      output.nextNodeIds = result.nextNodeIds;
    }
  }

  if (result.status === 'waiting') {
    if (result.resumeAt) {
      output.resumeAt = result.resumeAt.toISOString();
    }
    if (result.reason) {
      output.reason = result.reason;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export class AutomationWorkflowExecutor {
  private readonly stepRunService: StepRunServiceLike;
  private readonly scheduledStepService: ScheduledStepServiceLike;
  private readonly sideEffectService: AutomationSideEffectService;
  private readonly approvalRequestService: ApprovalRequestServiceLike;
  private readonly eventService: RunEventServiceLike;
  private readonly registry: AutomationNodeRegistry;
  private readonly retryPolicy: AutomationRetryPolicy;

  public constructor(private readonly prisma: PrismaClient, input?: {
    registry?: AutomationNodeRegistry;
    stepRunService?: StepRunServiceLike;
    scheduledStepService?: ScheduledStepServiceLike;
    eventService?: RunEventServiceLike;
    sideEffectService?: AutomationSideEffectService;
    aiService?: AutomationAIService;
    approvalRequestService?: ApprovalRequestServiceLike;
    retryPolicy?: Partial<AutomationRetryPolicy>;
  }) {
    this.stepRunService = input?.stepRunService ?? new AutomationStepRunService(prisma);
    this.scheduledStepService = input?.scheduledStepService ?? new AutomationScheduledStepService(prisma);
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
    this.sideEffectService = input?.sideEffectService ?? new AutomationSideEffectService(prisma, {
      eventService: this.eventService as AutomationRunEventService
    });
    this.approvalRequestService = input?.approvalRequestService ?? new AutomationApprovalRequestService(prisma, {
      eventService: this.eventService as AutomationRunEventService
    });
    this.registry = input?.registry ?? createDefaultAutomationNodeRegistry({
      sideEffectService: this.sideEffectService,
      aiService: input?.aiService,
      eventService: this.eventService as AutomationRunEventService,
      approvalRequestService: this.approvalRequestService as AutomationApprovalRequestService
    });
    this.retryPolicy = normalizeAutomationRetryPolicy(input?.retryPolicy);
  }

  public async executeRun(input: ExecuteWorkflowInput): Promise<AutomationWorkflowExecutionResult> {
    const now = input.now ?? new Date();
    const run = await this.loadRun(input.workspaceId, input.runId);

    if (run.cancelledAt || run.status === 'cancelled') {
      await this.cancelOpenWork(run, 'Automation run was cancelled before execution.');
      return this.result(run.id, 'cancelled', []);
    }

    if (terminalRunStatuses.has(run.status)) {
      return this.result(run.id, run.status as AutomationWorkflowExecutionStatus, []);
    }

    const workflowVersion = await this.loadWorkflowVersion(run);
    const graph = buildGraph(workflowVersion);
    const startNodeIds = this.resolveStartNodeIds(graph, input);
    if (startNodeIds.length === 0) {
      await this.completeRun(run.id);
      return this.result(run.id, 'completed', []);
    }

    await this.markRunRunning(run, now);

    return this.executeFromNodeIds({
      run,
      workflowVersion,
      graph,
      startNodeIds,
      retryOfStepRunId: input.retryOfStepRunId,
      now
    });
  }

  public async resumeAfterNode(input: ResumeAfterNodeInput): Promise<AutomationWorkflowExecutionResult> {
    const run = await this.loadRun(input.workspaceId, input.runId);

    if (run.cancelledAt || run.status === 'cancelled') {
      await this.cancelOpenWork(run, 'Automation run was cancelled before resume.');
      return this.result(run.id, 'cancelled', []);
    }

    if (terminalRunStatuses.has(run.status)) {
      return this.result(run.id, run.status as AutomationWorkflowExecutionStatus, []);
    }

    const workflowVersion = await this.loadWorkflowVersion(run);
    const graph = buildGraph(workflowVersion);
    const nextNodeIds = this.resolveNextNodeIds(graph, input.completedNodeId);

    if (nextNodeIds.length === 0) {
      await this.completeRun(run.id);
      return this.result(run.id, 'completed', []);
    }

    return this.executeRun({
      workspaceId: input.workspaceId,
      runId: input.runId,
      startNodeIds: nextNodeIds,
      now: input.now
    });
  }

  private async executeFromNodeIds(input: {
    run: AutomationRun;
    workflowVersion: AutomationWorkflowVersion;
    graph: AutomationWorkflowGraph;
    startNodeIds: string[];
    retryOfStepRunId?: string;
    now: Date;
  }): Promise<AutomationWorkflowExecutionResult> {
    const executedNodeIds: string[] = [];
    const pendingNodeIds = [...input.startNodeIds];
    let previousOutput: Record<string, unknown> | undefined;
    let retryAttemptConsumed = false;

    while (pendingNodeIds.length > 0) {
      if (executedNodeIds.length >= maxNodesPerExecution) {
        const error = {
          message: 'Automation workflow execution exceeded the maximum node limit.',
          maxNodesPerExecution
        };
        await this.failRun(input.run.workspaceId, input.run.id, error);
        return this.result(input.run.id, 'failed', executedNodeIds, { error });
      }

      const currentRun = await this.loadRun(input.run.workspaceId, input.run.id);
      if (currentRun.cancelledAt || currentRun.status === 'cancelled') {
        await this.cancelOpenWork(currentRun, 'Automation run was cancelled during execution.');
        return this.result(input.run.id, 'cancelled', executedNodeIds);
      }

      if (terminalRunStatuses.has(currentRun.status)) {
        return this.result(input.run.id, currentRun.status as AutomationWorkflowExecutionStatus, executedNodeIds);
      }

      const nodeId = pendingNodeIds.shift();
      if (!nodeId) {
        continue;
      }

      const node = input.graph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        const error = { message: 'Automation workflow node not found.', nodeId };
        await this.failRun(input.run.workspaceId, input.run.id, error);
        return this.result(input.run.id, 'failed', executedNodeIds, { error });
      }

      const stepInput = this.buildStepInput(currentRun, node, previousOutput);
      const retryAttempt = !retryAttemptConsumed && input.retryOfStepRunId
        ? await this.resolveRetryAttempt({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          retryOfStepRunId: input.retryOfStepRunId,
          nodeId: node.id
        })
        : undefined;
      if (retryAttempt) {
        retryAttemptConsumed = true;
      }

      const stepRun = await this.stepRunService.createStepRun({
        workspaceId: currentRun.workspaceId,
        runId: currentRun.id,
        nodeId: node.id,
        nodeType: node.type,
        status: 'running',
        attempt: retryAttempt,
        input: stepInput,
        idempotencyKey: this.buildStepIdempotencyKey(currentRun.id, node.id, retryAttempt ?? 1)
      });

      await this.logEvent({
        workspaceId: currentRun.workspaceId,
        runId: currentRun.id,
        stepRunId: stepRun.id,
        eventType: 'step.created',
        message: 'Automation step run was created.',
        payload: {
          nodeId: node.id,
          nodeType: node.type,
          attempt: stepRun.attempt,
          status: stepRun.status,
          idempotencyKey: stepRun.idempotencyKey
        }
      });

      if (terminalStepRunStatuses.has(stepRun.status)) {
        const persistedNextNodeIds = readPersistedNextNodeIds(stepRun.outputJson);
        if (stepRun.status === 'failed') {
          const error = toRecord(stepRun.errorJson);
          await this.failRun(currentRun.workspaceId, currentRun.id, error);
          return this.result(currentRun.id, 'failed', executedNodeIds, { error });
        }

        if (stepRun.status === 'cancelled') {
          await this.cancelOpenWork(currentRun, 'Automation step run was already cancelled.');
          return this.result(currentRun.id, 'cancelled', executedNodeIds);
        }

        const nextNodeIds = persistedNextNodeIds ?? this.resolveNextNodeIds(input.graph, node.id);
        pendingNodeIds.unshift(...nextNodeIds);
        previousOutput = toRecord(stepRun.outputJson);
        continue;
      }

      if (stepRun.status !== 'running') {
        await this.stepRunService.startStepRun({
          workspaceId: currentRun.workspaceId,
          stepRunId: stepRun.id
        });
      }

      await this.logEvent({
        workspaceId: currentRun.workspaceId,
        runId: currentRun.id,
        stepRunId: stepRun.id,
        eventType: 'step.started',
        message: 'Automation step run started.',
        payload: {
          nodeId: node.id,
          nodeType: node.type,
          attempt: stepRun.attempt
        }
      });

      executedNodeIds.push(node.id);
      const result = await this.executeNode({
        run: currentRun,
        stepRun,
        node,
        graph: input.graph,
        incomingEdges: input.graph.edges.filter((edge) => edge.target === node.id),
        outgoingEdges: input.graph.edges.filter((edge) => edge.source === node.id),
        context: toRecord(currentRun.contextJson),
        input: stepInput,
        now: input.now
      });

      if (result.status === 'failed') {
        const error = normalizeAutomationError(result.error);
        await this.stepRunService.failStepRun({
          workspaceId: currentRun.workspaceId,
          stepRunId: stepRun.id,
          error
        });
        await this.logEvent({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          stepRunId: stepRun.id,
          eventType: 'step.failed',
          level: 'error',
          message: 'Automation step run failed.',
          payload: {
            nodeId: node.id,
            nodeType: node.type,
            attempt: stepRun.attempt,
            error
          }
        });

        if (this.shouldRetryStep(stepRun.attempt, result)) {
          const retryAt = calculateAutomationRetryAt(stepRun.attempt, input.now, this.retryPolicy);
          const scheduledStep = await this.scheduledStepService.scheduleStep({
            workspaceId: currentRun.workspaceId,
            runId: currentRun.id,
            stepRunId: stepRun.id,
            nodeId: node.id,
            purpose: 'retry',
            executeAt: retryAt,
            markRunWaiting: true,
            markStepWaiting: false
          });
          await this.logEvent({
            workspaceId: currentRun.workspaceId,
            runId: currentRun.id,
            stepRunId: stepRun.id,
            eventType: 'retry.scheduled',
            level: 'warn',
            message: 'Automation step retry was scheduled.',
            payload: {
              nodeId: node.id,
              nodeType: node.type,
              attempt: stepRun.attempt,
              nextAttempt: stepRun.attempt + 1,
              retryAt: retryAt.toISOString(),
              retryPolicy: this.retryPolicy,
              scheduledStepId: scheduledStep.id,
              error
            }
          });
          await this.logEvent({
            workspaceId: currentRun.workspaceId,
            runId: currentRun.id,
            eventType: 'run.waiting',
            message: 'Automation run is waiting for a retry.',
            payload: {
              nodeId: node.id,
              retryAt: retryAt.toISOString()
            }
          });
          return this.result(currentRun.id, 'waiting', executedNodeIds, {
            waitingNodeId: node.id,
            resumeAt: retryAt,
            error
          });
        }

        if (this.isRetryableResult(result)) {
          await this.logEvent({
            workspaceId: currentRun.workspaceId,
            runId: currentRun.id,
            stepRunId: stepRun.id,
            eventType: 'retry.exhausted',
            level: 'error',
            message: 'Automation step retry policy was exhausted.',
            payload: {
              nodeId: node.id,
              nodeType: node.type,
              attempt: stepRun.attempt,
              retryPolicy: this.retryPolicy,
              error
            }
          });
        }

        await this.failRun(currentRun.workspaceId, currentRun.id, error);
        return this.result(currentRun.id, 'failed', executedNodeIds, { error });
      }

      const output = buildNodeOutput(result);

      if (result.status === 'waiting') {
        if (!result.resumeAt) {
          const error = {
            message: 'Waiting automation node did not return resumeAt.',
            nodeId: node.id
          };
          await this.stepRunService.failStepRun({
            workspaceId: currentRun.workspaceId,
            stepRunId: stepRun.id,
            error
          });
          await this.failRun(currentRun.workspaceId, currentRun.id, error);
          return this.result(currentRun.id, 'failed', executedNodeIds, { error });
        }

        await this.stepRunService.markStepRunWaiting({
          workspaceId: currentRun.workspaceId,
          stepRunId: stepRun.id,
          output
        });
        const scheduledStep = await this.scheduledStepService.scheduleStep({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          stepRunId: stepRun.id,
          nodeId: node.id,
          purpose: 'resume',
          executeAt: result.resumeAt,
          markRunWaiting: true,
          markStepWaiting: false
        });
        await this.logEvent({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          stepRunId: stepRun.id,
          eventType: 'step.waiting',
          message: 'Automation step run is waiting.',
          payload: {
            nodeId: node.id,
            nodeType: node.type,
            resumeAt: result.resumeAt.toISOString(),
            reason: result.reason
          }
        });
        await this.logEvent({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          stepRunId: stepRun.id,
          eventType: 'scheduled_step.created',
          message: 'Automation scheduled step was created.',
          payload: {
            scheduledStepId: scheduledStep.id,
            nodeId: node.id,
            purpose: scheduledStep.purpose,
            executeAt: scheduledStep.executeAt.toISOString()
          }
        });
        await this.logEvent({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          eventType: 'run.waiting',
          message: 'Automation run is waiting for a scheduled step.',
          payload: {
            nodeId: node.id,
            resumeAt: result.resumeAt.toISOString()
          }
        });
        return this.result(currentRun.id, 'waiting', executedNodeIds, {
          waitingNodeId: node.id,
          resumeAt: result.resumeAt
        });
      }

      if (result.status === 'skipped') {
        await this.stepRunService.skipStepRun({
          workspaceId: currentRun.workspaceId,
          stepRunId: stepRun.id,
          output
        });
        await this.logEvent({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          stepRunId: stepRun.id,
          eventType: 'step.skipped',
          message: 'Automation step run was skipped.',
          payload: {
            nodeId: node.id,
            nodeType: node.type,
            attempt: stepRun.attempt
          }
        });
      } else {
        await this.stepRunService.completeStepRun({
          workspaceId: currentRun.workspaceId,
          stepRunId: stepRun.id,
          output
        });
        await this.logEvent({
          workspaceId: currentRun.workspaceId,
          runId: currentRun.id,
          stepRunId: stepRun.id,
          eventType: 'step.completed',
          message: 'Automation step run completed.',
          payload: {
            nodeId: node.id,
            nodeType: node.type,
            attempt: stepRun.attempt
          }
        });
      }

      const nextNodeIds = result.nextNodeIds ?? this.resolveNextNodeIds(input.graph, node.id);
      pendingNodeIds.unshift(...nextNodeIds);
      previousOutput = output;
    }

    await this.completeRun(input.run.id);
    return this.result(input.run.id, 'completed', executedNodeIds);
  }

  private async executeNode(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    try {
      const result = await this.registry.get(input.node.type).execute(input);
      if (result.status !== 'failed') {
        return result;
      }

      const error = normalizeAutomationError(result.error);
      return {
        status: 'failed',
        error,
        retryable: result.retryable ?? error.retryable
      };
    } catch (error) {
      const sanitizedError = normalizeAutomationError(error);
      return {
        status: 'failed',
        error: sanitizedError,
        retryable: sanitizedError.retryable
      };
    }
  }

  private shouldRetryStep(
    attempt: number,
    result: Extract<AutomationNodeExecutionResult, { status: 'failed' }>
  ): boolean {
    return this.isRetryableResult(result) && canRetryAutomationAttempt(attempt, this.retryPolicy);
  }

  private isRetryableResult(
    result: Extract<AutomationNodeExecutionResult, { status: 'failed' }>
  ): boolean {
    return result.retryable === true || isRetryableAutomationError(result.error);
  }

  private resolveStartNodeIds(graph: AutomationWorkflowGraph, input: ExecuteWorkflowInput): string[] {
    const explicitNodeIds = input.startNodeIds ?? (input.startNodeId ? [input.startNodeId] : []);
    if (explicitNodeIds.length > 0) {
      return explicitNodeIds;
    }

    const incomingTargets = new Set(graph.edges.map((edge) => edge.target));
    const trigger = graph.nodes.find((node) => node.type === 'trigger' && !incomingTargets.has(node.id));
    const firstRoot = graph.nodes.find((node) => !incomingTargets.has(node.id));
    const firstNode = trigger ?? firstRoot ?? graph.nodes[0];

    return firstNode ? [firstNode.id] : [];
  }

  private resolveNextNodeIds(graph: AutomationWorkflowGraph, nodeId: string): string[] {
    return graph.edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => edge.target);
  }

  private buildStepInput(
    run: AutomationRun,
    node: AutomationWorkflowNode,
    previousOutput: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    return {
      runId: run.id,
      workflowId: run.workflowId,
      workflowVersionId: run.workflowVersionId,
      triggerType: run.triggerType,
      triggerRefId: run.triggerRefId,
      context: toRecord(run.contextJson),
      node: {
        id: node.id,
        type: node.type,
        config: sanitizeAutomationPayload(node.config)
      },
      previousOutput
    };
  }

  private buildStepIdempotencyKey(runId: string, nodeId: string, attempt: number): string {
    return `automation-run:${runId}:node:${nodeId}:attempt:${attempt}`;
  }

  private async resolveRetryAttempt(input: {
    workspaceId: string;
    runId: string;
    retryOfStepRunId: string;
    nodeId: string;
  }): Promise<number> {
    const previousStepRun = await this.prisma.automationStepRun.findFirst({
      where: {
        id: input.retryOfStepRunId,
        workspaceId: input.workspaceId,
        runId: input.runId
      },
      select: {
        id: true,
        nodeId: true,
        attempt: true,
        status: true
      }
    });

    if (!previousStepRun) {
      throw new AppError('Retry source automation step run not found.', 404);
    }

    if (previousStepRun.nodeId !== input.nodeId) {
      throw new AppError('Retry source step does not match the requested automation node.', 422, {
        retryOfStepRunId: input.retryOfStepRunId,
        retryNodeId: input.nodeId,
        sourceNodeId: previousStepRun.nodeId
      });
    }

    return previousStepRun.attempt + 1;
  }

  private async loadRun(workspaceId: string, runId: string): Promise<AutomationRun> {
    const run = await this.prisma.automationRun.findFirst({
      where: {
        id: runId,
        workspaceId
      }
    });

    if (!run) {
      throw new AppError('Automation run not found.', 404);
    }

    return run;
  }

  private async loadWorkflowVersion(run: AutomationRun): Promise<AutomationWorkflowVersion> {
    const workflowVersion = await this.prisma.automationWorkflowVersion.findFirst({
      where: {
        id: run.workflowVersionId,
        workflowId: run.workflowId,
        workspaceId: run.workspaceId
      }
    });

    if (!workflowVersion) {
      throw new AppError('Automation workflow version not found.', 404);
    }

    return workflowVersion;
  }

  private async markRunRunning(run: AutomationRun, now: Date): Promise<void> {
    await this.prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'running',
        startedAt: run.startedAt ?? now
      }
    });

    if (!run.startedAt) {
      await this.logEvent({
        workspaceId: run.workspaceId,
        runId: run.id,
        eventType: 'run.started',
        message: 'Automation run started.',
        payload: {
          workflowId: run.workflowId,
          workflowVersionId: run.workflowVersionId,
          triggerType: run.triggerType
        }
      });
    }
  }

  private async completeRun(runId: string): Promise<void> {
    const run = await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        finishedAt: new Date()
      }
    });

    await this.logEvent({
      workspaceId: run.workspaceId,
      runId: run.id,
      eventType: 'run.completed',
      message: 'Automation run completed.',
      payload: {
        workflowId: run.workflowId,
        workflowVersionId: run.workflowVersionId
      }
    });
  }

  private async failRun(
    workspaceId: string,
    runId: string,
    error: Record<string, unknown>
  ): Promise<void> {
    const safeError = normalizeAutomationError(error);
    const run = await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorJson: toJsonValue(safeError)
      }
    });

    await this.logEvent({
      workspaceId,
      runId: run.id,
      eventType: 'run.failed',
      level: 'error',
      message: 'Automation run failed.',
      payload: {
        workflowId: run.workflowId,
        workflowVersionId: run.workflowVersionId,
        error: safeError
      }
    });
  }

  private async cancelOpenWork(run: AutomationRun, reason: string): Promise<void> {
    const now = new Date();
    await this.scheduledStepService.cancelRunScheduledSteps({
      workspaceId: run.workspaceId,
      runId: run.id,
      reason
    });
    await this.sideEffectService.cancelRunSideEffects({
      workspaceId: run.workspaceId,
      runId: run.id,
      reason
    });
    await this.approvalRequestService.cancelRunApprovals({
      workspaceId: run.workspaceId,
      runId: run.id,
      reason
    });
    await this.prisma.automationStepRun.updateMany({
      where: {
        workspaceId: run.workspaceId,
        runId: run.id,
        status: { in: ['queued', 'running', 'waiting'] }
      },
      data: {
        status: 'cancelled',
        finishedAt: now
      }
    });
    const cancelledRun = await this.prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'cancelled',
        cancelledAt: run.cancelledAt ?? now,
        finishedAt: now,
        cancelReason: run.cancelReason ?? reason
      }
    });

    await this.logEvent({
      workspaceId: cancelledRun.workspaceId,
      runId: cancelledRun.id,
      eventType: 'run.cancelled',
      message: 'Automation run was cancelled.',
      payload: {
        reason: cancelledRun.cancelReason ?? reason
      }
    });
  }

  private async logEvent(input: Parameters<RunEventServiceLike['createEvent']>[0]): Promise<void> {
    await this.eventService.createEvent(input);
  }

  private result(
    runId: string,
    status: AutomationWorkflowExecutionStatus,
    executedNodeIds: string[],
    extra?: {
      waitingNodeId?: string;
      resumeAt?: Date;
      error?: Record<string, unknown>;
    }
  ): AutomationWorkflowExecutionResult {
    return {
      runId,
      status,
      executedNodeIds,
      waitingNodeId: extra?.waitingNodeId,
      resumeAt: extra?.resumeAt,
      error: extra?.error
    };
  }
}
