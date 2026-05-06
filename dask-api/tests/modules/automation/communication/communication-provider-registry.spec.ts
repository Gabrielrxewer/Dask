import { describe, expect, it } from 'vitest';
import { CommunicationProviderRegistry } from '@/modules/automation/communication/communication-provider-registry';
import { createDefaultCommunicationProviderRegistry } from '@/modules/automation/communication/default-communication-provider-registry';
import { MockEmailProvider } from '@/modules/automation/communication/mock-email-provider';
import { MockWhatsAppProvider } from '@/modules/automation/communication/mock-whatsapp-provider';
import { ResendCommunicationEmailProvider } from '@/modules/automation/communication/resend-communication-email-provider';

describe('CommunicationProviderRegistry', () => {
  it('registers and resolves providers by channel/provider', () => {
    const registry = new CommunicationProviderRegistry();
    registry.register(new MockEmailProvider());

    expect(registry.resolve({ channel: 'email', provider: 'mock' })).toBeInstanceOf(MockEmailProvider);
    expect(registry.list()).toEqual([{ channel: 'email', provider: 'mock' }]);
  });

  it('throws clearly for missing providers', () => {
    const registry = new CommunicationProviderRegistry();

    expect(() => registry.resolve({ channel: 'email', provider: 'missing' })).toThrow(
      'Communication provider "missing" is not registered for channel "email".'
    );
  });

  it('keeps mock providers in mock mode and does not register resend', () => {
    const registry = createDefaultCommunicationProviderRegistry({
      emailSendMode: 'mock',
      emailProvider: 'mock'
    });

    expect(registry.resolve({ channel: 'email', provider: 'mock' })).toBeInstanceOf(MockEmailProvider);
    expect(() => registry.resolve({ channel: 'email', provider: 'resend' })).toThrow(
      'Communication provider "resend" is not registered for channel "email".'
    );
  });

  it('registers resend provider only when real mode is explicitly configured', () => {
    const registry = createDefaultCommunicationProviderRegistry({
      emailSendMode: 'real',
      emailProvider: 'resend',
      resendApiKey: 're_test_123',
      resendDefaultFrom: 'Dask <noreply@example.com>'
    });

    expect(registry.resolve({ channel: 'email', provider: 'mock' })).toBeInstanceOf(MockEmailProvider);
    expect(registry.resolve({ channel: 'email', provider: 'resend' })).toBeInstanceOf(
      ResendCommunicationEmailProvider
    );
  });
});

describe('mock communication providers', () => {
  it('mock email returns a fake provider message id', async () => {
    const result = await new MockEmailProvider().send({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      channel: 'email',
      to: 'person@example.com',
      subject: 'Hello',
      body: 'Body'
    });

    expect(result.providerMessageId).toMatch(/^mock_email_/);
    expect(result.status).toBe('mock_sent');
  });

  it('mock WhatsApp returns a fake provider message id', async () => {
    const result = await new MockWhatsAppProvider().send({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      channel: 'whatsapp',
      to: '+5511999999999',
      body: 'Body'
    });

    expect(result.providerMessageId).toMatch(/^mock_whatsapp_/);
    expect(result.status).toBe('mock_sent');
  });

  it('mock providers can simulate retryable and permanent failures', async () => {
    await expect(new MockEmailProvider().send({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      channel: 'email',
      to: 'person@example.com',
      body: 'Body',
      metadata: { simulateProviderError: 'retryable' }
    })).rejects.toMatchObject({ retryable: true });

    await expect(new MockWhatsAppProvider().send({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      channel: 'whatsapp',
      to: '+5511999999999',
      body: 'Body',
      metadata: { simulateProviderError: 'permanent' }
    })).rejects.toMatchObject({ retryable: false });
  });
});
