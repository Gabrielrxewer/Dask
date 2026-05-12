import { randomUUID } from 'crypto';
import { type Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { env } from '@/core/config/env';
import { redactErrorMessage, redactSensitiveText, redactSensitiveValue } from '@/core/security/redaction';
import { DomainEventNames } from '@/core/events/event-names';
import type { HybridSearchService } from '@/modules/search/application/hybrid-search-service';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { AIAgentRepository } from '@/modules/ai/repositories/ai-agent-repository';
import type { AIAgentData } from '@/modules/ai/repositories/ai-agent-repository';
import {
  compileAiAgentToAutomationWorkflow,
  mergeAiAgentRuntimeConfig
} from '@/modules/ai/model/ai-agent-runtime-compiler';
import type { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';
import { AutomationRunObservabilityService } from '@/modules/automation/application/automation-run-observability-service';
import { AutomationWorkflowService } from '@/modules/automation/application/workflow-service';
import { AutomationWorkflowVersionService } from '@/modules/automation/application/workflow-version-service';

const AI_RUNTIME_TRIGGER_TYPES = [
  'ai.agent.run',
  'ai.agent.item.run',
  'ai.agent.risk_analysis',
  'ai.documentation.run'
] as const;

const AI_RUNTIME_REDACTION_KEY_PATTERN =
  /(system[-_]?prompt|user[-_]?prompt|developer[-_]?prompt|prompt|messages|raw[-_]?payload|payload[-_]?json|request[-_]?payload|response[-_]?payload|request[-_]?body|response[-_]?body)/i;

type RunAgentInput = {
  workspaceId: string;
  itemId: string;
  agentId: string;
  requestedBy: string;
  instruction: string;
  includeSemanticContext: boolean;
  topKContextDocs: number;
  riskStrictMode?: boolean;
};

type RunDocumentationAssistantInput = {
  workspaceId: string;
  requestedBy: string;
  mode: 'chat' | 'write' | 'maintain';
  instruction: string;
  documentTitle?: string;
  documentPath?: string;
  documentContent: string;
  selection?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  includeSemanticContext: boolean;
  topKContextDocs: number;
};

type RuntimeServices = {
  workflowService?: AutomationWorkflowService;
  workflowVersionService?: AutomationWorkflowVersionService;
  workflowRunnerService?: AutomationWorkflowRunnerService;
  runObservabilityService?: AutomationRunObservabilityService;
};

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeAiRuntimeValue<T>(value: T): T {
  return redactSensitiveValue(value, {
    maskPersonalData: true,
    maxStringLength: 2000,
    maxArrayLength: 50,
    maxObjectKeys: 80,
    maxDepth: 8,
    omitKeys: ['stack'],
    additionalSensitiveKeyPattern: AI_RUNTIME_REDACTION_KEY_PATTERN
  });
}

function sanitizeAiRuntimeContext(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return sanitizeAiRuntimeValue(value ?? {}) as Record<string, unknown>;
}

function sanitizeAiInstruction(value: string): string {
  return redactSensitiveText(value, { maskPersonalData: false }).slice(0, 4000);
}

function parseAgentIdFromTriggerRef(value: string | null | undefined): string {
  return typeof value === 'string' && value.includes(':') ? value.split(':')[0] ?? '' : '';
}

function parseItemIdFromTriggerRef(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const [, itemId] = value.split(':');
  return itemId && itemId !== 'documentation' ? itemId : null;
}

function errorMessage(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value) && typeof value.message === 'string') {
    return value.message;
  }
  return null;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function buildSearchTokens(value: string): string[] {
  const tokens = value
    .split(/\s+/)
    .map((entry) => normalizeToken(entry))
    .filter((entry) => entry.length >= 3);

  return Array.from(new Set(tokens)).slice(0, 12);
}

export class AIAgentService {
  private readonly workflowService: AutomationWorkflowService;
  private readonly workflowVersionService: AutomationWorkflowVersionService;
  private readonly workflowRunnerService?: AutomationWorkflowRunnerService;
  private readonly runObservabilityService: AutomationRunObservabilityService;

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly agentRepository: AIAgentRepository,
    _aiProvider: unknown,
    private readonly hybridSearchService: HybridSearchService,
    _authorizationService: unknown,
    private readonly eventPublisher: EventPublisher,
    runtimeServices?: RuntimeServices
  ) {
    this.workflowService = runtimeServices?.workflowService ?? new AutomationWorkflowService(prisma);
    this.workflowVersionService = runtimeServices?.workflowVersionService ?? new AutomationWorkflowVersionService(prisma);
    this.workflowRunnerService = runtimeServices?.workflowRunnerService;
    this.runObservabilityService = runtimeServices?.runObservabilityService ?? new AutomationRunObservabilityService(prisma);
  }

  private async ensureDefaultAgent(workspaceId: string): Promise<void> {
    const exists = await this.agentRepository.existsForWorkspace(workspaceId);
    if (exists) {
      return;
    }

    await this.agentRepository.create({
      workspaceId,
      key: 'risk-analyst',
      name: 'Risk Analyst',
      description: 'Analisa riscos, dependencias e proximos passos.',
      model: env.AI_CHAT_MODEL,
      temperature: 0.2,
      systemPrompt: [
        'You are a senior delivery risk analyst.',
        'Evaluate work-item risk in software/product operations contexts.',
        'Keep response objective and executable for teams.'
      ].join('\n'),
      isActive: true,
      isDefault: true,
      config: {
        tools: {
          enabled: false,
          allowed: [],
          nativeEnabled: false,
          nativeAllowed: [],
          gptEnabled: false,
          gptAllowed: []
        },
        guardrails: { redactSensitive: true, requireJsonOutput: false }
      }
    });
  }

  public async listAgents(input: { workspaceId: string }): Promise<
    Array<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      model: string;
      temperature: number;
      systemPrompt: string;
      config: Prisma.JsonValue;
      isActive: boolean;
      isDefault: boolean;
      updatedAt: Date;
    }>
  > {
    await this.ensureDefaultAgent(input.workspaceId);
    return this.agentRepository.listForWorkspace(input.workspaceId);
  }

  public async createAgent(input: {
    workspaceId: string;
    key: string;
    name: string;
    description?: string;
    model?: string;
    temperature?: number;
    systemPrompt: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
    requestedBy?: string | null;
  }): Promise<{ id: string }> {
    const agent = await this.agentRepository.create({
      workspaceId: input.workspaceId,
      key: input.key,
      name: input.name,
      description: input.description,
      model: input.model ?? env.AI_CHAT_MODEL,
      temperature: input.temperature ?? 0.2,
      systemPrompt: input.systemPrompt,
      config: input.config as Prisma.InputJsonValue | undefined,
      isActive: input.isActive ?? true
    });
    await this.publishAgentEvent({
      name: DomainEventNames.AiAgentCreated,
      workspaceId: input.workspaceId,
      agentId: agent.id,
      requestedBy: input.requestedBy,
      payload: {
        key: input.key,
        name: input.name
      }
    });
    return agent;
  }

  public async updateAgent(input: {
    workspaceId: string;
    agentId: string;
    patch: {
      name?: string;
      description?: string | null;
      model?: string;
      temperature?: number;
      systemPrompt?: string;
      config?: Record<string, unknown>;
      isActive?: boolean;
    };
    requestedBy?: string | null;
  }): Promise<{ id: string }> {
    const result = await this.agentRepository.patch(input.agentId, input.workspaceId, {
      name: input.patch.name,
      description: input.patch.description,
      model: input.patch.model,
      temperature: input.patch.temperature,
      systemPrompt: input.patch.systemPrompt,
      config: input.patch.config as Prisma.InputJsonValue | undefined,
      isActive: input.patch.isActive
    });

    if (result.count === 0) {
      throw new AppError('Agent not found', 404);
    }

    await this.publishAgentEvent({
      name: DomainEventNames.AiAgentUpdated,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      requestedBy: input.requestedBy,
      payload: {
        changedFields: Object.keys(input.patch)
      }
    });

    return { id: input.agentId };
  }

  public async archiveAgent(input: {
    workspaceId: string;
    agentId: string;
    requestedBy?: string | null;
  }): Promise<{ id: string }> {
    const result = await this.agentRepository.patch(input.agentId, input.workspaceId, {
      isActive: false
    });

    if (result.count === 0) {
      throw new AppError('Agent not found', 404);
    }

    await this.publishAgentEvent({
      name: DomainEventNames.AiAgentArchived,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      requestedBy: input.requestedBy
    });

    return { id: input.agentId };
  }

  private async findAgentById(input: { workspaceId: string; agentId: string }): Promise<AIAgentData | null> {
    return this.prisma.aIAgent.findFirst({
      where: {
        id: input.agentId,
        workspaceId: input.workspaceId
      }
    });
  }

  private async requireAgent(input: { workspaceId: string; agentId: string }): Promise<AIAgentData> {
    const agent = await this.findAgentById(input);
    if (!agent) {
      throw new AppError('Agent not found', 404);
    }
    return agent;
  }

  private async publishAgentEvent(input: {
    name: string;
    workspaceId: string;
    agentId: string;
    requestedBy?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.eventPublisher.publish({
      id: randomUUID(),
      name: input.name,
      aggregateType: 'ai-agent',
      aggregateId: input.agentId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        requestedBy: input.requestedBy ?? null,
        ...sanitizeAiRuntimeValue(input.payload ?? {})
      }
    });
  }

  private readRuntimeConfig(config: Prisma.JsonValue | null): Record<string, unknown> {
    const root = asRecord(config);
    const runtime = root.automationRuntime;
    return runtime && typeof runtime === 'object' && !Array.isArray(runtime)
      ? runtime as Record<string, unknown>
      : {};
  }

  private async resolveExistingRuntimeWorkflow(input: {
    workspaceId: string;
    workflowId: unknown;
  }): Promise<{ id: string } | null> {
    if (typeof input.workflowId !== 'string' || input.workflowId.trim().length === 0) {
      return null;
    }

    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: {
        id: input.workflowId,
        workspaceId: input.workspaceId
      },
      select: { id: true }
    });

    return workflow;
  }

  public async validateAgentRuntime(input: {
    workspaceId: string;
    agentId: string;
    requestedBy?: string | null;
    audit?: boolean;
  }): Promise<{
    agentId: string;
    valid: boolean;
    issues: string[];
    definition: ReturnType<typeof compileAiAgentToAutomationWorkflow>['definition'];
  }> {
    const agent = await this.requireAgent(input);
    const compiled = compileAiAgentToAutomationWorkflow(agent);
    const result = {
      agentId: agent.id,
      valid: compiled.issues.length === 0,
      issues: compiled.issues,
      definition: compiled.definition
    };

    if (input.audit !== false) {
      await this.publishAgentEvent({
        name: DomainEventNames.AiAgentValidated,
        workspaceId: input.workspaceId,
        agentId: agent.id,
        requestedBy: input.requestedBy,
        payload: {
          valid: result.valid,
          issueCount: result.issues.length
        }
      });
    }

    return result;
  }

  public async publishAgentRuntime(input: {
    workspaceId: string;
    agentId: string;
    requestedBy: string;
    activateWorkflow?: boolean;
  }): Promise<{
    agentId: string;
    workflowId: string;
    workflowVersionId: string;
    valid: boolean;
    issues: string[];
  }> {
    const agent = await this.requireAgent(input);
    const compiled = compileAiAgentToAutomationWorkflow(agent);
    if (compiled.issues.length > 0) {
      await this.publishAgentEvent({
        name: DomainEventNames.AiAgentValidated,
        workspaceId: input.workspaceId,
        agentId: agent.id,
        requestedBy: input.requestedBy,
        payload: {
          valid: false,
          issueCount: compiled.issues.length,
          issues: compiled.issues
        }
      });
      throw new AppError('AI agent cannot be published with invalid runtime graph.', 422, {
        issues: compiled.issues
      });
    }

    const runtime = this.readRuntimeConfig(agent.config);
    const existingWorkflow = await this.resolveExistingRuntimeWorkflow({
      workspaceId: input.workspaceId,
      workflowId: runtime.workflowId
    });

    const workflow = existingWorkflow
      ? await this.workflowService.updateWorkflow({
          workspaceId: input.workspaceId,
          workflowId: existingWorkflow.id,
          name: `AI Agent: ${agent.name}`,
          description: agent.description
        })
      : await this.workflowService.createWorkflow({
          workspaceId: input.workspaceId,
          name: `AI Agent: ${agent.name}`,
          description: agent.description,
          status: 'draft',
          createdById: input.requestedBy
        });

    const draftVersion = await this.workflowVersionService.createDraftVersion({
      workspaceId: input.workspaceId,
      workflowId: workflow.id,
      definition: compiled.definition,
      graph: compiled.definition.graph
    });

    const publishedVersion = await this.workflowVersionService.publishVersion({
      workspaceId: input.workspaceId,
      workflowId: workflow.id,
      versionId: draftVersion.id,
      publishedById: input.requestedBy,
      activateWorkflow: input.activateWorkflow ?? true
    });

    const publishedAt = (publishedVersion.publishedAt ?? new Date()).toISOString();
    const nextConfig = mergeAiAgentRuntimeConfig({
      config: agent.config,
      runtime: {
        executor: 'automation',
        compilerVersion: 1,
        workflowId: workflow.id,
        workflowVersionId: publishedVersion.id,
        publishedAt,
        validationIssues: [],
        definition: compiled.definition
      }
    });

    await this.agentRepository.patch(agent.id, input.workspaceId, {
      config: nextConfig
    });

    await this.publishAgentEvent({
      name: DomainEventNames.AiAgentPublished,
      workspaceId: input.workspaceId,
      agentId: agent.id,
      requestedBy: input.requestedBy,
      payload: {
        workflowId: workflow.id,
        workflowVersionId: publishedVersion.id,
        publishedAt
      }
    });

    return {
      agentId: agent.id,
      workflowId: workflow.id,
      workflowVersionId: publishedVersion.id,
      valid: true,
      issues: []
    };
  }

  public async runAgentRuntime(input: {
    workspaceId: string;
    agentId: string;
    requestedBy: string;
    instruction?: string;
    context?: Record<string, unknown>;
    triggerType?: (typeof AI_RUNTIME_TRIGGER_TYPES)[number];
    triggerRefId?: string | null;
  }): Promise<{
    agentId: string;
    workflowId: string;
    workflowVersionId: string;
    runId: string;
    status: string;
    executionStatus: string;
    executedNodeIds: string[];
  }> {
    if (!this.workflowRunnerService) {
      throw new AppError('Automation runtime is not configured for AI agent execution.', 503);
    }

    const agent = await this.requireAgent(input);
    if (!agent.isActive) {
      throw new AppError('Inactive AI agents cannot be executed.', 422);
    }

    let runtime = this.readRuntimeConfig(agent.config);
    let workflowId = typeof runtime.workflowId === 'string' ? runtime.workflowId : '';
    if (!workflowId) {
      const published = await this.publishAgentRuntime({
        workspaceId: input.workspaceId,
        agentId: agent.id,
        requestedBy: input.requestedBy,
        activateWorkflow: true
      });
      runtime = {
        ...runtime,
        workflowId: published.workflowId,
        workflowVersionId: published.workflowVersionId
      };
      workflowId = published.workflowId;
    }

    await this.enforceRuntimeRunLimits({
      workspaceId: input.workspaceId,
      agentId: agent.id
    });

    const instruction = sanitizeAiInstruction(
      (input.instruction ?? '').trim() || `Execute AI agent ${agent.name}.`
    );
    const safeContext = sanitizeAiRuntimeContext(input.context);
    const triggerType = input.triggerType ?? 'ai.agent.run';
    const triggerRefId = input.triggerRefId ?? `${agent.id}:${randomUUID()}`;
    const eventPayload = sanitizeAiRuntimeContext({
      ...safeContext,
      instruction,
      agentId: agent.id,
      agentKey: agent.key,
      requestedBy: input.requestedBy
    });

    try {
      const run = await this.workflowRunnerService.startRun({
        workspaceId: input.workspaceId,
        workflowId,
        triggerType,
        triggerRefId,
        context: {
          ...eventPayload,
          event: {
            name: triggerType,
            payload: eventPayload
          }
        }
      });

      await this.publishAgentEvent({
        name: DomainEventNames.AiAgentRunStarted,
        workspaceId: input.workspaceId,
        agentId: agent.id,
        requestedBy: input.requestedBy,
        payload: {
          workflowId,
          workflowVersionId: run.run.workflowVersionId,
          runId: run.run.id,
          executionStatus: run.executionResult.status
        }
      });

      return {
        agentId: agent.id,
        workflowId,
        workflowVersionId: run.run.workflowVersionId,
        runId: run.run.id,
        status: run.run.status,
        executionStatus: run.executionResult.status,
        executedNodeIds: run.executionResult.executedNodeIds
      };
    } catch (error) {
      await this.publishAgentEvent({
        name: DomainEventNames.AiAgentRunFailed,
        workspaceId: input.workspaceId,
        agentId: agent.id,
        requestedBy: input.requestedBy,
        payload: {
          workflowId,
          error: redactErrorMessage(error, 1000)
        }
      });

      throw error;
    }
  }

  private async enforceRuntimeRunLimits(input: {
    workspaceId: string;
    agentId: string;
  }): Promise<void> {
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const [workspaceRuns, agentRuns] = await Promise.all([
      this.prisma.automationRun.count({
        where: {
          workspaceId: input.workspaceId,
          triggerType: { in: [...AI_RUNTIME_TRIGGER_TYPES] },
          createdAt: { gte: oneMinuteAgo }
        }
      }),
      this.prisma.automationRun.count({
        where: {
          workspaceId: input.workspaceId,
          triggerType: { in: [...AI_RUNTIME_TRIGGER_TYPES] },
          triggerRefId: { startsWith: `${input.agentId}:` },
          createdAt: { gte: oneMinuteAgo }
        }
      })
    ]);

    if (workspaceRuns >= env.AI_MAX_REQUESTS_PER_MIN_WORKSPACE) {
      throw new AppError('Workspace AI rate limit exceeded. Try again in a minute.', 429);
    }
    if (agentRuns >= env.AI_MAX_REQUESTS_PER_MIN_AGENT) {
      throw new AppError('Agent AI rate limit exceeded. Try again in a minute.', 429);
    }
  }

  private async buildItemContext(input: {
    workspaceId: string;
    itemId: string;
    includeSemanticContext: boolean;
    topKContextDocs: number;
    redactSensitive: boolean;
    includeLinkedDocuments: boolean;
  }): Promise<{ itemContext: string; semanticContext: string; boardId: string }> {
    const item = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId
      },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 12
        },
        documentLinks: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            document: {
              select: {
                id: true,
                title: true,
                content: true,
                updatedAt: true
              }
            }
          }
        }
      }
    });

    if (!item) {
      throw new AppError('Item not found', 404);
    }

    const redact = (value: string): string => (input.redactSensitive ? redactSensitiveText(value) : value);

    const linkedDocumentsContext = input.includeLinkedDocuments
      ? item.documentLinks
          .map((entry, index) => {
            const snippet = entry.document.content.slice(0, 900);
            return [
              `${index + 1}. ${entry.document.title} (${entry.document.id})`,
              `Updated At: ${entry.document.updatedAt.toISOString()}`,
              snippet.length > 0 ? `Content Snippet:\n${snippet}` : 'Content Snippet: (empty)'
            ].join('\n');
          })
          .join('\n\n')
      : '';

    const itemContext = redact(
      [
        `Item ID: ${item.id}`,
        `Title: ${item.title}`,
        `Description: ${item.description ?? '-'}`,
        `Status: ${item.status}`,
        `Type: ${item.type}`,
        `Fields: ${JSON.stringify(asRecord(item.fields))}`,
        `Metadata: ${JSON.stringify(asRecord(item.metadata))}`,
        `Checklist: ${JSON.stringify(asRecord(item.checklist))}`,
        `Linked Documents: ${input.includeLinkedDocuments ? item.documentLinks.length : 0}`,
        input.includeLinkedDocuments && linkedDocumentsContext.length > 0
          ? `Linked Document Context:\n${linkedDocumentsContext}`
          : '',
        `Updated At: ${item.updatedAt.toISOString()}`,
        'Recent History:',
        ...item.history.map((entry) => `- ${entry.createdAt.toISOString()} | ${entry.eventName}`)
      ].join('\n')
    );

    if (!input.includeSemanticContext) {
      return { itemContext, semanticContext: '', boardId: item.boardId };
    }

    const relatedDocs = await this.hybridSearchService.search({
      query: [
        item.title,
        item.description ?? '',
        ...(input.includeLinkedDocuments ? item.documentLinks.map((entry) => entry.document.title) : []),
        ...(input.includeLinkedDocuments ? item.documentLinks.map((entry) => entry.document.content.slice(0, 900)) : [])
      ]
        .filter((value) => value.trim().length > 0)
        .join('\n')
        .trim(),
      filters: {
        workspaceId: input.workspaceId,
        boardId: item.boardId
      },
      limit: input.topKContextDocs
    });

    const semanticContext = redact(
      relatedDocs
        .filter((doc) => doc.itemId !== item.id)
        .map(
          (doc, index) =>
            `${index + 1}. itemId=${doc.itemId} score=${doc.score.toFixed(4)}\n${doc.content.slice(0, 700)}`
        )
        .join('\n\n')
    );

    return { itemContext, semanticContext, boardId: item.boardId };
  }

  private async buildDocumentationContext(input: {
    workspaceId: string;
    query: string;
    topKContextDocs: number;
    redactSensitive: boolean;
  }): Promise<string> {
    const docs = await this.prisma.workspaceDocument.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true
      }
    });

    if (docs.length === 0) {
      return '';
    }

    const tokens = buildSearchTokens(input.query);
    const rankedDocs = docs
      .map((doc) => {
        if (tokens.length === 0) {
          return { doc, score: 1 };
        }

        const title = normalizeToken(doc.title);
        const content = normalizeToken(doc.content.slice(0, 6000));
        let score = 0;

        for (const token of tokens) {
          if (title.includes(token)) {
            score += 3;
          }
          if (content.includes(token)) {
            score += 1;
          }
        }

        return { doc, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.doc.updatedAt.getTime() - left.doc.updatedAt.getTime();
      })
      .slice(0, input.topKContextDocs);

    if (rankedDocs.length === 0) {
      return '';
    }

    const redact = (value: string): string => (input.redactSensitive ? redactSensitiveText(value) : value);

    return rankedDocs
      .map((entry, index) => {
        const snippet = entry.doc.content.slice(0, 900);
        return redact(
          [
            `${index + 1}. ${entry.doc.title} (${entry.doc.id})`,
            `Updated At: ${entry.doc.updatedAt.toISOString()}`,
            snippet.length > 0 ? `Content Snippet:\n${snippet}` : 'Content Snippet: (empty)'
          ].join('\n')
        );
      })
      .join('\n\n');
  }

  private async readRuntimeRunContent(input: {
    workspaceId: string;
    runId: string;
  }): Promise<string> {
    const steps = await this.prisma.automationStepRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        status: 'completed'
      },
      select: {
        nodeType: true,
        outputJson: true,
        finishedAt: true,
        createdAt: true
      },
      orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10
    });

    for (const step of steps) {
      const output = asRecord(step.outputJson);
      for (const key of ['content', 'response', 'draftText', 'summary']) {
        const value = output[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
      }
    }

    return '';
  }
  public async runAgentOnItem(input: RunAgentInput): Promise<{ runId: string; content: string }> {
    const run = await this.runAgentRuntime({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      requestedBy: input.requestedBy,
      instruction: input.instruction,
      triggerType: input.riskStrictMode ? 'ai.agent.risk_analysis' : 'ai.agent.item.run',
      triggerRefId: `${input.agentId}:${input.itemId}:${randomUUID()}`,
      context: {
        itemId: input.itemId,
        includeSemanticContext: input.includeSemanticContext,
        topKContextDocs: input.topKContextDocs,
        riskStrictMode: input.riskStrictMode === true
      }
    });

    return {
      runId: run.runId,
      content: await this.readRuntimeRunContent({
        workspaceId: input.workspaceId,
        runId: run.runId
      })
    };
  }
  public async runDocumentationAssistant(
    input: RunDocumentationAssistantInput
  ): Promise<{
    runId: string;
    content: string;
    action: 'chat' | 'replace_document' | 'append_document';
    updatedDocument: string | null;
  }> {
    await this.ensureDefaultAgent(input.workspaceId);
    const agent = await this.agentRepository.findTopActive(input.workspaceId);

    if (!agent) {
      throw new AppError('No active AI agent configured for this workspace', 400);
    }

    const run = await this.runAgentRuntime({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      requestedBy: input.requestedBy,
      instruction: input.instruction,
      triggerType: 'ai.documentation.run',
      triggerRefId: `${agent.id}:documentation:${randomUUID()}`,
      context: {
        documentationAssistant: true,
        mode: input.mode,
        documentTitle: input.documentTitle,
        documentPath: input.documentPath,
        documentContent: input.documentContent,
        selection: input.selection,
        conversationHistory: input.conversationHistory ?? [],
        includeSemanticContext: input.includeSemanticContext,
        topKContextDocs: input.topKContextDocs
      }
    });

    return {
      runId: run.runId,
      content: await this.readRuntimeRunContent({
        workspaceId: input.workspaceId,
        runId: run.runId
      }),
      action: 'chat',
      updatedDocument: null
    };
  }
  public async runRiskAnalysis(input: {
    workspaceId: string;
    itemId: string;
    requestedBy: string;
    includeSemanticContext: boolean;
    topKContextDocs: number;
  }): Promise<{ runId: string; content: string }> {
    const defaultAgent = await this.agentRepository.findTopActive(input.workspaceId);

    if (!defaultAgent) {
      throw new AppError('No active AI agent configured for this workspace', 400);
    }

    return this.runAgentOnItem({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      agentId: defaultAgent.id,
      requestedBy: input.requestedBy,
      includeSemanticContext: input.includeSemanticContext,
      topKContextDocs: input.topKContextDocs,
      riskStrictMode: true,
      instruction: [
        'Return ONLY valid JSON following this exact schema:',
        '{',
        '  "summary": "string",',
        '  "confidence": number between 0 and 1,',
        '  "blockers": ["string"],',
        '  "dependencies": ["string"],',
        '  "risks": [{ "title":"string", "impact":"low|medium|high|critical", "likelihood":"low|medium|high", "mitigation":"string" }],',
        '  "nextActions": ["string"]',
        '}',
        'Analyze the card and produce an objective risk analysis.'
      ].join('\n')
    });
  }

  public async getItemContext(input: {
    workspaceId: string;
    itemId: string;
    includeSemanticContext: boolean;
    topKContextDocs: number;
  }): Promise<{ itemContext: string; semanticContext: string }> {
    const context = await this.buildItemContext({
      ...input,
      redactSensitive: true,
      includeLinkedDocuments: true
    });
    return { itemContext: context.itemContext, semanticContext: context.semanticContext };
  }

  public async listRuns(input: {
    workspaceId: string;
    itemId?: string;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      agentId: string;
      itemId: string | null;
      status: string;
      provider: string | null;
      model: string | null;
      latencyMs: number | null;
      totalTokens: number | null;
      estimatedCostUsd: number | null;
      createdAt: Date;
      finishedAt: Date | null;
      error: string | null;
    }>
  > {
    const result = await this.runObservabilityService.listRuns({
      workspaceId: input.workspaceId,
      triggerTypes: [...AI_RUNTIME_TRIGGER_TYPES],
      triggerRefIdContains: input.itemId ? `:${input.itemId}:` : undefined,
      limit: input.limit
    });

    return result.items.map((run) => ({
      id: run.runId,
      agentId: parseAgentIdFromTriggerRef(run.triggerRefId) || 'automation-runtime',
      itemId: parseItemIdFromTriggerRef(run.triggerRefId),
      status: run.status,
      provider: 'automation-runtime',
      model: null,
      latencyMs: run.durationMs,
      totalTokens: null,
      estimatedCostUsd: null,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
      error: errorMessage(run.error)
    }));
  }

  public async getObservability(input: { workspaceId: string }): Promise<{
    totals: {
      runs24h: number;
      failed24h: number;
      failureRate24h: number;
      avgLatencyMs24h: number;
      tokens24h: number;
      estimatedCostUsd24h: number;
    };
    byProvider: Array<{
      provider: string;
      runs24h: number;
      failed24h: number;
      avgLatencyMs24h: number;
      tokens24h: number;
      estimatedCostUsd24h: number;
    }>;
  }> {
    const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.runObservabilityService.listRuns({
      workspaceId: input.workspaceId,
      triggerTypes: [...AI_RUNTIME_TRIGGER_TYPES],
      dateFrom: start,
      limit: 500
    });

    const rows = result.items;
    const runs24h = rows.length;
    const failed24h = rows.filter((row) => row.status === 'failed').length;
    const avgLatencyMs24h = runs24h > 0
      ? Math.round(rows.reduce((sum, row) => sum + (row.durationMs ?? 0), 0) / runs24h)
      : 0;
    const summary = {
      provider: 'automation-runtime',
      runs24h,
      failed24h,
      avgLatencyMs24h,
      tokens24h: 0,
      estimatedCostUsd24h: 0
    };

    return {
      totals: {
        runs24h,
        failed24h,
        failureRate24h: runs24h > 0 ? Number((failed24h / runs24h).toFixed(4)) : 0,
        avgLatencyMs24h,
        tokens24h: 0,
        estimatedCostUsd24h: 0
      },
      byProvider: runs24h > 0 ? [summary] : []
    };
  }
}
