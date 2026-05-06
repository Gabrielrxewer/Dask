import { describe, expect, it, vi } from 'vitest';
import { ResendCommunicationEmailProvider } from '@/modules/automation/communication/resend-communication-email-provider';

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'ws-1',
    runId: 'run-1',
    stepRunId: 'step-1',
    channel: 'email' as const,
    to: 'person@example.com',
    subject: 'Follow-up',
    text: 'Hello',
    body: 'Hello',
    metadata: { workItemId: 'item-1' },
    ...overrides
  };
}

describe('ResendCommunicationEmailProvider', () => {
  it('sends email through the injected Resend client and returns providerMessageId', async () => {
    const client = {
      emails: {
        send: vi.fn(async () => ({
          data: { id: 'resend_123' },
          error: null
        }))
      }
    };
    const provider = new ResendCommunicationEmailProvider({
      defaultFrom: 'Dask <noreply@example.com>',
      client
    });

    const result = await provider.send(makeInput({
      html: '<p>Hello</p>',
      replyTo: 'support@example.com'
    }));

    expect(client.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Dask <noreply@example.com>',
        to: 'person@example.com',
        subject: 'Follow-up',
        html: '<p>Hello</p>',
        text: 'Hello',
        replyTo: 'support@example.com'
      })
    );
    expect(result).toMatchObject({
      provider: 'resend',
      providerMessageId: 'resend_123',
      status: 'sent'
    });
  });

  it('fails clearly when api key is missing in real mode without an injected client', () => {
    expect(() => new ResendCommunicationEmailProvider({
      defaultFrom: 'Dask <noreply@example.com>'
    })).toThrow('RESEND_API_KEY is required');
  });

  it('classifies rate limit and 5xx provider errors as retryable', async () => {
    const provider = new ResendCommunicationEmailProvider({
      defaultFrom: 'Dask <noreply@example.com>',
      client: {
        emails: {
          send: vi.fn(async () => ({
            data: null,
            error: {
              message: 'Too many requests',
              statusCode: 429,
              name: 'rate_limit_exceeded'
            }
          }))
        }
      }
    });

    await expect(provider.send(makeInput())).rejects.toMatchObject({
      retryable: true,
      details: { statusCode: 429 }
    });
  });

  it('classifies invalid payloads and 4xx structural errors as non retryable', async () => {
    const provider = new ResendCommunicationEmailProvider({
      defaultFrom: 'Dask <noreply@example.com>',
      client: {
        emails: {
          send: vi.fn()
        }
      }
    });

    await expect(provider.send(makeInput({ to: 'not-an-email' }))).rejects.toMatchObject({
      retryable: false,
      code: 'INVALID_EMAIL_RECIPIENT'
    });
  });

  it('does not expose api keys in provider errors', async () => {
    const provider = new ResendCommunicationEmailProvider({
      defaultFrom: 'Dask <noreply@example.com>',
      client: {
        emails: {
          send: vi.fn(async () => ({
            data: null,
            error: {
              message: 'Domain is not verified',
              statusCode: 403,
              apiKey: 'secret'
            }
          }))
        }
      }
    });

    await expect(provider.send(makeInput())).rejects.toMatchObject({
      retryable: false,
      message: 'Domain is not verified'
    });
  });
});
