import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import type { EmbeddingProvider } from '@/modules/ai/domain/providers';

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly endpoint = `${env.OPENAI_BASE_URL}/embeddings`;
  private readonly embeddingLogger = getLogger('ai.openai.embedding');
  private readonly embeddingDebug = createDebugLogger('ai.openai.embedding');

  public async embed(input: { content: string }): Promise<number[]> {
    const startedAt = Date.now();
    this.embeddingDebug.log(
      {
        model: env.AI_EMBEDDING_MODEL,
        contentLength: input.content.length
      },
      'Dispatching OpenAI embedding request'
    );

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
      this.embeddingLogger.error(
        {
          model: env.AI_EMBEDDING_MODEL,
          status: response.status
        },
        'OpenAI embedding request failed'
      );
      throw new AppError(`OpenAI embeddings failed: ${errorText.slice(0, 400)}`, 502);
    }

    const payload = (await response.json()) as EmbeddingResponse;
    const vector = payload.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new AppError('OpenAI returned an empty embedding', 502);
    }

    this.embeddingDebug.log(
      {
        model: env.AI_EMBEDDING_MODEL,
        latencyMs: Date.now() - startedAt,
        dimensions: vector.length
      },
      'OpenAI embedding request finished'
    );

    return vector;
  }
}
