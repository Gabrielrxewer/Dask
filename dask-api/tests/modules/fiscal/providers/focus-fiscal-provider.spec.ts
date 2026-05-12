import { afterEach, describe, expect, it, vi } from 'vitest';
import { FocusFiscalProvider } from '@/modules/fiscal/providers/focus/focus-fiscal-provider';

const company = {
  id: 'company-1',
  cnpj: '12345678000190',
  token: 'focus-token-secret',
  environment: 'homologacao',
  companyReference: null,
  webhookSecret: null
};

describe('FocusFiscalProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks real provider actions in production when Focus base URL was not explicitly configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new FocusFiscalProvider({
      baseUrl: null,
      environment: 'production',
      isBaseUrlExplicit: false,
      requireExplicitBaseUrl: true
    });

    await expect(
      provider.issueNfe({
        company,
        reference: 'pedido-1',
        payload: {}
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      message: 'Focus fiscal provider is not configured',
      details: {
        provider: 'FOCUS',
        missingEnv: ['FOCUS_API_BASE_URL']
      }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns safe provider errors without leaking upstream secrets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'raw upstream failure',
            focusToken: 'should-not-leak',
            cnpj: '12345678000190'
          }),
          {
            status: 500,
            headers: {
              'x-request-id': 'focus-request-1'
            }
          }
        )
      )
    );

    const provider = new FocusFiscalProvider({
      baseUrl: 'https://focus.example.test/v2',
      environment: 'production',
      isBaseUrlExplicit: true,
      requireExplicitBaseUrl: true,
      retryAttempts: 0,
      timeoutMs: 1000
    });

    await expect(
      provider.issueNfe({
        company,
        reference: 'pedido-1',
        payload: { focusToken: 'request-secret' }
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      message: 'Fiscal provider request failed',
      details: {
        provider: 'FOCUS',
        statusCode: 500,
        requestId: 'focus-request-1'
      }
    });
  });

  it('blocks production Focus calls when company sandbox environment does not match provider production env', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new FocusFiscalProvider({
      baseUrl: 'https://api.focusnfe.com.br/v2',
      environment: 'production',
      providerEnvironment: 'producao',
      isBaseUrlExplicit: true,
      requireExplicitBaseUrl: true
    });

    await expect(
      provider.issueNfe({
        company,
        reference: 'pedido-1',
        payload: {}
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Fiscal company environment does not match configured Focus API environment',
      details: {
        provider: 'FOCUS',
        configuredEnvironment: 'producao',
        companyEnvironment: 'homologacao'
      }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
