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
    updateWebhookEvent: vi.fn(),
    createDocument: vi.fn(),
    createCompanyConfig: vi.fn(),
    findEmissionDraftByStripeSession: vi.fn(),
    createEmissionDraft: vi.fn(),
    listCompanyConfigs: vi.fn()
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

  describe('createCompanyConfig', () => {
    it('defaults Stripe fiscal policy to manual review', async () => {
      (repo.createCompanyConfig as Mock).mockImplementation(async (input) => ({
        id: 'company-config-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input
      }));

      await service.createCompanyConfig({
        workspaceId: 'workspace-1',
        displayName: 'Fiscal Ltda',
        legalName: 'Fiscal Ltda',
        cnpj: '12345678000190',
        focusToken: 'focus-token-value',
        focusEnvironment: 'homologacao',
        createdByUserId: 'user-1'
      });

      expect(repo.createCompanyConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          emitAutomatically: false,
          stripePolicy: 'manual_review'
        })
      );
    });
  });

  describe('createDocument', () => {
    it('redacts fiscal secrets and personal data before persisting snapshots', async () => {
      (repo.findDocumentByReference as Mock).mockResolvedValue(null);
      (repo.createDocument as Mock).mockImplementation(async (input) => ({
        id: 'document-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input
      }));

      await service.createDocument({
        workspaceId: 'workspace-1',
        internalReference: 'pedido-123',
        direction: 'OUTBOUND',
        documentType: 'NFE',
        origin: 'MANUAL_PRODUCT',
        requestPayloadSnapshot: {
          focusToken: 'focus-token-secret',
          customerEmail: 'client@example.com'
        },
        responsePayloadSnapshot: {
          authorization: 'Bearer provider-secret'
        },
        providerPayloadRaw: {
          password: 'provider-password',
          nested: {
            webhookSecret: 'focus-webhook-secret'
          }
        },
        metadata: {
          apiKey: 'metadata-api-key',
          contactEmail: 'finance@example.com'
        },
        createdByUserId: 'user-1'
      });

      const persisted = (repo.createDocument as Mock).mock.calls[0][0];
      const serialized = JSON.stringify(persisted);
      expect(serialized).not.toContain('focus-token-secret');
      expect(serialized).not.toContain('provider-secret');
      expect(serialized).not.toContain('provider-password');
      expect(serialized).not.toContain('focus-webhook-secret');
      expect(serialized).not.toContain('metadata-api-key');
      expect(serialized).not.toContain('client@example.com');
      expect(serialized).not.toContain('finance@example.com');
      expect(serialized).toContain('[REDACTED]');
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
          status: 'autorizada',
          focusToken: 'raw-focus-token'
        }
      });
      (repo.findWebhookEventByIdempotencyKey as Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeWebhookEvent());
      (repo.createWebhookEvent as Mock).mockResolvedValue(makeWebhookEvent());
      (repo.findDocumentByReference as Mock).mockResolvedValue(null);
      (repo.updateWebhookEvent as Mock).mockResolvedValue(makeWebhookEvent());

      const first = await service.handleFocusWebhook({
        payload: { event: 'nfe.autorizada', id: 'evt-focus-1', token: 'payload-secret' },
        headers: { 'x-focus-webhook-secret': 'focus-secret-test', 'x-focus-signature': 'signature-secret' }
      });

      const second = await service.handleFocusWebhook({
        payload: { event: 'nfe.autorizada', id: 'evt-focus-1' },
        headers: { 'x-focus-webhook-secret': 'focus-secret-test' }
      });

      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      expect(repo.createWebhookEvent).toHaveBeenCalledTimes(1);

      const eventInput = (repo.createWebhookEvent as Mock).mock.calls[0][0];
      expect(JSON.stringify(eventInput)).not.toContain('focus-secret-test');
      expect(JSON.stringify(eventInput)).not.toContain('signature-secret');
      expect(JSON.stringify(eventInput)).not.toContain('payload-secret');
      expect(eventInput.signature).toBe('[REDACTED]');
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

  describe('handleStripeFiscalWebhook', () => {
    it('redacts Stripe checkout metadata before persisting emission draft payloads', async () => {
      const stripeEvent = {
        id: 'evt-stripe-1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            mode: 'payment',
            payment_intent: 'pi_test_1',
            amount_total: 10990,
            currency: 'brl',
            customer_details: {
              name: 'Cliente Teste',
              email: 'client@example.com',
              phone: '+5511999999999',
              tax_ids: [{ value: '12345678909' }]
            },
            metadata: {
              workspace_id: 'workspace-1',
              apiKey: 'stripe-metadata-secret',
              customer_email: 'client@example.com'
            }
          }
        }
      };
      const stripe = {
        webhooks: {
          constructEvent: vi.fn().mockReturnValue(stripeEvent)
        },
        checkout: {
          sessions: {
            listLineItems: vi.fn().mockResolvedValue({ data: [] })
          }
        }
      };
      service = new FiscalService({
        repo,
        provider,
        jobQueue: { enqueue: vi.fn() } as unknown as any,
        stripe: stripe as never,
        stripeWebhookSecret: 'stripe-webhook-secret',
        focusWebhookSecret: 'focus-secret-test'
      });
      (repo.findWebhookEventByIdempotencyKey as Mock).mockResolvedValue(null);
      (repo.createWebhookEvent as Mock).mockResolvedValue({ ...makeWebhookEvent(), id: 'wh-stripe-1', source: 'STRIPE' });
      (repo.updateWebhookEvent as Mock).mockResolvedValue({ ...makeWebhookEvent(), id: 'wh-stripe-1', source: 'STRIPE' });
      (repo.findEmissionDraftByStripeSession as Mock).mockResolvedValue(null);
      (repo.listCompanyConfigs as Mock).mockResolvedValue([{
        id: 'company-config-1',
        workspaceId: 'workspace-1',
        workspaceBusinessId: null,
        displayName: 'Fiscal Ltda',
        legalName: 'Fiscal Ltda',
        cnpj: '12345678000190',
        stateRegistration: null,
        municipalRegistration: null,
        taxRegime: null,
        focusToken: 'focus-token-secret',
        focusEnvironment: 'homologacao',
        focusCompanyReference: null,
        focusWebhookSecret: null,
        emitAutomatically: false,
        stripePolicy: 'manual_review',
        defaultSerie: null,
        defaultNatureOperation: null,
        fallbackRules: null,
        syncConfig: null,
        metadata: null,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
      (repo.createEmissionDraft as Mock).mockImplementation(async (input) => ({
        id: 'draft-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input
      }));

      await service.handleStripeFiscalWebhook(Buffer.from('{}'), 'stripe-signature-secret');

      const draftInput = (repo.createEmissionDraft as Mock).mock.calls[0][0];
      const serialized = JSON.stringify(draftInput);
      expect(serialized).not.toContain('stripe-metadata-secret');
      expect(serialized).not.toContain('client@example.com');
      expect(serialized).not.toContain('+5511999999999');
      expect(serialized).not.toContain('12345678909');
      expect(serialized).toContain('[REDACTED]');
    });
  });
});
