import { afterEach, describe, expect, it, vi } from 'vitest';

describe('buildAIProviderStack runtime env', () => {
  afterEach(() => {
    vi.doUnmock('@/core/config/env');
    vi.resetModules();
  });

  async function importStackWithEnv(env: { NODE_ENV: 'development' | 'test' | 'production'; OPENAI_API_KEY?: string }) {
    vi.resetModules();
    vi.doMock('@/core/config/env', () => ({
      env: {
        LOG_LEVEL: 'silent',
        LOG_PRETTY: 'never',
        LOG_DEBUG_CHANNELS: [],
        ...env
      }
    }));

    return import('@/infra/providers/ai/build-ai-provider-stack');
  }

  it('uses mock providers outside production when OPENAI_API_KEY is absent', async () => {
    const { buildAIProviderStack } = await importStackWithEnv({ NODE_ENV: 'test' });
    const stack = buildAIProviderStack();

    expect(stack.aiProvider.constructor.name).toBe('MockAIProvider');
    expect(stack.embeddingProvider.constructor.name).toBe('MockEmbeddingProvider');
  });

  it('fails production startup when the AI provider env is missing', async () => {
    const { buildAIProviderStack } = await importStackWithEnv({ NODE_ENV: 'production' });

    expect(() => buildAIProviderStack()).toThrow(/AI provider environment is not configured for production/);
  });

  it('uses real OpenAI providers in production when OPENAI_API_KEY is configured', async () => {
    const { buildAIProviderStack } = await importStackWithEnv({
      NODE_ENV: 'production',
      OPENAI_API_KEY: 'sk-test-openai-key'
    });
    const stack = buildAIProviderStack();

    expect(stack.aiProvider.constructor.name).toBe('OpenAIAIProvider');
    expect(stack.embeddingProvider.constructor.name).toBe('OpenAIEmbeddingProvider');
  });
});
