import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Lead, LeadIntegrationEvent } from '@prisma/client';
import { LeadsService } from '@/modules/leads/application/leads-service';
import type { LeadsRepository } from '@/modules/leads/repositories/leads-repository';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    workspaceId: 'workspace-1',
    externalSource: null,
    externalId: null,
    captureSource: 'MANUAL',
    status: 'CAPTURED',
    qualificationStatus: 'UNQUALIFIED',
    distributionStatus: 'UNASSIGNED',
    score: 0,
    temperature: null,
    firstName: null,
    lastName: null,
    fullName: 'Lead Teste',
    email: 'lead@example.com',
    phone: null,
    companyName: null,
    jobTitle: null,
    website: null,
    city: null,
    state: null,
    country: null,
    interest: null,
    notes: null,
    tags: null,
    ownerUserId: null,
    estimatedValue: null,
    currency: 'BRL',
    qualifiedAt: null,
    distributedAt: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    nurturingStartedAt: null,
    convertedAt: null,
    lostAt: null,
    metadata: null,
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function makeIntegrationEvent(overrides: Partial<LeadIntegrationEvent> = {}): LeadIntegrationEvent {
  return {
    id: 'event-1',
    workspaceId: 'workspace-1',
    leadId: null,
    source: 'GENERIC_WEBHOOK',
    eventType: 'lead.inbound',
    providerEventId: 'evt-1',
    idempotencyKey: 'GENERIC_WEBHOOK:evt-1',
    status: 'RECEIVED',
    headers: {},
    payload: {},
    attempts: 1,
    receivedAt: new Date(),
    processedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function makeRepositoryMock(): LeadsRepository {
  return {
    listLeads: vi.fn(),
    getDashboard: vi.fn(),
    findLeadById: vi.fn(),
    findLeadByExternal: vi.fn(),
    createLead: vi.fn(),
    updateLead: vi.fn(),
    createActivity: vi.fn(),
    createAssignment: vi.fn(),
    createNurtureTouch: vi.fn(),
    upsertConversion: vi.fn(),
    findIntegrationEventByIdempotencyKey: vi.fn(),
    createIntegrationEvent: vi.fn(),
    updateIntegrationEvent: vi.fn(),
    attachIntegrationEventToLead: vi.fn(),
    markIntegrationEventStatus: vi.fn()
  } as unknown as LeadsRepository;
}

describe('LeadsService', () => {
  let repo: LeadsRepository;
  let service: LeadsService;

  beforeEach(() => {
    repo = makeRepositoryMock();

    service = new LeadsService({
      repo,
      eventPublisher: {
        publish: vi.fn(),
        publishInTransaction: vi.fn(),
        publishManyInTransaction: vi.fn(),
        runInTransaction: vi.fn()
      } as unknown as any,
      webhookSecret: 'secret-123'
    });
  });

  it('captures lead and ignores duplicate external identifiers', async () => {
    (repo.findLeadByExternal as Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeLead({ id: 'lead-existing' }));
    (repo.createLead as Mock).mockResolvedValue(makeLead({ id: 'lead-created' }));
    (repo.createActivity as Mock).mockResolvedValue({ id: 'activity-1' });

    const created = await service.captureLead({
      workspaceId: 'workspace-1',
      source: 'API',
      externalSource: 'HUBSPOT',
      externalId: 'hub-1',
      fullName: 'Maria Teste',
      email: 'maria@example.com'
    });

    const duplicated = await service.captureLead({
      workspaceId: 'workspace-1',
      source: 'API',
      externalSource: 'HUBSPOT',
      externalId: 'hub-1',
      fullName: 'Maria Teste',
      email: 'maria@example.com'
    });

    expect(created.id).toBe('lead-created');
    expect(duplicated.id).toBe('lead-existing');
    expect(repo.createLead).toHaveBeenCalledTimes(1);
  });

  it('qualifies lead and updates score/status', async () => {
    (repo.findLeadById as Mock).mockResolvedValue({
      ...makeLead(),
      activities: [],
      assignments: [],
      nurtureTouches: [],
      conversion: null
    });
    (repo.updateLead as Mock).mockResolvedValue(
      makeLead({ status: 'QUALIFIED', qualificationStatus: 'MQL', score: 80 })
    );
    (repo.createActivity as Mock).mockResolvedValue({ id: 'activity-2' });

    const updated = await service.qualifyLead({
      workspaceId: 'workspace-1',
      leadId: 'lead-1',
      qualificationStatus: 'MQL',
      score: 80,
      qualifiedByUserId: 'user-1'
    });

    expect(updated.status).toBe('QUALIFIED');
    expect(updated.score).toBe(80);
    expect(repo.updateLead).toHaveBeenCalledOnce();
  });

  it('processes inbound webhook idempotently', async () => {
    (repo.findIntegrationEventByIdempotencyKey as Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeIntegrationEvent({ id: 'event-duplicate', leadId: 'lead-1' }));
    (repo.createIntegrationEvent as Mock).mockResolvedValue(makeIntegrationEvent({ id: 'event-1' }));
    (repo.findLeadByExternal as Mock).mockResolvedValue(null);
    (repo.createLead as Mock).mockResolvedValue(makeLead({ id: 'lead-webhook' }));
    (repo.createActivity as Mock).mockResolvedValue({ id: 'activity-3' });
    (repo.attachIntegrationEventToLead as Mock).mockResolvedValue(makeIntegrationEvent({ leadId: 'lead-webhook' }));
    (repo.markIntegrationEventStatus as Mock).mockResolvedValue(makeIntegrationEvent({ status: 'PROCESSED' }));

    const first = await service.handleInboundWebhook({
      source: 'N8N',
      headers: { 'x-leads-webhook-secret': 'secret-123' },
      payload: {
        eventId: 'evt-1',
        workspaceId: 'workspace-1',
        lead: {
          id: 'external-1',
          name: 'Lead via n8n',
          email: 'webhook@example.com'
        }
      }
    });

    const second = await service.handleInboundWebhook({
      source: 'N8N',
      headers: { 'x-leads-webhook-secret': 'secret-123' },
      payload: {
        eventId: 'evt-1',
        workspaceId: 'workspace-1',
        lead: {
          id: 'external-1',
          name: 'Lead via n8n',
          email: 'webhook@example.com'
        }
      }
    });

    expect(first.duplicate).toBe(false);
    expect(first.leadId).toBe('lead-webhook');
    expect(second.duplicate).toBe(true);
  });

  it('rejects webhook when secret is invalid', async () => {
    await expect(
      service.handleInboundWebhook({
        source: 'MAKE',
        headers: { 'x-leads-webhook-secret': 'invalid' },
        payload: {
          eventId: 'evt-2',
          workspaceId: 'workspace-1'
        }
      })
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
