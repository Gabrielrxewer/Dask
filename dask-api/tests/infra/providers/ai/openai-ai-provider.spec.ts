import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIAIProvider } from '@/infra/providers/ai/openai-ai-provider';

describe('OpenAIAIProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('omits temperature for GPT-5 responses requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        model: 'gpt-5-mini',
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '{"response":"ok","action":"chat","updatedDocument":null}' }]
          }
        ]
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIAIProvider();

    await provider.generateText({
      model: 'gpt-5-mini',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Reply in JSON.',
      temperature: 0.7,
      requireJsonOutput: true
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;

    expect(request.temperature).toBeUndefined();
    expect(request.text).toEqual({ format: { type: 'json_object' } });
  });

  it('uses the supported web search tool type for responses api', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        model: 'gpt-4.1-mini',
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'ok' }]
          }
        ]
      })
    });

    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIAIProvider();

    await provider.generateText({
      model: 'gpt-4.1-mini',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Search the web.',
      nativeTools: ['web_search']
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      tools?: Array<{ type: string }>;
    };

    expect(request.tools).toEqual([{ type: 'web_search_preview' }]);
  });
});
