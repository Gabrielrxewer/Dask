import { env } from '@/core/config/env';
import type { AIProvider, EmbeddingProvider } from '@/modules/ai/domain/providers';
import { MockAIProvider } from '@/infra/providers/ai/mock-ai-provider';
import { MockEmbeddingProvider } from '@/infra/providers/ai/mock-embedding-provider';
import { OpenAIAIProvider } from '@/infra/providers/ai/openai-ai-provider';
import { OpenAIEmbeddingProvider } from '@/infra/providers/ai/openai-embedding-provider';

export function buildAIProviderStack(): { aiProvider: AIProvider; embeddingProvider: EmbeddingProvider } {
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0) {
    return {
      aiProvider: new OpenAIAIProvider(),
      embeddingProvider: new OpenAIEmbeddingProvider()
    };
  }

  return {
    aiProvider: new MockAIProvider(),
    embeddingProvider: new MockEmbeddingProvider()
  };
}

