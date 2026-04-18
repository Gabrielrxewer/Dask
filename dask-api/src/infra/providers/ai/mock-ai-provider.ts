import type { AIProvider } from '@/modules/ai/domain/providers';

export class MockAIProvider implements AIProvider {
  public async generateText(input: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    model?: string;
    tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    nativeTools?: Array<'web_search'>;
    requireJsonOutput?: boolean;
  }): Promise<{
    content: string;
    model: string;
    provider: string;
    latencyMs: number;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  }> {
    const content = [input.systemPrompt, '', input.userPrompt].join('\n').trim();
    const inputTokens = Math.ceil((input.systemPrompt.length + input.userPrompt.length) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    return {
      content,
      model: input.model ?? 'mock-gpt',
      provider: 'mock',
      latencyMs: 1,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      },
      toolCalls: []
    };
  }

  public async improveDescription(input: { title: string; description: string }): Promise<string> {
    return `[Improved] ${input.title}: ${input.description}`.trim();
  }

  public async summarize(input: { content: string }): Promise<string> {
    return input.content.slice(0, 180);
  }

  public async classify(input: { content: string; labels: string[] }): Promise<string> {
    const normalized = input.content.toLowerCase();
    return input.labels.find((label) => normalized.includes(label.toLowerCase())) ?? input.labels[0] ?? 'general';
  }
}
