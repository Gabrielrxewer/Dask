import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import type { AIProvider } from '@/modules/ai/domain/providers';

type ChatCompletionResponse = {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
};

export class OpenAIAIProvider implements AIProvider {
  private readonly endpoint = `${env.OPENAI_BASE_URL}/chat/completions`;

  public async generateText(input: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    model?: string;
    tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
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
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel,
        temperature: input.temperature ?? 0.2,
        response_format: input.requireJsonOutput ? { type: 'json_object' } : undefined,
        tools: input.tools?.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        })),
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(`OpenAI chat failed: ${errorText.slice(0, 400)}`, 502);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AppError('OpenAI returned an empty completion', 502);
    }

    const toolCalls = (payload.choices?.[0]?.message?.tool_calls ?? [])
      .map((toolCall) => {
        const name = toolCall.function?.name?.trim();
        const rawArgs = toolCall.function?.arguments;
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

    const inputTokens = payload.usage?.prompt_tokens ?? 0;
    const outputTokens = payload.usage?.completion_tokens ?? 0;
    const totalTokens = payload.usage?.total_tokens ?? inputTokens + outputTokens;

    return {
      content,
      model: payload.model ?? selectedModel,
      provider: 'openai',
      latencyMs: Date.now() - start,
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
