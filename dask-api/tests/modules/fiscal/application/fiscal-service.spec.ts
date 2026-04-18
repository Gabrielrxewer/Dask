import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { FiscalWebhookEvent } from '@prisma/client';
import { FiscalService } from '@/modules/fiscal/application/fiscal-service';
import type { FiscalProvider } from '@/modules/fiscal/providers/fiscal-provider';
import type { FiscalRepository } from '@/modules/fiscal/repositories/fiscal-repository';

function makeWebhookEvent(): FiscalWebhookEvent {
  return {
    id: 'wh-1',
    workspaceId: 'workspace-1',
    source: 'FOCUS',
    providerEventId: 'evt-focus-1',
    eventType: 'nfe.autorizada',
    idempotencyKey: 'focus:evt-focus-1',
    status: 'RECEIVED',
    headers: null,
    payload: {},
    signature: null,
    attempts: 1,
    processedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function makeProviderMock(): FiscalProvider {
  return {
    issueNfe: vi.fn(),
    issueNfse: vi.fn(),
    getDocumentStatus: vi.fn(),
    cancelDocument: vi.fn(),
    downloadXml: vi.fn(),
    downloadPdf: vi.fn(),
    syncReceivedNfe: vi.fn(),
    syncReceivedNfse: vi.fn(),
    handleWebhook: vi.fn(),
    registerCompany: vi.fn(),
    validateCompanyConfig: vi.fn()
  } as unknown as FiscalProvider;
}

function makeRepositoryMock(): FiscalRepository {
  return {
    findWebhookEventByIdempotencyKey: vi.fn(),
    createWebhookEvent: vi.fn(),
    findDocumentByReference: vi.fn(),
    updateDocumentStatus: vi.fn(),
    updateWebhookEvent: vi.fn()
  } as unknown as FiscalRepository;
}

describe('FiscalService', () => {
  let repo: FiscalRepository;
  let provider: FiscalProvider;
  let service: FiscalService;

  beforeEach(() => {
    repo = makeRepositoryMock();
    provider = makeProviderMock();

    service = new FiscalService({
      repo,
      provider,
      jobQueue: { enqueue: vi.fn() } as unknown as any,
      focusWebhookSecret: 'focus-secret-test'
    });
  });

  describe('handleFocusWebhook', () => {
    it('processes event once and marks duplicates by idempotency key', async () => {
      (provider.handleWebhook as Mock).mockReturnValue({
        sourceEventId: 'evt-focus-1',
        eventType: 'nfe.autorizada',
        workspaceId: 'workspace-1',
        documentReference: 'pedido-123',
        raw: {
          status: 'autorizada'
        }
      });
      (repo.findWebhookEventByIdempotencyKey as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeWebhookEvent());
      (repo.createWebhookEvent as Mock).mockResolvedValue(makeWebhookEvent());
      (repo.findDocumentByReference as Mock).mockResolvedValue(null);
      (repo.updateWebhookEvent as Mock).mockResolvedValue(makeWebhookEvent());

      const first = await service.handleFocusWebhook({
        payload: { event: 'nfe.autorizada', id: 'evt-focus-1' },
        headers: { 'x-focus-webhook-secret': 'focus-secret-test' }
      });

      const second = await service.handleFocusWebhook({
        payload: { event: 'nfe.autorizada', id: 'evt-focus-1' },
        headers: { 'x-focus-webhook-secret': 'focus-secret-test' }
      });

      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      expect(repo.createWebhookEvent).toHaveBeenCalledTimes(1);
    });

    it('rejects unauthorized focus webhook when secret is configured', async () => {
      (provider.handleWebhook as Mock).mockReturnValue({
        sourceEventId: 'evt-focus-2',
        eventType: 'nfe.autorizada',
        workspaceId: 'workspace-1',
        documentReference: 'pedido-123',
        raw: { status: 'autorizada' }
      });

      await expect(
        service.handleFocusWebhook({
          payload: { event: 'nfe.autorizada', id: 'evt-focus-2' },
          headers: { 'x-focus-webhook-secret': 'wrong-secret' }
        })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});

