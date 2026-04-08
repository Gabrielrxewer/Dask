import type { EmbeddingProvider } from '@/modules/ai/domain/providers';

export class MockEmbeddingProvider implements EmbeddingProvider {
  public async embed(input: { content: string }): Promise<number[]> {
    const base = input.content
      .slice(0, 16)
      .split('')
      .map((char) => char.charCodeAt(0) / 255);

    if (base.length === 0) {
      return [0];
    }

    return base;
  }
}
