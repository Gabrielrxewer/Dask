import type { AutomationAIService } from '@/modules/automation/application/automation-ai-service';
import type {
  AutomationRunEventService,
  AutomationRunEventType
} from '@/modules/automation/application/automation-run-event-service';
import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';
import { normalizeAutomationError, sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

type AINodeType =
  | 'ai_summarize_context'
  | 'ai_classify_reply'
  | 'ai_extract_intent'
  | 'ai_generate_message_draft'
  | 'ai_recommend_next_action'
  | 'ai_fill_template_variables';

const specificEvents: Record<AINodeType, AutomationRunEventType> = {
  ai_summarize_context: 'ai.context_summarized',
  ai_classify_reply: 'ai.reply_classified',
  ai_extract_intent: 'ai.intent_extracted',
  ai_generate_message_draft: 'ai.message_draft_created',
  ai_recommend_next_action: 'ai.next_action_recommended',
  ai_fill_template_variables: 'ai.template_variables_filled'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(source: Record<string, unknown>, path: string): unknown {
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

function renderValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
      const resolved = readPath(context, path);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => renderValue(entry, context));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderValue(entry, context)])
    );
  }

  return value;
}

function compactOutput(output: Record<string, unknown>): Record<string, unknown> {
  const compact: Record<string, unknown> = {};
  for (const key of [
    'summary',
    'intent',
    'confidence',
    'needsHuman',
    'requiresApproval',
    'unsafeToAutoSend',
    'recommendedAction',
    'safeToUseTemplate'
  ]) {
    if (output[key] !== undefined) {
      compact[key] = output[key];
    }
  }
  return compact;
}

export class AINodeExecutor implements AutomationNodeExecutor {
  public constructor(
    public readonly type: AINodeType,
    private readonly aiService: AutomationAIService,
    private readonly eventService: AutomationRunEventService
  ) {}

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    const nodeInput = this.buildNodeInput(input);

    await this.eventService.createEvent({
      workspaceId: input.run.workspaceId,
      runId: input.run.id,
      stepRunId: input.stepRun.id,
      eventType: 'ai.node_started',
      message: 'Automation AI node started.',
      payload: {
        nodeId: input.node.id,
        nodeType: input.node.type,
        input: nodeInput
      }
    });

    try {
      const output = await this.executeAI(input, nodeInput);
      const safeOutput = sanitizeAutomationPayload(output) as Record<string, unknown>;

      await this.eventService.createEvent({
        workspaceId: input.run.workspaceId,
        runId: input.run.id,
        stepRunId: input.stepRun.id,
        eventType: 'ai.node_completed',
        message: 'Automation AI node completed.',
        payload: {
          nodeId: input.node.id,
          nodeType: input.node.type,
          output: compactOutput(safeOutput)
        }
      });
      await this.eventService.createEvent({
        workspaceId: input.run.workspaceId,
        runId: input.run.id,
        stepRunId: input.stepRun.id,
        eventType: specificEvents[this.type],
        message: `Automation AI node ${this.type} produced structured output.`,
        payload: {
          nodeId: input.node.id,
          nodeType: input.node.type,
          output: compactOutput(safeOutput)
        }
      });

      return {
        status: 'completed',
        output: {
          aiNodeType: this.type,
          aiInput: nodeInput,
          ...safeOutput
        }
      };
    } catch (error) {
      const safeError = normalizeAutomationError(error);
      await this.eventService.createEvent({
        workspaceId: input.run.workspaceId,
        runId: input.run.id,
        stepRunId: input.stepRun.id,
        eventType: 'ai.node_failed',
        level: 'error',
        message: 'Automation AI node failed.',
        payload: {
          nodeId: input.node.id,
          nodeType: input.node.type,
          error: safeError
        }
      });

      return {
        status: 'failed',
        error: safeError,
        retryable: safeError.retryable
      };
    }
  }

  private buildNodeInput(input: AutomationNodeExecutionInput): Record<string, unknown> {
    const templateContext = {
      ...input.context,
      input: input.input,
      previousOutput: input.input.previousOutput
    };
    const config = isRecord(input.node.config) ? input.node.config : {};
    const rendered = renderValue(config, templateContext);
    return sanitizeAutomationPayload(isRecord(rendered) ? rendered : {}) as Record<string, unknown>;
  }

  private async executeAI(
    input: AutomationNodeExecutionInput,
    nodeInput: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const workspaceId = input.run.workspaceId;

    if (this.type === 'ai_summarize_context') {
      return this.aiService.summarizeContext({
        workspaceId,
        workItemId: typeof nodeInput.workItemId === 'string' ? nodeInput.workItemId : undefined,
        contactId: typeof nodeInput.contactId === 'string' ? nodeInput.contactId : undefined,
        include: Array.isArray(nodeInput.include)
          ? nodeInput.include.filter((entry): entry is string => typeof entry === 'string')
          : undefined
      });
    }

    if (this.type === 'ai_classify_reply') {
      return this.aiService.classifyReply({
        workspaceId,
        messageText: typeof nodeInput.messageText === 'string' ? nodeInput.messageText : '',
        channel: typeof nodeInput.channel === 'string' ? nodeInput.channel : undefined,
        contactId: typeof nodeInput.contactId === 'string' ? nodeInput.contactId : undefined,
        workItemId: typeof nodeInput.workItemId === 'string' ? nodeInput.workItemId : undefined
      });
    }

    if (this.type === 'ai_extract_intent') {
      return this.aiService.extractIntent({
        workspaceId,
        messageText: typeof nodeInput.messageText === 'string' ? nodeInput.messageText : '',
        channel: typeof nodeInput.channel === 'string' ? nodeInput.channel : undefined,
        contactId: typeof nodeInput.contactId === 'string' ? nodeInput.contactId : undefined,
        workItemId: typeof nodeInput.workItemId === 'string' ? nodeInput.workItemId : undefined
      });
    }

    if (this.type === 'ai_generate_message_draft') {
      return this.aiService.generateMessageDraft({
        workspaceId,
        channel: typeof nodeInput.channel === 'string' ? nodeInput.channel : undefined,
        contactId: typeof nodeInput.contactId === 'string' ? nodeInput.contactId : undefined,
        workItemId: typeof nodeInput.workItemId === 'string' ? nodeInput.workItemId : undefined,
        tone: typeof nodeInput.tone === 'string' ? nodeInput.tone : undefined,
        goal: typeof nodeInput.goal === 'string' ? nodeInput.goal : undefined,
        contextSummary: typeof nodeInput.contextSummary === 'string' ? nodeInput.contextSummary : undefined
      });
    }

    if (this.type === 'ai_recommend_next_action') {
      return this.aiService.recommendNextAction({
        workspaceId,
        classification: nodeInput.classification,
        contextSummary: typeof nodeInput.contextSummary === 'string' ? nodeInput.contextSummary : undefined,
        messageText: typeof nodeInput.messageText === 'string' ? nodeInput.messageText : undefined
      });
    }

    return this.aiService.fillTemplateVariables({
      templateKey: typeof nodeInput.templateKey === 'string' ? nodeInput.templateKey : undefined,
      context: nodeInput.context,
      requiredVariables: Array.isArray(nodeInput.requiredVariables)
        ? nodeInput.requiredVariables.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
      variables: Array.isArray(nodeInput.variables)
        ? nodeInput.variables.filter((entry): entry is string => typeof entry === 'string')
        : undefined
    });
  }
}
