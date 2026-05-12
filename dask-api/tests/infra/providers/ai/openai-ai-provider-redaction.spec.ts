import { afterEach, describe, expect, it, vi } from 'vitest';

describe('OpenAIAIProvider log redaction', () => {
  afterEach(() => {
    vi.doUnmock('@/core/logging/logger');
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('redacts provider failure payloads before logging and returning errors', async () => {
    const errorLog = vi.fn();
    const debugLog = vi.fn();
    vi.doMock('@/core/logging/logger', () => ({
      getLogger: () => ({
        error: errorLog,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        child: vi.fn()
      }),
      createDebugLogger: () => ({
        enabled: () => true,
        log: debugLog
      })
    }));

    const secretResponse = [
      'upstream failed',
      'sk_live_1234567890abcdef',
      'whsec_1234567890abcdef',
      'token=provider-token-secret',
      'admin@example.com',
      'Bearer abcdefghijklmnop'
    ].join(' ');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(secretResponse)
      })
    );

    const { OpenAIAIProvider } = await import('@/infra/providers/ai/openai-ai-provider');
    const provider = new OpenAIAIProvider();

    await expect(
      provider.generateText({
        model: 'gpt-4.1-mini',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Hello'
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringContaining('OpenAI responses failed')
    });

    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).toContain('OpenAI responses request failed');
    expect(logged).not.toContain('sk_live_1234567890abcdef');
    expect(logged).not.toContain('whsec_1234567890abcdef');
    expect(logged).not.toContain('provider-token-secret');
    expect(logged).not.toContain('admin@example.com');
    expect(logged).not.toContain('abcdefghijklmnop');

    const thrown = await provider
      .generateText({
        model: 'gpt-4.1-mini',
        systemPrompt: 'You are helpful.',
        userPrompt: 'Hello'
      })
      .catch((error: unknown) => error);
    expect(String((thrown as Error).message)).not.toContain('sk_live_1234567890abcdef');
    expect(String((thrown as Error).message)).not.toContain('provider-token-secret');
  });
});
