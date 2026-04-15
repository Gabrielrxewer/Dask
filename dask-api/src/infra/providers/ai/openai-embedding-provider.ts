import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import type { EmbeddingProvider } from '@/modules/ai/domain/providers';

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly endpoint = `${env.OPENAI_BASE_URL}/embeddings`;

  public async embed(input: { content: string }): Promise<number[]> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: env.AI_EMBEDDING_MODEL,
        input: input.content
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(`OpenAI embeddings failed: ${errorText.slice(0, 400)}`, 502);
    }

    const payload = (await response.json()) as EmbeddingResponse;
    const vector = payload.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new AppError('OpenAI returned an empty embedding', 502);
    }

    return vector;
  }
}

