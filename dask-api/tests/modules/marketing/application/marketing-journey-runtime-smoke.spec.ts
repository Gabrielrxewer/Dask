import type {
  AutomationRun,
  AutomationRunEvent,
  AutomationSideEffect,
  AutomationStepRun,
  AutomationWorkflow,
  AutomationWorkflowVersion,
  PrismaClient
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DomainEventNames } from '@/core/events/event-names';
import type { DomainEvent } from '@/core/events/domain-event';
import { AutomationEventDispatcher } from '@/modules/automation/application/automation-event-dispatcher';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';
import { validateAutomationWorkflowGraph } from '@/modules/automation/application/automation-workflow-graph-validation';
import type {
  AutomationWorkflowDefinition,
  AutomationWorkflowGraph
} from '@/modules/automation/application/workflow-execution-types';
import type { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import { AutomationWorkflowExecutor } from '@/modules/automation/runtime/automation-workflow-executor';
import { MarketingService } from '@/modules/marketing/application/marketing-service';
import type { MarketingRepository } from '@/modules/marketing/repositories/marketing-repository';

const now = new Date('2026-05-11T12:00:00.000Z');

type StoredWorkflow = Omit<AutomationWorkflow, 'workspace' | 'currentVersion' | 'createdBy' | 'versions' | 'runs'>;
type StoredVersion = Omit<
  AutomationWorkflowVersion,
  'workspace' | 'workflow' | 'currentForWorkflow' | 'publishedBy' | 'runs'
> & {
  workflow?: Pick<AutomationWorkflow, 'id' | 'status'>;
};
type StoredRun = Omit<
  AutomationRun,
  'workspace' | 'workflow' | 'workflowVersion' | 'stepRuns' | 'scheduledSteps' | 'events' | 'sideEffects' | 'approvalRequests' | 'communicationInteractions'
>;
type StoredStepRun = Omit<
  AutomationStepRun,
  'workspace' | 'run' | 'scheduledSteps' | 'events' | 'sideEffects' | 'approvalRequests' | 'communicationInteractions'
>;
type StoredRunEvent = Omit<AutomationRunEvent, 'workspace' | 'run' | 'stepRun'>;
type StoredSideEffect = Omit<
  AutomationSideEffect,
  'workspace' | 'run' | 'stepRun' | 'templateVersion' | 'approvalRequest' | 'interactions'
>;

type RuntimeStore = {
  workspaceId: string;
  workflows: Map<string, StoredWorkflow>;
  versions: Map<string, StoredVersion>;
  runs: StoredRun[];
  stepRuns: StoredStepRun[];
  events: StoredRunEvent[];
  sideEffects: StoredSideEffect[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function createStore(): RuntimeStore {
  return {
    workspaceId: 'workspace-1',
    workflows: new Map(),
    versions: new Map(),
    runs: [],
    stepRuns: [],
    events: [],
    sideEffects: []
  };
}

function versionWithWorkflow(store: RuntimeStore, version: StoredVersion): StoredVersion {
  const workflow = store.workflows.get(version.workflowId);
  return {
    ...version,
    workflow: {
      id: version.workflowId,
      status: workflow?.status ?? 'draft'
    }
  };
}

function createRuntimePrisma(store: RuntimeStore): PrismaClient {
  const prisma = {
    workspace: {
      findUnique: vi.fn(async (args: { where?: { id?: string } }) =>
        args.where?.id === store.workspaceId ? { id: store.workspaceId } : null
      )
    },
    automationWorkflow: {
      findMany: vi.fn(async () =>
        Array.from(store.workflows.values())
          .filter((workflow) => workflow.status === 'active')
          .map((workflow) => {
            const currentVersion = workflow.currentVersionId
              ? store.versions.get(workflow.currentVersionId) ?? null
              : null;
            return {
              ...workflow,
              currentVersion: currentVersion && currentVersion.status === 'published'
                ? versionWithWorkflow(store, currentVersion)
                : null
            };
          })
      ),
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args.where ?? {};
        const workflowId = readString(where, 'id');
        const workspaceId = readString(where, 'workspaceId');
        const workflow = workflowId ? store.workflows.get(workflowId) ?? null : null;
        if (!workflow || workflow.workspaceId !== workspaceId) {
          return null;
        }
        return workflow;
      }),
      create: vi.fn(),
      update: vi.fn()
    },
    automationWorkflowVersion: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args.where ?? {};
        const versionId = readString(where, 'id');
        const workflowId = readString(where, 'workflowId');
        const workspaceId = readString(where, 'workspaceId');
        const version = versionId ? store.versions.get(versionId) ?? null : null;
        if (!version || version.workspaceId !== workspaceId || (workflowId && version.workflowId !== workflowId)) {
          return null;
        }
        return versionWithWorkflow(store, version);
      })
    },
    automationRun: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const run: StoredRun = {
          id: `run-${store.runs.length + 1}`,
          workspaceId: String(args.data.workspaceId),
          workflowId: String(args.data.workflowId),
          workflowVersionId: String(args.data.workflowVersionId),
          triggerType: String(args.data.triggerType),
          triggerRefId: typeof args.data.triggerRefId === 'string' ? args.data.triggerRefId : null,
          status: 'queued',
          contextJson: args.data.contextJson ?? null,
          startedAt: null,
          finishedAt: null,
          cancelledAt: null,
          cancelReason: null,
          errorJson: null,
          createdAt: now,
          updatedAt: now
        };
        store.runs.push(run);
        return { ...run };
      }),
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args.where ?? {};
        const id = readString(where, 'id');
        if (id) {
          const run = store.runs.find((entry) => entry.id === id && entry.workspaceId === readString(where, 'workspaceId'));
          return run ? { ...run } : null;
        }

        const run = store.runs.find((entry) =>
          entry.workspaceId === readString(where, 'workspaceId') &&
          entry.workflowId === readString(where, 'workflowId') &&
          entry.workflowVersionId === readString(where, 'workflowVersionId') &&
          entry.triggerType === readString(where, 'triggerType') &&
          entry.triggerRefId === readString(where, 'triggerRefId')
        );
        return run ? { ...run } : null;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const run = store.runs.find((entry) => entry.id === args.where.id);
        if (!run) {
          throw new Error(`Run ${args.where.id} not found.`);
        }

        Object.assign(run, {
          status: typeof args.data.status === 'string' ? args.data.status : run.status,
          startedAt: args.data.startedAt instanceof Date ? args.data.startedAt : run.startedAt,
          finishedAt: args.data.finishedAt instanceof Date ? args.data.finishedAt : run.finishedAt,
          cancelledAt: args.data.cancelledAt instanceof Date ? args.data.cancelledAt : run.cancelledAt,
          cancelReason: typeof args.data.cancelReason === 'string' ? args.data.cancelReason : run.cancelReason,
          errorJson: args.data.errorJson ?? run.errorJson,
          updatedAt: now
        });

        return { ...run };
      })
    },
    automationStepRun: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    automationRunEvent: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const event: StoredRunEvent = {
          id: `event-log-${store.events.length + 1}`,
          workspaceId: String(args.data.workspaceId),
          runId: String(args.data.runId),
          stepRunId: typeof args.data.stepRunId === 'string' ? args.data.stepRunId : null,
          eventType: String(args.data.eventType),
          level: typeof args.data.level === 'string' ? args.data.level : 'info',
          message: String(args.data.message),
          payloadJson: args.data.payloadJson ?? null,
          createdAt: now
        };
        store.events.push(event);
        return event;
      }),
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args.where ?? {};
        return store.events.filter((event) =>
          event.workspaceId === readString(where, 'workspaceId') &&
          event.runId === readString(where, 'runId')
        );
      })
    }
  };

  return prisma as unknown as PrismaClient;
}

function createStepRunService(store: RuntimeStore) {
  return {
    createStepRun: vi.fn(async (input: {
      workspaceId: string;
      runId: string;
      nodeId: string;
      nodeType: string;
      status?: string;
      attempt?: number;
      input?: unknown;
      idempotencyKey?: string;
    }) => {
      const stepRun: StoredStepRun = {
        id: `step-${input.nodeId}`,
        workspaceId: input.workspaceId,
        runId: input.runId,
        nodeId: input.nodeId,
        nodeType: input.nodeType,
        status: input.status ?? 'running',
        inputJson: input.input ?? {},
        outputJson: null,
        errorJson: null,
        attempt: input.attempt ?? 1,
        idempotencyKey: input.idempotencyKey ?? null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now
      };
      store.stepRuns.push(stepRun);
      return stepRun;
    }),
    startStepRun: vi.fn(async (input: { stepRunId: string }) => {
      const stepRun = store.stepRuns.find((entry) => entry.id === input.stepRunId);
      if (stepRun) {
        stepRun.status = 'running';
      }
      return stepRun;
    }),
    markStepRunWaiting: vi.fn(),
    completeStepRun: vi.fn(async (input: { stepRunId: string; output?: unknown }) => {
      const stepRun = store.stepRuns.find((entry) => entry.id === input.stepRunId);
      if (!stepRun) {
        throw new Error(`Step run ${input.stepRunId} not found.`);
      }
      stepRun.status = 'completed';
      stepRun.outputJson = input.output ?? null;
      stepRun.finishedAt = now;
      stepRun.updatedAt = now;
      return stepRun;
    }),
    skipStepRun: vi.fn(),
    failStepRun: vi.fn(async (input: { stepRunId: string; error?: unknown }) => {
      const stepRun = store.stepRuns.find((entry) => entry.id === input.stepRunId);
      if (stepRun) {
        stepRun.status = 'failed';
        stepRun.errorJson = input.error ?? null;
      }
      return stepRun;
    }),
    cancelStepRun: vi.fn()
  };
}

function createScheduledStepService() {
  return {
    scheduleStep: vi.fn(),
    cancelRunScheduledSteps: vi.fn()
  };
}

function createSideEffectService(store: RuntimeStore): AutomationSideEffectService {
  const service = {
    createSideEffect: vi.fn(async (input: {
      workspaceId: string;
      runId: string;
      stepRunId: string;
      sideEffectType: string;
      channel?: string;
      provider?: string;
      idempotencyKey?: string;
      payload?: unknown;
      templateVersionId?: string;
      approvalRequestId?: string;
    }) => {
      const sideEffect: StoredSideEffect = {
        id: `side-effect-${store.sideEffects.length + 1}`,
        workspaceId: input.workspaceId,
        runId: input.runId,
        stepRunId: input.stepRunId,
        sideEffectType: input.sideEffectType,
        channel: input.channel ?? null,
        provider: input.provider ?? null,
        status: 'queued',
        payloadJson: input.payload ?? {},
        resultJson: null,
        errorJson: null,
        idempotencyKey: input.idempotencyKey ?? null,
        templateVersionId: input.templateVersionId ?? null,
        approvalRequestId: input.approvalRequestId ?? null,
        attempts: 0,
        nextAttemptAt: null,
        lockedAt: null,
        lockedBy: null,
        sentAt: null,
        cancelledAt: null,
        cancelReason: null,
        createdAt: now,
        updatedAt: now
      };
      store.sideEffects.push(sideEffect);
      return sideEffect;
    }),
    cancelRunSideEffects: vi.fn()
  };

  return service as unknown as AutomationSideEffectService;
}

function createMarketingJourneyDefinition(input?: { missingCampaign?: boolean }): Record<string, unknown> {
  return {
    version: 1,
    trigger: { event: 'commercial_work_item.created' },
    nodes: [
      {
        id: 'trigger-work-item',
        type: 'TRIGGER',
        data: {
          kind: 'TRIGGER',
          label: 'WorkItem captured',
          validation: 'valid',
          config: { event: 'commercial_work_item.created' }
        }
      },
      {
        id: 'send-welcome',
        type: 'ACTION',
        data: {
          kind: 'ACTION',
          label: 'Send welcome',
          validation: input?.missingCampaign ? 'incomplete' : 'valid',
          config: input?.missingCampaign
            ? { type: 'send_campaign' }
            : { type: 'send_campaign', campaignId: 'campaign-welcome' }
        }
      },
      {
        id: 'end',
        type: 'EXIT',
        data: {
          kind: 'EXIT',
          label: 'Done',
          validation: 'valid',
          config: {}
        }
      }
    ],
    edges: [
      { id: 'edge-trigger-send', source: 'trigger-work-item', target: 'send-welcome' },
      { id: 'edge-send-end', source: 'send-welcome', target: 'end' }
    ],
    metadata: {
      compiledAt: now.toISOString()
    }
  };
}

function createAutomationServices(store: RuntimeStore) {
  const automationWorkflowService = {
    createWorkflow: vi.fn(async (input: {
      workspaceId: string;
      name: string;
      description?: string | null;
      status?: string;
      createdById?: string | null;
    }) => {
      const workflow: StoredWorkflow = {
        id: 'workflow-1',
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'draft',
        currentVersionId: null,
        createdById: input.createdById ?? null,
        createdAt: now,
        updatedAt: now
      };
      store.workflows.set(workflow.id, workflow);
      return workflow;
    }),
    updateWorkflow: vi.fn(),
    setWorkflowStatus: vi.fn()
  };

  const automationWorkflowVersionService = {
    createDraftVersion: vi.fn(async (input: {
      workspaceId: string;
      workflowId: string;
      definition: AutomationWorkflowDefinition;
      graph: AutomationWorkflowGraph;
    }) => {
      validateAutomationWorkflowGraph(input.graph);
      const version: StoredVersion = {
        id: 'version-1',
        workspaceId: input.workspaceId,
        workflowId: input.workflowId,
        version: 1,
        status: 'draft',
        definitionJson: input.definition,
        graphNodesJson: input.graph.nodes,
        graphEdgesJson: input.graph.edges,
        publishedAt: null,
        publishedById: null,
        createdAt: now
      };
      store.versions.set(version.id, version);
      return version;
    }),
    publishVersion: vi.fn(async (input: {
      workspaceId: string;
      workflowId: string;
      versionId: string;
      publishedById?: string | null;
      activateWorkflow?: boolean;
    }) => {
      const version = store.versions.get(input.versionId);
      const workflow = store.workflows.get(input.workflowId);
      if (!version || !workflow) {
        throw new Error('Draft version not found.');
      }
      version.status = 'published';
      version.publishedAt = now;
      version.publishedById = input.publishedById ?? null;
      workflow.currentVersionId = version.id;
      workflow.status = input.activateWorkflow ? 'active' : workflow.status;
      workflow.updatedAt = now;
      return version;
    })
  };

  return {
    automationWorkflowService,
    automationWorkflowVersionService
  };
}

function createMarketingServiceHarness(store: RuntimeStore) {
  let flow: Record<string, unknown> | null = null;
  const repo = {
    createAutomationFlow: vi.fn(async (data: Record<string, unknown>) => {
      flow = {
        id: 'flow-1',
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description ?? null,
        status: data.status,
        triggerDefinition: data.triggerDefinition,
        steps: [],
        enrollments: [],
        events: [],
        updatedAt: now
      };
      return flow;
    }),
    createAutomationStep: vi.fn(),
    updateAutomationFlow: vi.fn(async (_flowId: string, _workspaceId: string, patch: Record<string, unknown>) => {
      flow = {
        ...(flow ?? {}),
        ...patch,
        updatedAt: now
      };
      return flow;
    }),
    findAutomationFlowById: vi.fn(async () => flow)
  } as unknown as MarketingRepository;

  const automationServices = createAutomationServices(store);
  const service = new MarketingService({
    repo,
    eventPublisher: { publish: vi.fn() },
    jobQueue: { enqueue: vi.fn() },
    aiProvider: {
      generateText: vi.fn(),
      improveDescription: vi.fn(),
      summarize: vi.fn(),
      classify: vi.fn()
    },
    emailProvider: {
      key: 'mock',
      sendEmail: vi.fn()
    },
    ...automationServices
  });

  return {
    service,
    repo,
    ...automationServices
  };
}

function createRuntimeHarness(store: RuntimeStore) {
  const prisma = createRuntimePrisma(store);
  const eventService = new AutomationRunEventService(prisma);
  const workflowExecutor = new AutomationWorkflowExecutor(prisma, {
    stepRunService: createStepRunService(store),
    scheduledStepService: createScheduledStepService(),
    eventService,
    sideEffectService: createSideEffectService(store),
    retryPolicy: {
      maxAttempts: 1
    }
  });
  const runner = new AutomationWorkflowRunnerService(prisma, {
    workflowExecutor,
    eventService
  });
  const dispatcher = new AutomationEventDispatcher(prisma, runner);

  return {
    dispatcher,
    eventService
  };
}

function createCommercialWorkItemCreatedEvent(): DomainEvent {
  return {
    id: 'domain-event-1',
    name: DomainEventNames.CommercialWorkItemCreated,
    aggregateType: 'item',
    aggregateId: 'item-1',
    occurredAt: now,
    payload: {
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      contact: {
        id: 'item-1',
        email: 'contact@example.test',
        score: 42
      },
      apiToken: 'super-secret-token',
      requestedBy: 'user-1'
    }
  };
}

describe('Marketing Journey runtime smoke', () => {
  it('creates, compiles, activates and executes a valid marketing journey runtime', async () => {
    const store = createStore();
    const marketing = createMarketingServiceHarness(store);
    const runtime = createRuntimeHarness(store);

    const flow = await marketing.service.createAutomationFlow({
      workspaceId: store.workspaceId,
      name: 'Welcome commercial journey',
      description: 'Smoke test journey',
      status: 'ACTIVE',
      triggerDefinition: createMarketingJourneyDefinition(),
      actorUserId: 'user-1'
    });

    expect(flow).toMatchObject({ id: 'flow-1', status: 'ACTIVE' });
    expect(store.workflows.get('workflow-1')).toMatchObject({
      status: 'active',
      currentVersionId: 'version-1'
    });
    expect(store.versions.get('version-1')).toMatchObject({
      status: 'published'
    });
    expect(marketing.automationWorkflowVersionService.createDraftVersion).toHaveBeenCalledWith(expect.objectContaining({
      graph: expect.objectContaining({
        version: 1,
        nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'trigger-work-item', type: 'trigger' }),
          expect.objectContaining({ id: 'send-welcome', type: 'communication_send' }),
          expect.objectContaining({ id: 'end', type: 'end' })
        ])
      })
    }));

    await runtime.dispatcher.dispatch(createCommercialWorkItemCreatedEvent());

    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]).toMatchObject({
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      triggerType: DomainEventNames.CommercialWorkItemCreated,
      triggerRefId: 'domain-event-1:trigger-work-item',
      status: 'completed'
    });
    expect(store.stepRuns.map((stepRun) => [stepRun.nodeId, stepRun.nodeType, stepRun.status])).toEqual([
      ['trigger-work-item', 'trigger', 'completed'],
      ['send-welcome', 'communication_send', 'completed'],
      ['end', 'end', 'completed']
    ]);
    expect(store.sideEffects).toHaveLength(1);
    expect(store.sideEffects[0]).toMatchObject({
      sideEffectType: 'communication.email',
      channel: 'email',
      provider: 'mock',
      status: 'queued'
    });
    expect(store.sideEffects[0]?.payloadJson).toMatchObject({
      to: 'contact@example.test',
      templateKey: 'campaign-welcome',
      metadata: expect.objectContaining({
        source: 'marketing_journey',
        nodeId: 'send-welcome'
      })
    });

    const eventTypes = store.events.map((event) => event.eventType);
    expect(eventTypes).toEqual(expect.arrayContaining([
      'run.created',
      'run.started',
      'step.created',
      'step.started',
      'step.completed',
      'run.completed'
    ]));

    const persistedEvents = await runtime.eventService.listEventsForRun({
      workspaceId: store.workspaceId,
      runId: store.runs[0]?.id ?? ''
    });
    expect(persistedEvents).toHaveLength(store.events.length);
    expect(JSON.stringify(store.events)).not.toContain('super-secret-token');
  });

  it('blocks activation for an invalid marketing journey before creating runtime workflow artifacts', async () => {
    const store = createStore();
    const marketing = createMarketingServiceHarness(store);

    await expect(marketing.service.createAutomationFlow({
      workspaceId: store.workspaceId,
      name: 'Invalid journey',
      description: 'Missing action config',
      status: 'ACTIVE',
      triggerDefinition: createMarketingJourneyDefinition({ missingCampaign: true }),
      actorUserId: 'user-1'
    })).rejects.toThrowError(/campaignId/);

    expect(marketing.repo.createAutomationFlow).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFT'
    }));
    expect(marketing.repo.updateAutomationFlow).not.toHaveBeenCalled();
    expect(marketing.automationWorkflowService.createWorkflow).not.toHaveBeenCalled();
    expect(marketing.automationWorkflowVersionService.createDraftVersion).not.toHaveBeenCalled();
    expect(marketing.automationWorkflowVersionService.publishVersion).not.toHaveBeenCalled();
    expect(store.workflows.size).toBe(0);
    expect(store.versions.size).toBe(0);
    expect(store.runs).toHaveLength(0);
  });

  it('does not execute duplicate marketing trigger events for the same runtime trigger', async () => {
    const store = createStore();
    const marketing = createMarketingServiceHarness(store);
    const runtime = createRuntimeHarness(store);

    await marketing.service.createAutomationFlow({
      workspaceId: store.workspaceId,
      name: 'Idempotent journey',
      status: 'ACTIVE',
      triggerDefinition: createMarketingJourneyDefinition(),
      actorUserId: 'user-1'
    });

    const event = createCommercialWorkItemCreatedEvent();
    await runtime.dispatcher.dispatch(event);
    await runtime.dispatcher.dispatch(event);

    expect(store.runs).toHaveLength(1);
  });
});
