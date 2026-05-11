import { z } from 'zod';
import { randomUUID } from 'crypto';
import { type Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { env } from '@/core/config/env';
import { DomainEventNames } from '@/core/events/event-names';
import type { AIProvider, AIToolDefinition } from '@/modules/ai/domain/providers';
import type { HybridSearchService } from '@/modules/search/application/hybrid-search-service';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { AIAgentRepository } from '@/modules/ai/repositories/ai-agent-repository';
import type { AIAgentData } from '@/modules/ai/repositories/ai-agent-repository';
import {
  compileAiAgentToAutomationWorkflow,
  mergeAiAgentRuntimeConfig
} from '@/modules/ai/model/ai-agent-runtime-compiler';
import type { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';
import { AutomationWorkflowService } from '@/modules/automation/application/workflow-service';
import { AutomationWorkflowVersionService } from '@/modules/automation/application/workflow-version-service';
import {
  ensureRiskAnalysisOutput,
  formatRiskAnalysisAsText,
  parseJsonObject,
  redactSensitiveText
} from '@/modules/ai/application/ai-guardrails';
import { AIToolExecutor } from '@/modules/ai/application/ai-tool-executor';

// ─── Max error length stored in the database ───────────────────────────────
const RUN_ERROR_MAX_LENGTH = 1900;

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
};

const documentationAssistantOutputSchema = z.object({
  response: z.string().min(1).max(20_000),
  action: z.enum(['chat', 'replace_document', 'append_document']).default('chat'),
  updatedDocument: z.string().max(180_000).nullable().optional()
});

// ─── Agent config schema (validated, not cast) ─────────────────────────────
const agentConfigSchema = z
  .object({
    limits: z
      .object({
        maxRequestsPerMinute: z.number().int().positive().optional(),
        maxTokensPerDay: z.number().int().positive().optional()
      })
      .optional(),
    tools: z
      .object({
        enabled: z.boolean().optional(),
        allowed: z.array(z.string()).optional(),
        nativeEnabled: z.boolean().optional(),
        nativeAllowed: z.array(z.string()).optional(),
        gptEnabled: z.boolean().optional(),
        gptAllowed: z.array(z.string()).optional()
      })
      .optional(),
    guardrails: z
      .object({
        redactSensitive: z.boolean().optional(),
        requireJsonOutput: z.boolean().optional()
      })
      .optional(),
    rag: z
      .object({
        enabled: z.boolean().optional(),
        source: z.enum(['none', 'documentation', 'card', 'card_and_documentation']).optional(),
        contextInstruction: z.string().max(2000).optional(),
        includeSemanticContext: z.boolean().optional(),
        includeLinkedDocuments: z.boolean().optional(),
        topKContextDocs: z.number().int().min(1).max(10).optional()
      })
      .optional()
  })
  .passthrough();

type AgentConfig = z.infer<typeof agentConfigSchema>;
type AgentRagSource = 'none' | 'documentation' | 'card' | 'card_and_documentation';
type AgentNativeTool = 'update_item_description' | 'set_item_status' | 'set_item_priority';
type AgentGPTTool = 'web_search';
type AgentRagResolved = {
  source: AgentRagSource;
  useCardContext: boolean;
  useDocumentationContext: boolean;
  includeSemanticContext: boolean;
  includeLinkedDocuments: boolean;
  topKContextDocs: number;
  contextInstruction: string;
};

const agentNativeTools = new Set<AgentNativeTool>([
  'update_item_description',
  'set_item_status',
  'set_item_priority'
]);

const agentGPTTools = new Set<AgentGPTTool>(['web_search']);

function parseAgentConfig(value: Prisma.JsonValue | null): AgentConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result = agentConfigSchema.safeParse(value);
  if (!result.success) {
    // Unknown/malformed config — fall back to safe defaults instead of crashing
    return {};
  }
  return result.data;
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function estimateTokensFromText(value: string): number {
  return Math.ceil(value.length / 4);
}

function floorToUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
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

function clampTopK(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(Math.max(Math.round(value), 1), 10);
}

function resolveRagSource(rawSource: unknown): AgentRagSource {
  return rawSource === 'none' ||
    rawSource === 'documentation' ||
    rawSource === 'card' ||
    rawSource === 'card_and_documentation'
    ? rawSource
    : 'card_and_documentation';
}

function resolveAgentRagConfig(input: {
  config: AgentConfig;
  includeSemanticContext: boolean;
  topKContextDocs: number;
}): AgentRagResolved {
  const rag = input.config.rag;
  const source =
    rag?.enabled === false
      ? 'none'
      : resolveRagSource(rag?.source);

  const useCardContext = source === 'card' || source === 'card_and_documentation';
  const useDocumentationContext = source === 'documentation' || source === 'card_and_documentation';
  const includeSemanticContext = useCardContext && rag?.includeSemanticContext !== false && input.includeSemanticContext;

  return {
    source,
    useCardContext,
    useDocumentationContext,
    includeSemanticContext,
    includeLinkedDocuments: rag?.includeLinkedDocuments !== false,
    topKContextDocs: clampTopK(rag?.topKContextDocs ?? input.topKContextDocs),
    contextInstruction: (rag?.contextInstruction ?? '').trim().slice(0, 1800)
  };
}

function normalizeNativeToolList(value: unknown): AgentNativeTool[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<AgentNativeTool>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    if (agentNativeTools.has(entry as AgentNativeTool)) {
      unique.add(entry as AgentNativeTool);
    }
  }

  return Array.from(unique);
}

function normalizeGptToolList(value: unknown): AgentGPTTool[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<AgentGPTTool>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    if (agentGPTTools.has(entry as AgentGPTTool)) {
      unique.add(entry as AgentGPTTool);
    }
  }

  return Array.from(unique);
}

function resolveAgentTools(config: AgentConfig): {
  nativeEnabled: boolean;
  nativeAllowed: AgentNativeTool[];
  gptEnabled: boolean;
  gptAllowed: AgentGPTTool[];
} {
  const tools = config.tools;
  const nativeAllowed = normalizeNativeToolList(tools?.nativeAllowed ?? tools?.allowed);
  const nativeEnabled = (tools?.nativeEnabled ?? tools?.enabled ?? false) === true && nativeAllowed.length > 0;
  const gptAllowed = normalizeGptToolList(tools?.gptAllowed);
  const gptEnabled = tools?.gptEnabled === true && gptAllowed.length > 0;

  return {
    nativeEnabled,
    nativeAllowed,
    gptEnabled,
    gptAllowed
  };
}

function buildDocumentationModeGuidance(mode: RunDocumentationAssistantInput['mode']): string {
  if (mode === 'write') {
    return [
      '- Write clear and structured technical documentation in markdown.',
      '- Prefer sections, short paragraphs, and practical examples.',
      '- Keep terminology consistent with the existing content.'
    ].join('\n');
  }

  if (mode === 'maintain') {
    return [
      '- Review and improve the existing document for clarity, consistency and freshness.',
      '- Highlight outdated or contradictory sections and provide corrected content.',
      '- Preserve intent and avoid unnecessary rewrites.'
    ].join('\n');
  }

  return [
    '- Answer questions about the document objectively and directly.',
    '- Reference the current document content when possible.',
    '- If information is missing, state assumptions explicitly.'
  ].join('\n');
}

function shouldAttachConversationContext(input: {
  mode: RunDocumentationAssistantInput['mode'];
  instruction: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}): boolean {
  if (input.conversationHistory.length === 0) {
    return false;
  }

  if (input.mode === 'chat') {
    return true;
  }

  const normalized = input.instruction.toLowerCase();
  return /(continue|continua|como falamos|como voce disse|mesmo estilo|anterior|acima|contexto da conversa|retomar)/.test(
    normalized
  );
}

function shouldAttachSemanticContext(input: {
  mode: RunDocumentationAssistantInput['mode'];
  instruction: string;
}): boolean {
  if (input.mode === 'chat') {
    return true;
  }

  const normalized = input.instruction.toLowerCase();
  return /(workspace|time|equipe|backlog|sprint|ticket|task|tarefa|roadmap|produto|contexto)/.test(normalized);
}

export class AIAgentService {
  private readonly toolExecutor: AIToolExecutor;
  private readonly workflowService: AutomationWorkflowService;
  private readonly workflowVersionService: AutomationWorkflowVersionService;
  private readonly workflowRunnerService?: AutomationWorkflowRunnerService;

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly agentRepository: AIAgentRepository,
    private readonly aiProvider: AIProvider,
    private readonly hybridSearchService: HybridSearchService,
    private readonly authorizationService: AuthorizationService,
    private readonly eventPublisher: EventPublisher,
    runtimeServices?: RuntimeServices
  ) {
    this.toolExecutor = new AIToolExecutor(prisma, authorizationService, eventPublisher);
    this.workflowService = runtimeServices?.workflowService ?? new AutomationWorkflowService(prisma);
    this.workflowVersionService = runtimeServices?.workflowVersionService ?? new AutomationWorkflowVersionService(prisma);
    this.workflowRunnerService = runtimeServices?.workflowRunnerService;
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
        ...(input.payload ?? {})
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

    const runtime = this.readRuntimeConfig(agent.config);
    const workflowId = typeof runtime.workflowId === 'string' ? runtime.workflowId : '';
    if (!workflowId) {
      throw new AppError('AI agent must be published before it can run on Automation Runtime.', 422);
    }

    const instruction = (input.instruction ?? '').trim() || `Execute AI agent ${agent.name}.`;

    try {
      const run = await this.workflowRunnerService.startRun({
        workspaceId: input.workspaceId,
        workflowId,
        triggerType: 'ai.agent.run',
        triggerRefId: `${agent.id}:${randomUUID()}`,
        context: {
          ...(input.context ?? {}),
          instruction,
          agentId: agent.id,
          agentKey: agent.key,
          requestedBy: input.requestedBy,
          event: {
            name: 'ai.agent.run',
            payload: {
              ...(input.context ?? {}),
              instruction,
              agentId: agent.id,
              agentKey: agent.key,
              requestedBy: input.requestedBy
            }
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
          error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000)
        }
      });

      throw error;
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

  private async enforceRunLimits(input: {
    workspaceId: string;
    agentId: string;
    estimatedTokens: number;
    config: AgentConfig;
  }): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000);
    const dayStart = floorToUtcDay(now);

    const [workspaceRpm, agentRpm, workspaceDay] = await Promise.all([
      this.prisma.aIAgentRun.count({
        where: {
          workspaceId: input.workspaceId,
          createdAt: { gte: oneMinuteAgo }
        }
      }),
      this.prisma.aIAgentRun.count({
        where: {
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          createdAt: { gte: oneMinuteAgo }
        }
      }),
      this.prisma.aIAgentRun.aggregate({
        where: {
          workspaceId: input.workspaceId,
          createdAt: { gte: dayStart }
        },
        _sum: { totalTokens: true }
      })
    ]);

    const maxWorkspaceRpm = input.config.limits?.maxRequestsPerMinute ?? env.AI_MAX_REQUESTS_PER_MIN_WORKSPACE;
    const maxAgentRpm = input.config.limits?.maxRequestsPerMinute ?? env.AI_MAX_REQUESTS_PER_MIN_AGENT;
    const maxWorkspaceDailyTokens =
      input.config.limits?.maxTokensPerDay ?? env.AI_MAX_TOKENS_PER_DAY_WORKSPACE;
    const maxAgentDailyTokens = input.config.limits?.maxTokensPerDay ?? env.AI_MAX_TOKENS_PER_DAY_AGENT;

    if (workspaceRpm >= maxWorkspaceRpm) {
      throw new AppError('Workspace AI rate limit exceeded. Try again in a minute.', 429);
    }
    if (agentRpm >= maxAgentRpm) {
      throw new AppError('Agent AI rate limit exceeded. Try again in a minute.', 429);
    }

    const workspaceUsedTokens = workspaceDay._sum.totalTokens ?? 0;
    if (workspaceUsedTokens + input.estimatedTokens > maxWorkspaceDailyTokens) {
      throw new AppError('Workspace daily AI token budget exceeded.', 429);
    }

    const agentDay = await this.prisma.aIAgentRun.aggregate({
      where: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        createdAt: { gte: dayStart }
      },
      _sum: { totalTokens: true }
    });
    const agentUsedTokens = agentDay._sum.totalTokens ?? 0;
    if (agentUsedTokens + input.estimatedTokens > maxAgentDailyTokens) {
      throw new AppError('Agent daily AI token budget exceeded.', 429);
    }
  }

  private buildToolDefinitions(allowedTools: AgentNativeTool[]): AIToolDefinition[] {
    const tools: AIToolDefinition[] = [];
    if (allowedTools.includes('update_item_description')) {
      tools.push({
        name: 'update_item_description',
        description: 'Update item description with a cleaner actionable text.',
        inputSchema: {
          type: 'object',
          properties: { description: { type: 'string' } },
          required: ['description'],
          additionalProperties: false
        }
      });
    }
    if (allowedTools.includes('set_item_status')) {
      tools.push({
        name: 'set_item_status',
        description: 'Set item status slug.',
        inputSchema: {
          type: 'object',
          properties: { status: { type: 'string' } },
          required: ['status'],
          additionalProperties: false
        }
      });
    }
    if (allowedTools.includes('set_item_priority')) {
      tools.push({
        name: 'set_item_priority',
        description: 'Set item numeric priority from 0 to 4.',
        inputSchema: {
          type: 'object',
          properties: { priority: { type: 'number' } },
          required: ['priority'],
          additionalProperties: false
        }
      });
    }
    return tools;
  }

  public async runAgentOnItem(input: RunAgentInput): Promise<{ runId: string; content: string }> {
    const agent = await this.agentRepository.findActiveById(input.agentId, input.workspaceId);

    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    const config = parseAgentConfig(agent.config);
    const ragConfig = resolveAgentRagConfig({
      config,
      includeSemanticContext: input.includeSemanticContext,
      topKContextDocs: input.topKContextDocs
    });
    const resolvedTools = resolveAgentTools(config);

    // ── Fix: authorize write access before any I/O when tools may mutate the item ──
    if (resolvedTools.nativeEnabled) {
      const canWrite = await this.authorizationService.can(input.requestedBy, 'item.write', {
        workspaceId: input.workspaceId,
        itemId: input.itemId
      });
      if (!canWrite) {
        throw new AppError('User is not allowed to execute AI tools for item mutations.', 403);
      }
    }

    const redactSensitive = config.guardrails?.redactSensitive !== false;

    const context = await this.buildItemContext({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      includeSemanticContext: ragConfig.useCardContext && ragConfig.includeSemanticContext,
      topKContextDocs: ragConfig.topKContextDocs,
      redactSensitive,
      includeLinkedDocuments: ragConfig.includeLinkedDocuments
    });

    const instruction = redactSensitive ? redactSensitiveText(input.instruction) : input.instruction;
    let documentationContext = '';
    if (ragConfig.useDocumentationContext) {
      documentationContext = await this.buildDocumentationContext({
        workspaceId: input.workspaceId,
        query: [instruction, context.itemContext].join('\n').slice(0, 8000),
        topKContextDocs: ragConfig.topKContextDocs,
        redactSensitive
      });
    }

    const promptBody = [
      `Instruction:\n${instruction}`,
      ragConfig.contextInstruction.length > 0 ? `Context Guidance:\n${ragConfig.contextInstruction}` : '',
      ragConfig.useCardContext ? `Card Context:\n${context.itemContext}` : '',
      ragConfig.useCardContext && context.semanticContext.length > 0
        ? `Card Semantic Context:\n${context.semanticContext}`
        : '',
      ragConfig.useDocumentationContext && documentationContext.length > 0
        ? `Documentation Context:\n${documentationContext}`
        : '',
      !ragConfig.useCardContext && !ragConfig.useDocumentationContext
        ? 'RAG Context: disabled for this agent configuration.'
        : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.enforceRunLimits({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      estimatedTokens: estimateTokensFromText(agent.systemPrompt + promptBody),
      config
    });

    const run = await this.prisma.aIAgentRun.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: agent.id,
        itemId: input.itemId,
        requestedBy: input.requestedBy,
        status: 'running',
        input: {
          instruction,
          includeSemanticContext: ragConfig.includeSemanticContext,
          topKContextDocs: ragConfig.topKContextDocs,
          ragSource: ragConfig.source,
          nativeTools: resolvedTools.nativeEnabled ? resolvedTools.nativeAllowed : [],
          gptTools: resolvedTools.gptEnabled ? resolvedTools.gptAllowed : []
        },
        startedAt: new Date()
      }
    });

    try {
      const allowedNativeTools = resolvedTools.nativeEnabled ? resolvedTools.nativeAllowed : [];

      const toolDefinitions = this.buildToolDefinitions(allowedNativeTools);
      const generation = await this.aiProvider.generateText({
        model: agent.model,
        temperature: agent.temperature,
        systemPrompt: [
          agent.systemPrompt,
          '',
          'You are integrated in a work management platform. Respond with practical and concise output.'
        ].join('\n'),
        userPrompt: promptBody,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        nativeTools: resolvedTools.gptEnabled ? resolvedTools.gptAllowed : undefined,
        requireJsonOutput: Boolean(config.guardrails?.requireJsonOutput)
      });

      const toolExecutionSummary = await this.toolExecutor.execute({
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        boardId: context.boardId,
        requestedBy: input.requestedBy,
        toolCalls: generation.toolCalls,
        allowedTools: allowedNativeTools
      });

      let finalContent = generation.content;
      if (input.riskStrictMode) {
        const risk = ensureRiskAnalysisOutput(generation.content);
        finalContent = formatRiskAnalysisAsText(risk);
      } else if (config.guardrails?.requireJsonOutput) {
        const parsed = parseJsonObject(generation.content);
        if (!parsed) {
          throw new AppError('Agent output must be valid JSON object due to guardrails.', 422);
        }
      }

      if (toolExecutionSummary.length > 0) {
        finalContent = [finalContent, '', 'Acoes executadas:', ...toolExecutionSummary.map((entry) => `- ${entry}`)].join('\n');
      }

      const estimatedCostUsd = Number(((generation.usage.totalTokens / 1_000_000) * 0.8).toFixed(6));

      await this.prisma.aIAgentRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          output: {
            content: finalContent,
            toolCalls: generation.toolCalls,
            toolExecutionSummary
          } as Prisma.InputJsonValue,
          provider: generation.provider,
          model: generation.model,
          latencyMs: generation.latencyMs,
          inputTokens: generation.usage.inputTokens,
          outputTokens: generation.usage.outputTokens,
          totalTokens: generation.usage.totalTokens,
          estimatedCostUsd,
          finishedAt: new Date()
        }
      });

      return {
        runId: run.id,
        content: finalContent
      };
    } catch (error) {
      await this.prisma.aIAgentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error:
            error instanceof Error
              ? error.message.slice(0, RUN_ERROR_MAX_LENGTH)
              : String(error).slice(0, RUN_ERROR_MAX_LENGTH),
          finishedAt: new Date()
        }
      });
      throw error;
    }
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

    const config = parseAgentConfig(agent.config);
    const ragConfig = resolveAgentRagConfig({
      config,
      includeSemanticContext: input.includeSemanticContext,
      topKContextDocs: input.topKContextDocs
    });
    const resolvedTools = resolveAgentTools(config);
    const redactSensitive = config.guardrails?.redactSensitive !== false;
    const redact = (value: string): string => (redactSensitive ? redactSensitiveText(value) : value);

    const documentTitle = redact((input.documentTitle ?? '').trim());
    const documentPath = redact((input.documentPath ?? '').trim());
    const instruction = redact(input.instruction);
    const selection = input.selection ? redact(input.selection) : '';
    const documentContent = redact(input.documentContent);
    const currentDocumentForPrompt = ragConfig.useDocumentationContext
      ? documentContent || '(empty document)'
      : '(documentation source disabled by this agent configuration)';
    const modeGuidance = buildDocumentationModeGuidance(input.mode);
    const sanitizedConversationHistory = (input.conversationHistory ?? [])
      .slice(-10)
      .map((entry) => ({
        role: entry.role,
        content: redact(entry.content).slice(0, 1800)
      }));
    const includeConversationContext = shouldAttachConversationContext({
      mode: input.mode,
      instruction,
      conversationHistory: sanitizedConversationHistory
    });
    const conversationContext = includeConversationContext
      ? sanitizedConversationHistory
          .map((entry, index) => `${index + 1}. ${entry.role.toUpperCase()}: ${entry.content}`)
          .join('\n')
      : '';
    const includeSemanticContext =
      ragConfig.useCardContext &&
      ragConfig.includeSemanticContext &&
      documentContent.trim().length > 0 &&
      shouldAttachSemanticContext({
        mode: input.mode,
        instruction
      });

    let semanticContext = '';
    if (includeSemanticContext) {
      const query = [documentTitle, instruction, documentContent.slice(0, 3000)]
        .filter(Boolean)
        .join('\n');

      const relatedDocs = await this.hybridSearchService.search({
        query,
        filters: { workspaceId: input.workspaceId },
        limit: ragConfig.topKContextDocs
      });

      semanticContext = redact(
        relatedDocs
          .map(
            (doc, index) =>
              `${index + 1}. itemId=${doc.itemId} score=${doc.score.toFixed(4)}\n${doc.content.slice(0, 600)}`
          )
          .join('\n\n')
      );
    }

    let relatedDocumentationContext = '';
    if (ragConfig.useDocumentationContext) {
      relatedDocumentationContext = await this.buildDocumentationContext({
        workspaceId: input.workspaceId,
        query: [documentTitle, documentPath, instruction, documentContent.slice(0, 3000)]
          .filter(Boolean)
          .join('\n'),
        topKContextDocs: ragConfig.topKContextDocs,
        redactSensitive
      });
    }

    const promptBody = [
      `Mode: ${input.mode}`,
      documentTitle ? `Document title: ${documentTitle}` : '',
      documentPath ? `Document path: ${documentPath}` : '',
      `Instruction:\n${instruction}`,
      ragConfig.contextInstruction.length > 0 ? `Context Guidance:\n${ragConfig.contextInstruction}` : '',
      selection && ragConfig.useDocumentationContext ? `Current selection:\n${selection}` : '',
      `Current document:\n${currentDocumentForPrompt}`,
      relatedDocumentationContext ? `Related documentation context:\n${relatedDocumentationContext}` : '',
      conversationContext ? `Recent conversation context:\n${conversationContext}` : '',
      semanticContext ? `Related workspace context:\n${semanticContext}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.enforceRunLimits({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      estimatedTokens: estimateTokensFromText(agent.systemPrompt + promptBody),
      config
    });

    const run = await this.prisma.aIAgentRun.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: agent.id,
        itemId: null,
        requestedBy: input.requestedBy,
        status: 'running',
        input: {
          type: 'documentation_assistant',
          mode: input.mode,
          instruction,
          documentTitle,
          documentPath,
          selection,
          conversationHistory: includeConversationContext ? sanitizedConversationHistory : [],
          includeSemanticContext,
          topKContextDocs: ragConfig.topKContextDocs,
          ragSource: ragConfig.source,
          gptTools: resolvedTools.gptEnabled ? resolvedTools.gptAllowed : []
        },
        startedAt: new Date()
      }
    });

    try {
      const generation = await this.aiProvider.generateText({
        model: agent.model,
        temperature: agent.temperature,
        systemPrompt: [
          agent.systemPrompt,
          '',
          'You are a documentation copilot integrated in a work management platform.',
          'You must always return a JSON object with the exact keys: response, action, updatedDocument.',
          'action options:',
          '- "chat": only answer/explain. updatedDocument must be null.',
          '- "replace_document": user asked to rewrite/edit/update existing content. updatedDocument must contain the full final document.',
          '- "append_document": user asked to add a new section/snippet. updatedDocument must contain only the new snippet to append.',
          'When user asks to reescrever, revisar, atualizar, corrigir, editar or melhorar documentation content, prefer "replace_document".',
          'Keep response concise and practical.',
          '',
          `Mode guidance:\n${modeGuidance}`
        ].join('\n'),
        userPrompt: promptBody,
        nativeTools: resolvedTools.gptEnabled ? resolvedTools.gptAllowed : undefined,
        requireJsonOutput: true
      });

      const parsed = documentationAssistantOutputSchema.safeParse(parseJsonObject(generation.content));
      const structuredOutput = parsed.success
        ? parsed.data
        : {
            response: generation.content,
            action: 'chat' as const,
            updatedDocument: null
          };

      const estimatedCostUsd = Number(((generation.usage.totalTokens / 1_000_000) * 0.8).toFixed(6));

      await this.prisma.aIAgentRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          output: {
            type: 'documentation_assistant',
            mode: input.mode,
            content: structuredOutput.response,
            action: structuredOutput.action,
            updatedDocument: structuredOutput.updatedDocument ?? null
          } as Prisma.InputJsonValue,
          provider: generation.provider,
          model: generation.model,
          latencyMs: generation.latencyMs,
          inputTokens: generation.usage.inputTokens,
          outputTokens: generation.usage.outputTokens,
          totalTokens: generation.usage.totalTokens,
          estimatedCostUsd,
          finishedAt: new Date()
        }
      });

      return {
        runId: run.id,
        content: structuredOutput.response,
        action: structuredOutput.action,
        updatedDocument: structuredOutput.updatedDocument ?? null
      };
    } catch (error) {
      await this.prisma.aIAgentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error:
            error instanceof Error
              ? error.message.slice(0, RUN_ERROR_MAX_LENGTH)
              : String(error).slice(0, RUN_ERROR_MAX_LENGTH),
          finishedAt: new Date()
        }
      });
      throw error;
    }
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
    return this.prisma.aIAgentRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        itemId: input.itemId
      },
      select: {
        id: true,
        agentId: true,
        itemId: true,
        status: true,
        provider: true,
        model: true,
        latencyMs: true,
        totalTokens: true,
        estimatedCostUsd: true,
        createdAt: true,
        finishedAt: true,
        error: true
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(input.limit ?? 50, 200)
    });
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
    const rows = await this.prisma.aIAgentRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        createdAt: { gte: start }
      },
      select: {
        status: true,
        provider: true,
        latencyMs: true,
        totalTokens: true,
        estimatedCostUsd: true
      }
    });

    const runs24h = rows.length;
    const failed24h = rows.filter((row) => row.status === 'failed').length;
    const failureRate24h = runs24h > 0 ? Number((failed24h / runs24h).toFixed(4)) : 0;
    const avgLatencyMs24h =
      runs24h > 0
        ? Math.round(rows.reduce((sum, row) => sum + (row.latencyMs ?? 0), 0) / runs24h)
        : 0;
    const tokens24h = rows.reduce((sum, row) => sum + (row.totalTokens ?? 0), 0);
    const estimatedCostUsd24h = Number(
      rows.reduce((sum, row) => sum + (row.estimatedCostUsd ?? 0), 0).toFixed(6)
    );

    const byProviderMap = new Map<
      string,
      { runs24h: number; failed24h: number; latencySum: number; tokens24h: number; cost24h: number }
    >();

    for (const row of rows) {
      const provider = row.provider ?? 'unknown';
      const current = byProviderMap.get(provider) ?? {
        runs24h: 0,
        failed24h: 0,
        latencySum: 0,
        tokens24h: 0,
        cost24h: 0
      };
      current.runs24h += 1;
      if (row.status === 'failed') {
        current.failed24h += 1;
      }
      current.latencySum += row.latencyMs ?? 0;
      current.tokens24h += row.totalTokens ?? 0;
      current.cost24h += row.estimatedCostUsd ?? 0;
      byProviderMap.set(provider, current);
    }

    return {
      totals: {
        runs24h,
        failed24h,
        failureRate24h,
        avgLatencyMs24h,
        tokens24h,
        estimatedCostUsd24h
      },
      byProvider: Array.from(byProviderMap.entries()).map(([provider, stats]) => ({
        provider,
        runs24h: stats.runs24h,
        failed24h: stats.failed24h,
        avgLatencyMs24h: stats.runs24h > 0 ? Math.round(stats.latencySum / stats.runs24h) : 0,
        tokens24h: stats.tokens24h,
        estimatedCostUsd24h: Number(stats.cost24h.toFixed(6))
      }))
    };
  }
}
