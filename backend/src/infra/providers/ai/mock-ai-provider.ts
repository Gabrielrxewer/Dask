import type { AIProvider } from '@/modules/ai/domain/providers';

export class MockAIProvider implements AIProvider {
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
