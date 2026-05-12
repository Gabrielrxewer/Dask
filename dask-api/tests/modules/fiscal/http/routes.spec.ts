import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMiddleware } from '@/core/http/error-middleware';
import { buildFiscalRoutes } from '@/modules/fiscal/http/routes';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';

function makeCompanyPayload() {
  return {
    displayName: 'Fiscal Ltda',
    legalName: 'Fiscal Ltda',
    cnpj: '12345678000190',
    focusToken: 'focus-token-value',
    focusEnvironment: 'homologacao',
    focusWebhookSecret: 'focus-webhook-secret',
    stripePolicy: 'manual_review'
  };
}

function makeApp(role: 'OWNER' | 'ADMIN') {
  const prisma = {
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue({
        role,
        permissions: {},
        workspace: {
          id: WORKSPACE_ID,
          key: 'fiscal',
          name: 'Fiscal',
          organizationId: null,
          kind: 'CORPORATE',
          config: {}
        }
      })
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        hasActiveSubscription: true,
        subscriptionPlan: 'BUSINESS'
      })
    }
  };
  const authorizationService = {
    can: vi.fn().mockResolvedValue(true)
  };
  const fiscalService = {
    createCompanyConfig: vi.fn().mockResolvedValue({
      id: 'company-config-1',
      workspaceId: WORKSPACE_ID,
      ...makeCompanyPayload(),
      provider: 'FOCUS',
      workspaceBusinessId: null,
      stateRegistration: null,
      municipalRegistration: null,
      taxRegime: null,
      focusCompanyReference: null,
      emitAutomatically: false,
      defaultSerie: null,
      defaultNatureOperation: null,
      fallbackRules: null,
      syncConfig: null,
      metadata: {
        focusToken: 'metadata-token',
        nested: {
          focusWebhookSecret: 'metadata-secret'
        }
      },
      createdByUserId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  };

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.auth = { userId: 'user-1' };
    next();
  });
  app.use(
    buildFiscalRoutes({
      prisma: prisma as any,
      authorizationService: authorizationService as any,
      fiscalService: fiscalService as any
    })
  );
  app.use(errorMiddleware);

  return { app, fiscalService };
}

async function requestJson(app: express.Express, path: string, body: Record<string, unknown>) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    return { status: response.status, payload };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

describe('fiscal/http routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows owners to configure fiscal company settings and masks secrets in the response', async () => {
    const { app, fiscalService } = makeApp('OWNER');

    const { status, payload } = await requestJson(
      app,
      `/fiscal/workspaces/${WORKSPACE_ID}/companies`,
      makeCompanyPayload()
    );

    expect(status).toBe(201);
    expect(fiscalService.createCompanyConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        focusEnvironment: 'homologacao',
        createdByUserId: 'user-1'
      })
    );
    expect(payload.focusToken).not.toBe('focus-token-value');
    expect(payload.focusWebhookSecret).not.toBe('focus-webhook-secret');
    expect(payload.metadata.focusToken).toBe('[REDACTED]');
    expect(payload.metadata.nested.focusWebhookSecret).toBe('[REDACTED]');
  });

  it('blocks non-owners from configuring fiscal company settings', async () => {
    const { app, fiscalService } = makeApp('ADMIN');

    const { status, payload } = await requestJson(
      app,
      `/fiscal/workspaces/${WORKSPACE_ID}/companies`,
      makeCompanyPayload()
    );

    expect(status).toBe(403);
    expect(payload.message).toBe('Forbidden');
    expect(fiscalService.createCompanyConfig).not.toHaveBeenCalled();
  });
});
