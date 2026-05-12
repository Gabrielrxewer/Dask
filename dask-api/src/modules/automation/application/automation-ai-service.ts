import type { Prisma, PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import type { AIProvider } from '@/modules/ai/domain/providers';
import { parseJsonObject, redactSensitiveText } from '@/modules/ai/application/ai-guardrails';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

export const automationAIReplyIntents = [
  'interested',
  'not_interested',
  'question',
  'pricing_objection',
  'deadline_objection',
  'approval',
  'complaint',
  'unsubscribe',
  'unknown'
] as const;
export type AutomationAIReplyIntent = (typeof automationAIReplyIntents)[number];

const automationAINextActions = [
  'create_task',
  'move_card_suggestion',
  'send_message_draft',
  'mark_as_interested_suggestion',
  'mark_as_lost_suggestion',
  'wait',
  'unknown'
] as const;

type JsonRecord = Record<string, unknown>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clamp(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, 0), 1);
}

function arrayOfStrings(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim().slice(0, 240))
    .slice(0, max);
}

function choose<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && options.includes(value as T[number])
    ? value as T[number]
    : fallback;
}

function buildPrompt(input: {
  task: string;
  schema: string;
  data: unknown;
}): string {
  return [
    `Task: ${input.task}`,
    'Return only a valid JSON object. Do not include markdown.',
    `Required schema:\n${input.schema}`,
    `Data:\n${JSON.stringify(sanitizeAutomationPayload(input.data), null, 2)}`
  ].join('\n\n');
}

function detectIntent(messageText: string): AutomationAIReplyIntent {
  const normalized = messageText.toLowerCase();
  if (/\b(cancelar|pare|parar|unsubscribe|descadastrar|sair|opt[- ]?out)\b/.test(normalized)) {
    return 'unsubscribe';
  }
  if (/\b(reclama|ruim|insatisfeito|problema|erro|atraso)\b/.test(normalized)) {
    return 'complaint';
  }
  if (/\b(aprov|fechado|vamos fechar|aceito|ok pode|pode seguir)\b/.test(normalized)) {
    return 'approval';
  }
  if (/\b(preco|preço|valor|caro|desconto|orcamento|orçamento)\b/.test(normalized)) {
    return 'pricing_objection';
  }
  if (/\b(prazo|entrega|quando|data|depois do dia|semana)\b/.test(normalized)) {
    return 'deadline_objection';
  }
  if (/\?|\b(duvida|dúvida|entender|explicar|como|qual)\b/.test(normalized)) {
    return 'question';
  }
  if (/\b(interesse|interessado|quero|gostei|seguir)\b/.test(normalized)) {
    return 'interested';
  }
  if (/\b(nao tenho|não tenho|nao quero|não quero|sem interesse)\b/.test(normalized)) {
    return 'not_interested';
  }
  return 'unknown';
}

function detectSentiment(intent: AutomationAIReplyIntent): string {
  if (intent === 'interested' || intent === 'approval') {
    return 'interested';
  }
  if (intent === 'not_interested' || intent === 'complaint' || intent === 'unsubscribe') {
    return 'negative';
  }
  return 'neutral';
}

function extractDate(messageText: string): string | null {
  const dayMatch = messageText.match(/\b(?:dia\s*)?([0-3]?\d)\b/);
  if (!dayMatch) {
    return null;
  }

  const day = Number(dayMatch[1]);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }

  const now = new Date();
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
  if (candidate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }

  return candidate.toISOString().slice(0, 10);
}

export class AutomationAIService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly aiProvider: AIProvider
  ) {}

  public async summarizeContext(input: {
    workspaceId: string;
    workItemId?: string | null;
    contactId?: string | null;
    include?: string[];
  }): Promise<JsonRecord> {
    const context = await this.loadCommercialContext(input);
    const parsed = await this.generateStructured({
      workspaceId: input.workspaceId,
      taskKey: 'ai_summarize_context',
      task: 'Summarize the commercial context without inventing facts. Missing data must be explicit.',
      schema: '{ "summary": "string", "facts": ["string"], "risks": ["string"] }',
      data: {
        include: input.include ?? [],
        context
      },
      fallback: () => ({
        summary: this.localSummary(context),
        facts: this.localFacts(context),
        risks: this.localRisks(context)
      })
    });

    return {
      summary: text(parsed.summary).slice(0, 1200) || this.localSummary(context),
      facts: arrayOfStrings(parsed.facts),
      risks: arrayOfStrings(parsed.risks)
    };
  }

  public async classifyReply(input: {
    workspaceId: string;
    messageText: string;
    channel?: string | null;
    contactId?: string | null;
    workItemId?: string | null;
  }): Promise<JsonRecord> {
    const fallbackIntent = detectIntent(input.messageText);
    const parsed = await this.generateStructured({
      workspaceId: input.workspaceId,
      taskKey: 'ai_classify_reply',
      task: 'Classify an inbound customer reply for a commercial automation. Never trigger an action.',
      schema: [
        '{',
        '  "intent": "interested|not_interested|question|pricing_objection|deadline_objection|approval|complaint|unsubscribe|unknown",',
        '  "sentiment": "interested|neutral|negative",',
        '  "urgency": "low|medium|high",',
        '  "needsHuman": boolean,',
        '  "suggestedCategory": "string",',
        '  "confidence": number,',
        '  "reason": "string"',
        '}'
      ].join('\n'),
      data: input,
      fallback: () => ({
        intent: fallbackIntent,
        sentiment: detectSentiment(fallbackIntent),
        urgency: fallbackIntent === 'complaint' || fallbackIntent === 'unsubscribe' ? 'high' : 'medium',
        needsHuman: true,
        suggestedCategory: fallbackIntent === 'question' ? 'commercial_question' : fallbackIntent,
        confidence: fallbackIntent === 'unknown' ? 0.35 : 0.72,
        reason: 'Classificacao local segura gerada quando a IA nao retornou JSON estruturado.'
      })
    });

    const intent = choose(parsed.intent, automationAIReplyIntents, fallbackIntent);
    const confidence = clamp(parsed.confidence, intent === 'unknown' ? 0.35 : 0.72);
    const needsHuman = parsed.needsHuman === true || confidence < 0.7 || intent === 'unknown';

    return {
      intent,
      sentiment: text(parsed.sentiment) || detectSentiment(intent),
      urgency: choose(parsed.urgency, ['low', 'medium', 'high'] as const, 'medium'),
      needsHuman,
      suggestedCategory: text(parsed.suggestedCategory) || (intent === 'question' ? 'commercial_question' : intent),
      confidence,
      reason: text(parsed.reason).slice(0, 600) || 'Resposta classificada com guardrails de automacao.'
    };
  }

  public async extractIntent(input: {
    workspaceId: string;
    messageText: string;
    channel?: string | null;
    contactId?: string | null;
    workItemId?: string | null;
  }): Promise<JsonRecord> {
    const parsed = await this.generateStructured({
      workspaceId: input.workspaceId,
      taskKey: 'ai_extract_intent',
      task: 'Extract only explicit structured entities from the customer reply. Unknown values must be null.',
      schema: '{ "entities": { "desiredCloseDate": "YYYY-MM-DD|null", "objection": "string|null" }, "confidence": number }',
      data: input,
      fallback: () => ({
        entities: {
          desiredCloseDate: extractDate(input.messageText),
          objection: detectIntent(input.messageText).includes('objection') ? detectIntent(input.messageText).replace('_objection', '') : null
        },
        confidence: extractDate(input.messageText) ? 0.68 : 0.45
      })
    });

    const entities = isRecord(parsed.entities) ? parsed.entities : {};
    return {
      entities: {
        desiredCloseDate: text(entities.desiredCloseDate) || null,
        objection: text(entities.objection) || null
      },
      confidence: clamp(parsed.confidence, 0.5)
    };
  }

  public async generateMessageDraft(input: {
    workspaceId: string;
    channel?: string | null;
    contactId?: string | null;
    workItemId?: string | null;
    tone?: string | null;
    goal?: string | null;
    contextSummary?: string | null;
  }): Promise<JsonRecord> {
    const parsed = await this.generateStructured({
      workspaceId: input.workspaceId,
      taskKey: 'ai_generate_message_draft',
      task: 'Generate a draft for a human operator to review. Do not promise prices or deadlines absent from context.',
      schema: '{ "draftText": "string", "channel": "whatsapp|email", "reason": "string" }',
      data: input,
      fallback: () => ({
        draftText: this.localDraft(input),
        channel: input.channel === 'email' ? 'email' : 'whatsapp',
        reason: 'Rascunho seguro criado para revisao humana.'
      })
    });

    return {
      draftText: (text(parsed.draftText) || this.localDraft(input)).slice(0, 1800),
      channel: input.channel === 'email' ? 'email' : 'whatsapp',
      requiresApproval: true,
      unsafeToAutoSend: true,
      reason: text(parsed.reason).slice(0, 600) || 'Resposta comercial personalizada precisa de revisao humana.'
    };
  }

  public async recommendNextAction(input: {
    workspaceId: string;
    classification?: unknown;
    contextSummary?: string | null;
    messageText?: string | null;
  }): Promise<JsonRecord> {
    const parsed = await this.generateStructured({
      workspaceId: input.workspaceId,
      taskKey: 'ai_recommend_next_action',
      task: 'Recommend the next operational step. Do not execute it.',
      schema: '{ "recommendedAction": "create_task|move_card_suggestion|send_message_draft|mark_as_interested_suggestion|mark_as_lost_suggestion|wait|unknown", "label": "string", "reason": "string", "confidence": number, "requiresHuman": boolean }',
      data: input,
      fallback: () => {
        const classification = isRecord(input.classification) ? input.classification : {};
        const intent = choose(classification.intent, automationAIReplyIntents, detectIntent(input.messageText ?? ''));
        const action = intent === 'interested' || intent === 'question' || intent.includes('objection')
          ? 'create_task'
          : intent === 'not_interested'
            ? 'mark_as_lost_suggestion'
            : 'unknown';
        return {
          recommendedAction: action,
          label: action === 'create_task'
            ? 'Criar tarefa para resposta comercial'
            : 'Revisar resposta recebida',
          reason: 'Recomendacao local segura baseada na classificacao.',
          confidence: intent === 'unknown' ? 0.4 : 0.74,
          requiresHuman: true
        };
      }
    });

    return {
      recommendedAction: choose(parsed.recommendedAction, automationAINextActions, 'unknown'),
      label: text(parsed.label).slice(0, 180) || 'Revisar resposta recebida',
      reason: text(parsed.reason).slice(0, 600) || 'Recomendacao exige revisao humana.',
      confidence: clamp(parsed.confidence, 0.6),
      requiresHuman: true
    };
  }

  public fillTemplateVariables(input: {
    templateKey?: string | null;
    context?: unknown;
    requiredVariables?: string[];
    variables?: string[];
  }): JsonRecord {
    const context = isRecord(input.context) ? input.context : {};
    const requiredVariables = [...(input.requiredVariables ?? []), ...(input.variables ?? [])]
      .map((entry) => entry.trim())
      .filter(Boolean);
    const variables: Record<string, string> = {};
    const missingVariables: string[] = [];

    for (const variable of requiredVariables) {
      const value = this.readPath(context, variable);
      if (value === undefined || value === null || String(value).trim().length === 0) {
        missingVariables.push(variable);
        continue;
      }
      variables[variable] = String(value);
    }

    return {
      variables,
      missingVariables,
      safeToUseTemplate: missingVariables.length === 0
    };
  }

  private async generateStructured(input: {
    workspaceId: string;
    taskKey: string;
    task: string;
    schema: string;
    data: unknown;
    fallback: () => JsonRecord;
  }): Promise<JsonRecord> {
    const agent = await this.ensureAutomationAgent(input.workspaceId);
    const userPrompt = buildPrompt({
      task: input.task,
      schema: input.schema,
      data: input.data
    });
    const sanitizedPrompt = redactSensitiveText(userPrompt).slice(0, 12_000);

    try {
      const generation = await this.aiProvider.generateText({
        model: agent.model,
        temperature: agent.temperature,
        systemPrompt: [
          agent.systemPrompt,
          'You cannot send messages, mutate data, call tools, or execute side effects.',
          'You are only allowed to produce structured JSON for a human-controlled automation runtime.'
        ].join('\n'),
        userPrompt: sanitizedPrompt,
        requireJsonOutput: true
      });
      const parsed = parseJsonObject(generation.content) ?? input.fallback();

      return parsed;
    } catch {
      return input.fallback();
    }
  }

  private async ensureAutomationAgent(workspaceId: string) {
    const existing = await this.prisma.aIAgent.findUnique({
      where: {
        workspaceId_key: {
          workspaceId,
          key: 'automation-studio-assistant'
        }
      }
    });

    if (existing) {
      return existing;
    }

    return this.prisma.aIAgent.create({
      data: {
        workspaceId,
        key: 'automation-studio-assistant',
        name: 'Automation Studio Assistant',
        description: 'Classifica respostas, resume contexto e gera rascunhos com aprovacao humana.',
        model: env.AI_CHAT_MODEL,
        temperature: 0.2,
        systemPrompt: [
          'You are a safe automation assistant for commercial operations.',
          'Never invent facts. Say when data is missing.',
          'Never send WhatsApp or email. Never execute actions.',
          'Commercial outbound messages always require human approval.'
        ].join('\n'),
        isActive: true,
        isDefault: false,
        config: toJsonValue({
          tools: { enabled: false, allowed: [], nativeEnabled: false, nativeAllowed: [] },
          guardrails: { redactSensitive: true, requireJsonOutput: true }
        })
      }
    });
  }

  private async loadCommercialContext(input: {
    workspaceId: string;
    workItemId?: string | null;
    contactId?: string | null;
    include?: string[];
  }): Promise<JsonRecord> {
    const [workItem, contact, interactions] = await Promise.all([
      input.workItemId
        ? this.prisma.item.findFirst({
            where: { id: input.workItemId, workspaceId: input.workspaceId },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              type: true,
              fields: true,
              metadata: true,
              dueDate: true,
              updatedAt: true
            }
          })
        : null,
      input.contactId
        ? this.prisma.communicationContact.findFirst({
            where: { id: input.contactId, workspaceId: input.workspaceId },
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              companyName: true,
              preferredChannel: true,
              status: true
            }
          })
        : null,
      input.contactId
        ? this.prisma.communicationInteraction.findMany({
            where: { workspaceId: input.workspaceId, contactId: input.contactId },
            orderBy: [{ occurredAt: 'desc' }],
            take: 8,
            select: {
              id: true,
              direction: true,
              channel: true,
              type: true,
              status: true,
              occurredAt: true,
              metadataJson: true
            }
          })
        : []
    ]);

    return sanitizeAutomationPayload({
      workItem,
      contact,
      lastInteractions: interactions
    }) as JsonRecord;
  }

  private localSummary(context: JsonRecord): string {
    const workItem = isRecord(context.workItem) ? context.workItem : null;
    const contact = isRecord(context.contact) ? context.contact : null;
    const title = text(workItem?.title) || 'item comercial nao informado';
    const name = text(contact?.displayName) || text(contact?.firstName) || 'contato nao informado';
    return `Contexto disponivel: ${title}; contato: ${name}. Dados ausentes devem ser revisados pelo operador.`;
  }

  private localFacts(context: JsonRecord): string[] {
    const workItem = isRecord(context.workItem) ? context.workItem : null;
    const contact = isRecord(context.contact) ? context.contact : null;
    return [
      workItem ? `Work item: ${text(workItem.title) || workItem.id}` : 'Work item ausente no contexto.',
      contact ? `Contato: ${text(contact.displayName) || text(contact.firstName) || contact.id}` : 'Contato ausente no contexto.'
    ];
  }

  private localRisks(context: JsonRecord): string[] {
    const workItem = isRecord(context.workItem) ? context.workItem : null;
    return workItem ? [] : ['Contexto comercial incompleto para gerar resposta personalizada.'];
  }

  private localDraft(input: {
    channel?: string | null;
    tone?: string | null;
    goal?: string | null;
    contextSummary?: string | null;
  }): string {
    const goal = text(input.goal) || 'responder sua mensagem';
    const context = text(input.contextSummary);
    return [
      'Ola {{contact.name}}, obrigado pelo retorno.',
      `Vou te ajudar com ${goal}.`,
      context ? `Pelo contexto que temos: ${context}` : 'Vou revisar os detalhes antes de confirmar prazos ou valores.',
      'Posso te responder com mais seguranca apos validar as informacoes internamente.'
    ].join(' ');
  }

  private readPath(source: JsonRecord, path: string): unknown {
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
}
