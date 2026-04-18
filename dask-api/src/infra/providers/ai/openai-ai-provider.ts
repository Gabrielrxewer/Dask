import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import type { AIProvider, AINativeTool } from '@/modules/ai/domain/providers';

type ResponsesApiTool =
  | {
      type: 'function';
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      strict?: boolean;
    }
  | {
      type: 'web_search';
    };

type ResponsesApiOutput = {
  type?: string;
  name?: string;
  arguments?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type ResponsesApiResponse = {
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  output?: ResponsesApiOutput[];
};

export class OpenAIAIProvider implements AIProvider {
  private readonly endpoint = `${env.OPENAI_BASE_URL}/responses`;
  private readonly aiLogger = getLogger('ai.openai.responses');
  private readonly aiDebug = createDebugLogger('ai.openai.responses');

  public async generateText(input: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    model?: string;
    tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    nativeTools?: AINativeTool[];
    requireJsonOutput?: boolean;
  }): Promise<{
    content: string;
    model: string;
    provider: string;
    latencyMs: number;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  }> {
    const start = Date.now();
    const selectedModel = input.model ?? env.AI_CHAT_MODEL;
    const nativeTools = Array.from(new Set(input.nativeTools ?? []));
    const webSearchEnabled = nativeTools.includes('web_search');

    const tools: ResponsesApiTool[] = [];

    if (Array.isArray(input.tools)) {
      for (const tool of input.tools) {
        tools.push({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: true
        });
      }
    }

    if (webSearchEnabled) {
      tools.push({ type: 'web_search' });
    }

    this.aiDebug.log(
      {
        model: selectedModel,
        hasFunctionTools: Boolean(input.tools?.length),
        nativeTools,
        webSearchEnabled,
        requireJsonOutput: Boolean(input.requireJsonOutput)
      },
      'Dispatching OpenAI responses request'
    );

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel,
        temperature: input.temperature ?? 0.2,
        text: input.requireJsonOutput ? { format: { type: 'json_object' } } : undefined,
        tools: tools.length > 0 ? tools : undefined,
        input: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.aiLogger.error(
        {
          model: selectedModel,
          status: response.status
        },
        'OpenAI responses request failed'
      );
      throw new AppError(`OpenAI responses failed: ${errorText.slice(0, 400)}`, 502);
    }

    const payload = (await response.json()) as ResponsesApiResponse;
    const outputItems = Array.isArray(payload.output) ? payload.output : [];

    const content = outputItems
      .filter((item) => item.type === 'message')
      .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
      .filter((entry) => entry.type === 'output_text' && typeof entry.text === 'string')
      .map((entry) => entry.text!.trim())
      .filter((entry) => entry.length > 0)
      .join('\n')
      .trim();

    const toolCalls = outputItems
      .filter((item) => item.type === 'function_call')
      .map((item) => {
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        const rawArgs = typeof item.arguments === 'string' ? item.arguments : '';

        if (!name || !rawArgs) {
          return null;
        }

        try {
          const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
          return { name, arguments: parsed };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { name: string; arguments: Record<string, unknown> } => Boolean(entry));

    if (!content && toolCalls.length === 0) {
      throw new AppError('OpenAI returned an empty response', 502);
    }

    const inputTokens = payload.usage?.input_tokens ?? 0;
    const outputTokens = payload.usage?.output_tokens ?? 0;
    const totalTokens = payload.usage?.total_tokens ?? inputTokens + outputTokens;
    const latencyMs = Date.now() - start;

    this.aiDebug.log(
      {
        model: payload.model ?? selectedModel,
        latencyMs,
        inputTokens,
        outputTokens,
        totalTokens,
        webSearchUsed: webSearchEnabled,
        toolCalls: toolCalls.length
      },
      'OpenAI responses request finished'
    );

    return {
      content,
      model: payload.model ?? selectedModel,
      provider: 'openai',
      latencyMs,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens
      },
      toolCalls
    };
  }

  public async improveDescription(input: { title: string; description: string }): Promise<string> {
    const result = await this.generateText({
      systemPrompt:
        'You improve task card descriptions with concise, actionable writing and explicit acceptance criteria.',
      userPrompt: [`Title: ${input.title}`, `Description: ${input.description}`].join('\n')
    });
    return result.content;
  }

  public async summarize(input: { content: string }): Promise<string> {
    const result = await this.generateText({
      systemPrompt: 'Summarize the content in up to 6 bullet points with practical decisions.',
      userPrompt: input.content
    });
    return result.content;
  }

  public async classify(input: { content: string; labels: string[] }): Promise<string> {
    const rawResult = await this.generateText({
      systemPrompt:
        'Classify the content into exactly one label from the provided list. Return only the label.',
      userPrompt: `Labels: ${input.labels.join(', ')}\n\nContent:\n${input.content}`,
      temperature: 0
    });
    const raw = rawResult.content;
    return input.labels.includes(raw) ? raw : input.labels[0] ?? 'general';
  }
}
