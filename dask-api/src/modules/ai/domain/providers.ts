export type AIToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type AINativeTool = 'web_search';

export type AIToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type AIGenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AIGenerateTextResult = {
  content: string;
  model: string;
  provider: string;
  latencyMs: number;
  usage: AIGenerationUsage;
  toolCalls: AIToolCall[];
};

export interface AIProvider {
  generateText(input: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    model?: string;
    tools?: AIToolDefinition[];
    nativeTools?: AINativeTool[];
    requireJsonOutput?: boolean;
  }): Promise<AIGenerateTextResult>;
  improveDescription(input: { title: string; description: string }): Promise<string>;
  summarize(input: { content: string }): Promise<string>;
  classify(input: { content: string; labels: string[] }): Promise<string>;
}

export interface EmbeddingProvider {
  embed(input: { content: string }): Promise<number[]>;
}
