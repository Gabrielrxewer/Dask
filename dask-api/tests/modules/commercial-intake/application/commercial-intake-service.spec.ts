import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { CommercialIntakeService } from '@/modules/commercial-intake/application/commercial-intake-service';

const TEST_WEBHOOK_SECRET = 'test-commercial-secret';
const TEST_WEBHOOK_HEADERS = {
  'x-commercial-intake-secret': TEST_WEBHOOK_SECRET
};

function makeService(input?: {
  webhookSecret?: string;
  environment?: 'development' | 'test' | 'production';
  allowInsecureWebhooks?: boolean;
}) {
  const prisma = {
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue({ userId: 'owner-1' })
    },
    item: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    workItemType: {
      findFirst: vi.fn().mockResolvedValue({ slug: 'signal' })
    },
    workflowState: {
      findFirst: vi.fn().mockResolvedValue({ slug: 'prospect' })
    },
    customFieldDefinition: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'field-contact-name', slug: 'contactName' },
        { id: 'field-email', slug: 'contactEmail' },
        { id: 'field-source', slug: 'source' }
      ])
    }
  };
  const workspaceWorkItemsService = {
    createWorkItem: vi.fn().mockResolvedValue({ id: 'item-1' }),
    updateWorkItem: vi.fn().mockResolvedValue({ id: 'item-1' })
  };

  const service = new CommercialIntakeService({
    prisma: prisma as never,
    workspaceWorkItemsService: workspaceWorkItemsService as never,
    webhookSecret: input?.webhookSecret ?? TEST_WEBHOOK_SECRET,
    environment: input?.environment ?? 'test',
    allowInsecureWebhooks: input?.allowInsecureWebhooks ?? true
  });

  return { service, prisma, workspaceWorkItemsService };
}

describe('CommercialIntakeService', () => {
  it('rejects production webhooks when no secret is configured', async () => {
    const { service, prisma, workspaceWorkItemsService } = makeService({
      webhookSecret: '',
      environment: 'production',
      allowInsecureWebhooks: true
    });

    await expect(service.handleInboundWebhook({
      source: 'GENERIC_WEBHOOK',
      headers: {},
      payload: {
        workspaceId: 'workspace-1',
        eventId: 'signal-event-1'
      }
    })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Commercial intake webhook secret is required'
    });

    expect(prisma.workspaceMembership.findFirst).not.toHaveBeenCalled();
    expect(workspaceWorkItemsService.createWorkItem).not.toHaveBeenCalled();
  });

  it('requires explicit insecure mode for dev/test webhooks without a secret', async () => {
    const { service } = makeService({
      webhookSecret: '',
      environment: 'test',
      allowInsecureWebhooks: false
    });

    await expect(service.handleInboundWebhook({
      source: 'GENERIC_WEBHOOK',
      headers: {},
      payload: {
        workspaceId: 'workspace-1',
        eventId: 'signal-event-1'
      }
    })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Commercial intake webhook secret is required'
    });

    const allowed = makeService({
      webhookSecret: '',
      environment: 'test',
      allowInsecureWebhooks: true
    });

    await expect(allowed.service.handleInboundWebhook({
      source: 'GENERIC_WEBHOOK',
      headers: {},
      payload: {
        workspaceId: 'workspace-1',
        eventId: 'signal-event-1',
        signal: {
          type: 'signal',
          name: 'Maria Silva',
          email: 'maria@example.com',
          source: 'site'
        }
      }
    })).resolves.toEqual(expect.objectContaining({
      duplicate: false,
      workItemId: 'item-1'
    }));
  });

  it('creates a signal as a commercial WorkItem without storing raw inbound payload', async () => {
    const { service, workspaceWorkItemsService } = makeService();

    const result = await service.handleInboundWebhook({
      source: 'GENERIC_WEBHOOK',
      headers: TEST_WEBHOOK_HEADERS,
      payload: {
        workspaceId: 'workspace-1',
        eventId: 'signal-event-1',
        apiToken: 'super-secret-token',
        signal: {
          type: 'signal',
          name: 'Maria Silva',
          email: 'maria@example.com',
          phone: '+55 11 99999-0000',
          companyName: 'Acme',
          source: 'site',
          estimatedValue: '1234,56',
          password: 'do-not-store',
          message: 'Quero falar com vendas'
        }
      }
    });

    expect(result).toEqual(expect.objectContaining({
      workItemId: 'item-1',
      duplicate: false
    }));
    expect(workspaceWorkItemsService.createWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      userId: 'owner-1',
      payload: expect.objectContaining({
        title: 'Maria Silva',
        typeSlug: 'signal',
        stateSlug: 'prospect',
        fields: expect.objectContaining({
          contactName: 'Maria Silva',
          contactEmail: 'maria@example.com',
          companyName: 'Acme',
          source: 'site'
        }),
        metadata: {
          commercialIntake: expect.objectContaining({
            provider: 'GENERIC_WEBHOOK',
            eventId: 'signal-event-1',
            normalizedFieldKeys: expect.arrayContaining(['contactEmail', 'contactName', 'estimatedValue', 'source']),
            payloadSummary: expect.objectContaining({
              hasEmail: true,
              hasPhone: true,
              hasMessage: true,
              omittedSensitivePayloadKeyCount: 1,
              omittedSensitiveCommercialPayloadKeyCount: 1
            })
          })
        }
      })
    }));
    const payload = workspaceWorkItemsService.createWorkItem.mock.calls[0][0].payload;
    expect(payload.fields).toEqual(expect.objectContaining({
      contactName: 'Maria Silva',
      contactEmail: 'maria@example.com',
      contactPhone: '+55 11 99999-0000',
      companyName: 'Acme',
      estimatedValue: 1234.56
    }));
    expect(payload.metadata.commercialIntake).not.toHaveProperty('rawPayload');
    expect(JSON.stringify(payload.metadata)).not.toContain('super-secret-token');
    expect(JSON.stringify(payload.metadata)).not.toContain('do-not-store');
  });

  it('accepts a valid HMAC signature and rejects invalid signatures', async () => {
    const payload = {
      workspaceId: 'workspace-1',
      eventId: 'signal-event-1',
      signal: {
        type: 'signal',
        name: 'Maria Silva',
        email: 'maria@example.com',
        source: 'site'
      }
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const validSignature = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const valid = makeService();

    await expect(valid.service.handleInboundWebhook({
      source: 'GENERIC_WEBHOOK',
      headers: { 'x-dask-signature': `sha256=${validSignature}` },
      payload,
      rawBody
    })).resolves.toEqual(expect.objectContaining({
      duplicate: false,
      workItemId: 'item-1'
    }));

    const invalid = makeService();
    await expect(invalid.service.handleInboundWebhook({
      source: 'GENERIC_WEBHOOK',
      headers: { 'x-dask-signature': 'sha256=bad' },
      payload,
      rawBody
    })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Webhook signature is not authorized'
    });
    expect(invalid.workspaceWorkItemsService.createWorkItem).not.toHaveBeenCalled();
  });

  it('updates the existing WorkItem for an idempotent signal and strips legacy raw payload metadata', async () => {
    const { service, prisma, workspaceWorkItemsService } = makeService();
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      fields: {
        contactName: 'Nome antigo',
        untouched: 'keep'
      },
      metadata: {
        commercialIntake: {
          idempotencyKey: 'old-key',
          rawPayload: { email: 'secret@example.com' },
          payload: { token: 'legacy-token' },
          updateCount: 2
        }
      }
    });

    const result = await service.handleInboundWebhook({
      source: 'GENERIC_WEBHOOK',
      headers: TEST_WEBHOOK_HEADERS,
      payload: {
        workspaceId: 'workspace-1',
        eventId: 'signal-event-1',
        signal: {
          type: 'signal',
          name: 'Maria Silva',
          email: 'maria@example.com',
          source: 'site'
        }
      }
    });

    expect(result.duplicate).toBe(true);
    expect(workspaceWorkItemsService.createWorkItem).not.toHaveBeenCalled();
    expect(workspaceWorkItemsService.updateWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      userId: 'owner-1',
      payload: expect.objectContaining({
        typeSlug: 'signal',
        stateSlug: 'prospect',
        fields: expect.objectContaining({
          untouched: 'keep',
          contactName: 'Maria Silva',
          contactEmail: 'maria@example.com'
        })
      })
    }));

    const metadata = workspaceWorkItemsService.updateWorkItem.mock.calls[0][0].payload.metadata;
    expect(metadata.commercialIntake).not.toHaveProperty('rawPayload');
    expect(metadata.commercialIntake).not.toHaveProperty('payload');
    expect(JSON.stringify(metadata)).not.toContain('legacy-token');
    expect(metadata.commercialIntake).toEqual(expect.objectContaining({
      updateCount: 3,
      payloadSummary: expect.objectContaining({
        hasEmail: true
      })
    }));
  });
});
