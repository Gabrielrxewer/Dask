import { z } from 'zod';
import { type Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { env } from '@/core/config/env';
import type { AIProvider, AIToolDefinition } from '@/modules/ai/domain/providers';
import type { HybridSearchService } from '@/modules/search/application/hybrid-search-service';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { AIAgentRepository } from '@/modules/ai/repositories/ai-agent-repository';
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
        allowed: z.array(z.string()).optional()
      })
      .optional(),
    guardrails: z
      .object({
        redactSensitive: z.boolean().optional(),
        requireJsonOutput: z.boolean().optional()
      })
      .optional()
  })
  .passthrough();

type AgentConfig = z.infer<typeof agentConfigSchema>;

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

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly agentRepository: AIAgentRepository,
    private readonly aiProvider: AIProvider,
    private readonly hybridSearchService: HybridSearchService,
    private readonly authorizationService: AuthorizationService,
    private readonly eventPublisher: EventPublisher
  ) {
    this.toolExecutor = new AIToolExecutor(prisma, authorizationService, eventPublisher);
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
        tools: { enabled: false, allowed: [] },
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
  }): Promise<{ id: string }> {
    return this.agentRepository.create({
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

    return { id: input.agentId };
  }

  private async buildItemContext(input: {
    workspaceId: string;
    itemId: string;
    includeSemanticContext: boolean;
    topKContextDocs: number;
    redactSensitive: boolean;
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
        }
      }
    });

    if (!item) {
      throw new AppError('Item not found', 404);
    }

    const redact = (value: string): string => (input.redactSensitive ? redactSensitiveText(value) : value);

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
        `Updated At: ${item.updatedAt.toISOString()}`,
        'Recent History:',
        ...item.history.map((entry) => `- ${entry.createdAt.toISOString()} | ${entry.eventName}`)
      ].join('\n')
    );

    if (!input.includeSemanticContext) {
      return { itemContext, semanticContext: '', boardId: item.boardId };
    }

    const relatedDocs = await this.hybridSearchService.search({
      query: `${item.title}\n${item.description ?? ''}`.trim(),
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

  private buildToolDefinitions(allowedTools: string[]): AIToolDefinition[] {
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
    const toolsEnabled = config.tools?.enabled === true && (config.tools.allowed?.length ?? 0) > 0;

    // ── Fix: authorize write access before any I/O when tools may mutate the item ──
    if (toolsEnabled) {
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
      includeSemanticContext: input.includeSemanticContext,
      topKContextDocs: input.topKContextDocs,
      redactSensitive
    });

    const instruction = redactSensitive ? redactSensitiveText(input.instruction) : input.instruction;
    const promptBody = [
      `Instruction:\n${instruction}`,
      '',
      `Card Context:\n${context.itemContext}`,
      '',
      context.semanticContext.length > 0 ? `Semantic Context:\n${context.semanticContext}` : ''
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
          includeSemanticContext: input.includeSemanticContext,
          topKContextDocs: input.topKContextDocs
        },
        startedAt: new Date()
      }
    });

    try {
      const allowedTools =
        config.tools?.enabled === true && Array.isArray(config.tools.allowed) ? config.tools.allowed : [];

      const toolDefinitions = this.buildToolDefinitions(allowedTools);
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
        requireJsonOutput: Boolean(config.guardrails?.requireJsonOutput)
      });

      const toolExecutionSummary = await this.toolExecutor.execute({
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        boardId: context.boardId,
        requestedBy: input.requestedBy,
        toolCalls: generation.toolCalls,
        allowedTools
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
    const redactSensitive = config.guardrails?.redactSensitive !== false;
    const redact = (value: string): string => (redactSensitive ? redactSensitiveText(value) : value);

    const documentTitle = redact((input.documentTitle ?? '').trim());
    const documentPath = redact((input.documentPath ?? '').trim());
    const instruction = redact(input.instruction);
    const selection = input.selection ? redact(input.selection) : '';
    const documentContent = redact(input.documentContent);
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
      input.includeSemanticContext &&
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
        limit: input.topKContextDocs
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

    const promptBody = [
      `Mode: ${input.mode}`,
      documentTitle ? `Document title: ${documentTitle}` : '',
      documentPath ? `Document path: ${documentPath}` : '',
      `Instruction:\n${instruction}`,
      selection ? `Current selection:\n${selection}` : '',
      `Current document:\n${documentContent || '(empty document)'}`,
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
          topKContextDocs: input.topKContextDocs
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
      redactSensitive: true
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
