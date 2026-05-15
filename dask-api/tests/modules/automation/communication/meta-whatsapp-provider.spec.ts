import { describe, expect, it, vi } from 'vitest';
import { MetaWhatsAppProvider } from '@/modules/automation/communication/meta-whatsapp-provider';

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'ws-1',
    runId: 'run-1',
    stepRunId: 'step-1',
    channel: 'whatsapp' as const,
    to: '+55 (11) 99999-0000',
    body: 'Ola',
    ...overrides
  };
}

describe('MetaWhatsAppProvider', () => {
  it('sends a text WhatsApp message through Meta Cloud API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.123' }] })
    }));
    const provider = new MetaWhatsAppProvider({
      accessToken: 'token',
      phoneNumberId: 'phone-123',
      graphApiVersion: 'v23.0',
      fetch: fetchMock
    });

    const result = await provider.send(makeInput());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/phone-123/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json'
        })
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '5511999990000',
      type: 'text',
      text: { body: 'Ola', preview_url: false }
    });
    expect(result).toMatchObject({
      provider: 'meta',
      providerMessageId: 'wamid.123',
      status: 'sent'
    });
  });

  it('sends an approved template when provider template metadata is present', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.template' }] })
    }));
    const provider = new MetaWhatsAppProvider({
      accessToken: 'token',
      phoneNumberId: 'phone-123',
      fetch: fetchMock
    });

    await provider.send(makeInput({
      providerTemplateName: 'follow_up',
      providerTemplateParameters: ['Ana', 'P-123'],
      language: 'pt_BR'
    }));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      type: 'template',
      template: {
        name: 'follow_up',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Ana' },
              { type: 'text', text: 'P-123' }
            ]
          }
        ]
      }
    });
  });

  it('requires credentials when no injected client can bypass provider setup', () => {
    expect(() => new MetaWhatsAppProvider({
      phoneNumberId: 'phone-123'
    })).toThrow('META_WHATSAPP_ACCESS_TOKEN is required');
    expect(() => new MetaWhatsAppProvider({
      accessToken: 'token'
    })).toThrow('META_WHATSAPP_PHONE_NUMBER_ID is required');
  });

  it('classifies rate limit and 5xx Meta errors as retryable', async () => {
    const provider = new MetaWhatsAppProvider({
      accessToken: 'token',
      phoneNumberId: 'phone-123',
      fetch: vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Too many calls',
            code: '4',
            type: 'OAuthException',
            fbtrace_id: 'trace-1'
          }
        })
      }))
    });

    await expect(provider.send(makeInput())).rejects.toMatchObject({
      retryable: true,
      code: 'META_WHATSAPP_4',
      details: {
        statusCode: 429,
        type: 'OAuthException',
        fbtraceId: 'trace-1'
      }
    });
  });

  it('rejects malformed WhatsApp recipients without calling Meta', async () => {
    const fetchMock = vi.fn();
    const provider = new MetaWhatsAppProvider({
      accessToken: 'token',
      phoneNumberId: 'phone-123',
      fetch: fetchMock
    });

    await expect(provider.send(makeInput({ to: '123' }))).rejects.toMatchObject({
      retryable: false,
      code: 'INVALID_WHATSAPP_RECIPIENT'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
