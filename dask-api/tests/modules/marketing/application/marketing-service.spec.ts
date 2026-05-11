import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Lead } from '@prisma/client';
import { MarketingService } from '@/modules/marketing/application/marketing-service';
import type { MarketingRepository } from '@/modules/marketing/repositories/marketing-repository';

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
    score: 40,
    temperature: null,
    firstName: 'Maria',
    lastName: 'Silva',
    fullName: 'Maria Silva',
    email: 'maria@example.com',
    phone: null,
    companyName: 'Acme',
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

function makeRepositoryMock(): MarketingRepository {
  return {
    getDashboard: vi.fn(),
    listCampaigns: vi.fn(),
    findCampaignById: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    createCampaignVariant: vi.fn(),
    updateCampaignVariant: vi.fn(),
    listSegments: vi.fn(),
    findSegmentById: vi.fn(),
    createSegment: vi.fn(),
    updateSegment: vi.fn(),
    listTemplates: vi.fn(),
    findTemplateById: vi.fn(),
    findTemplateBySlug: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    listSenderProfiles: vi.fn(),
    findDefaultSenderProfile: vi.fn(),
    createSenderProfile: vi.fn(),
    listAudienceContacts: vi.fn(),
    listLeadsForSegment: vi.fn(),
    upsertContactPreference: vi.fn(),
    createCampaignSend: vi.fn(),
    listCampaignSends: vi.fn(),
    findCampaignSendById: vi.fn(),
    updateCampaignSend: vi.fn(),
    findCampaignSendByProviderMessageId: vi.fn(),
    createMarketingEvent: vi.fn(),
    findMarketingEventById: vi.fn(),
    listCampaignAnalytics: vi.fn(),
    createLeadActivity: vi.fn(),
    updateLeadFollowUp: vi.fn(),
    createLeadNurtureTouch: vi.fn(),
    updateLeadScore: vi.fn(),
    createLeadScoreEvent: vi.fn(),
    listWorkspaceDocuments: vi.fn(),
    listAutomationFlows: vi.fn(),
    findAutomationFlowById: vi.fn(),
    createAutomationFlow: vi.fn(),
    updateAutomationFlow: vi.fn(),
    createAutomationStep: vi.fn(),
    createAutomationEnrollment: vi.fn(),
    listSignalsInbox: vi.fn(),
    markSignal: vi.fn()
  } as unknown as MarketingRepository;
}

describe('MarketingService', () => {
  let repo: MarketingRepository;
  let service: MarketingService;
  let eventPublisher: {
    publish: Mock;
    publishInTransaction: Mock;
    publishManyInTransaction: Mock;
    runInTransaction: Mock;
  };
  let emailProvider: {
    key: string;
    sendEmail: Mock;
  };

  beforeEach(() => {
    repo = makeRepositoryMock();
    eventPublisher = {
      publish: vi.fn(),
      publishInTransaction: vi.fn(),
      publishManyInTransaction: vi.fn(),
      runInTransaction: vi.fn()
    };
    emailProvider = {
      key: 'mock',
      sendEmail: vi.fn()
    };

    service = new MarketingService({
      repo,
      eventPublisher: eventPublisher as unknown as any,
      jobQueue: {
        enqueue: vi.fn()
      },
      aiProvider: {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      },
      emailProvider
    });
  });

  it('creates campaign with default variant and sender profile', async () => {
    (repo.findDefaultSenderProfile as Mock).mockResolvedValue({
      id: 'sender-1',
      fromEmail: 'noreply@dask.app',
      fromName: 'Dask Marketing'
    });
    (repo.createCampaign as Mock).mockResolvedValue({ id: 'campaign-1', status: 'DRAFT' });
    (repo.createCampaignVariant as Mock).mockResolvedValue({ id: 'variant-1' });
    (repo.createMarketingEvent as Mock).mockResolvedValue({ id: 'event-1' });
    (repo.findCampaignById as Mock).mockResolvedValue({
      campaign: { id: 'campaign-1', status: 'DRAFT', name: 'Campanha 1' },
      variants: [{ id: 'variant-1', subject: 'Campanha 1', bodyMarkdown: 'Conteudo' }],
      segment: null,
      template: null,
      senderProfile: { id: 'sender-1', fromEmail: 'noreply@dask.app', fromName: 'Dask Marketing' },
      recentEvents: [],
      sends: []
    });

    const created = await service.createCampaign({
      workspaceId: 'workspace-1',
      name: 'Campanha 1',
      objective: 'LEAD_NURTURE',
      channel: 'EMAIL'
    });

    expect(created.campaign.id).toBe('campaign-1');
    expect(repo.createCampaignVariant).toHaveBeenCalledTimes(1);
  });

  it('launches campaign and queues sends', async () => {
    (repo.findCampaignById as Mock).mockResolvedValue({
      campaign: {
        id: 'campaign-1',
        status: 'APPROVED',
        name: 'Campanha 1',
        scheduledAt: null
      },
      variants: [{ id: 'variant-1', subject: 'Assunto', bodyMarkdown: 'Corpo', weight: 100, isControl: true }],
      segment: { id: 'segment-1', filters: { logic: 'AND', rules: [] } },
      template: null,
      senderProfile: { id: 'sender-1', fromEmail: 'noreply@dask.app', fromName: 'Dask Marketing' },
      recentEvents: [],
      sends: []
    });
    (repo.listLeadsForSegment as Mock).mockResolvedValue([
      makeLead({ id: 'lead-1', email: 'lead1@example.com' }),
      makeLead({ id: 'lead-2', email: null })
    ]);
    (repo.upsertContactPreference as Mock).mockResolvedValue({
      id: 'pref-1',
      consentStatus: 'OPT_IN',
      allowEmail: true
    });
    (repo.createCampaignSend as Mock).mockResolvedValue({ id: 'send-1' });
    (repo.createMarketingEvent as Mock).mockResolvedValue({ id: 'event-1' });
    (repo.createLeadActivity as Mock).mockResolvedValue({ id: 'activity-1' });
    (repo.updateCampaign as Mock).mockResolvedValue({ id: 'campaign-1', status: 'ACTIVE' });

    const result = await service.launchCampaign({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1'
    });

    expect(result.queued).toBe(1);
    expect(result.skippedWithoutEmail).toBe(1);
  });

  it('applies score change on click event', async () => {
    (repo.findCampaignSendByProviderMessageId as Mock).mockResolvedValue({
      id: 'send-1',
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      variantId: 'variant-1',
      leadId: 'lead-1',
      contactEmail: 'lead1@example.com'
    });
    (repo.updateCampaignSend as Mock).mockResolvedValue({ id: 'send-1', status: 'CLICKED' });
    (repo.createMarketingEvent as Mock).mockResolvedValue({ id: 'event-1' });
    (repo.listAudienceContacts as Mock).mockResolvedValue([
      { lead: makeLead({ id: 'lead-1', score: 50 }), preference: null, lastEventAt: null }
    ]);
    (repo.updateLeadScore as Mock).mockResolvedValue(makeLead({ id: 'lead-1', score: 56 }));
    (repo.createLeadScoreEvent as Mock).mockResolvedValue({ id: 'score-1' });
    (repo.createLeadActivity as Mock).mockResolvedValue({ id: 'activity-1' });

    await service.registerProviderEvent({
      workspaceId: 'workspace-1',
      provider: 'resend',
      providerMessageId: 'provider-1',
      eventType: 'EMAIL_CLICKED'
    });

    expect(repo.updateLeadScore).toHaveBeenCalledWith('workspace-1', 'lead-1', 56);
    expect(repo.createLeadScoreEvent).toHaveBeenCalledOnce();
  });

  it('sends a dedicated template test email with variables', async () => {
    (repo.findTemplateById as Mock).mockResolvedValue({
      id: 'template-1',
      subject: 'Ola {{lead.firstName}}',
      bodyMarkdown: 'Mensagem para {{companyName}}',
      bodyHtml: '<p>{{companyName}}</p>',
      isArchived: false
    });
    (repo.findDefaultSenderProfile as Mock).mockResolvedValue({
      id: 'sender-1',
      fromEmail: 'noreply@dask.app',
      fromName: 'Dask Marketing'
    });
    emailProvider.sendEmail.mockResolvedValue({
      providerKey: 'mock',
      messageId: 'message-1'
    });
    (repo.createMarketingEvent as Mock).mockResolvedValue({ id: 'event-1' });

    const result = await service.sendTemplateTestEmail({
      workspaceId: 'workspace-1',
      templateId: 'template-1',
      to: 'ana@example.com',
      variables: {
        'lead.firstName': 'Ana',
        companyName: 'Acme'
      },
      actorUserId: 'user-1'
    });

    expect(result.providerMessageId).toBe('message-1');
    expect(emailProvider.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ana@example.com',
      subject: 'Ola Ana',
      html: '<p>Acme</p>'
    }));
    expect(repo.createMarketingEvent).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        templateId: 'template-1',
        test: true
      })
    }));
  });

  it('creates a lead activity and optional work item for signal follow-up', async () => {
    const workspaceWorkItemsService = {
      createWorkItem: vi.fn().mockResolvedValue({ id: 'item-1' })
    };
    const followUpService = new MarketingService({
      repo,
      eventPublisher: eventPublisher as unknown as any,
      jobQueue: { enqueue: vi.fn() },
      aiProvider: {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      },
      emailProvider,
      workspaceWorkItemsService: workspaceWorkItemsService as unknown as any
    });

    (repo.findMarketingEventById as Mock).mockResolvedValue({
      id: 'signal-1',
      leadId: 'lead-1',
      type: 'EMAIL_CLICKED'
    });
    (repo.createLeadActivity as Mock).mockResolvedValue({
      id: 'activity-1',
      title: 'Retornar contato',
      description: 'Clique no email',
      occurredAt: new Date('2026-05-10T12:00:00.000Z')
    });
    (repo.updateLeadFollowUp as Mock).mockResolvedValue(makeLead({
      id: 'lead-1',
      status: 'FOLLOW_UP',
      nextFollowUpAt: new Date('2026-05-11T12:00:00.000Z')
    }));
    (repo.markSignal as Mock).mockResolvedValue(undefined);

    const result = await followUpService.createSignalFollowUp({
      workspaceId: 'workspace-1',
      eventId: 'signal-1',
      leadId: 'lead-1',
      title: 'Retornar contato',
      description: 'Clique no email',
      dueAt: new Date('2026-05-11T12:00:00.000Z'),
      priority: 'high',
      createWorkItem: true,
      actorUserId: 'user-1'
    });

    expect(result.workItemId).toBe('item-1');
    expect(workspaceWorkItemsService.createWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      payload: expect.objectContaining({
        title: 'Retornar contato',
        dueDate: new Date('2026-05-11T12:00:00.000Z')
      })
    }));
    expect(repo.createLeadActivity).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        workItemId: 'item-1',
        priority: 'high'
      })
    }));
  });

  it('publishes an automation workflow version when activating a marketing journey', async () => {
    const automationWorkflowService = {
      createWorkflow: vi.fn().mockResolvedValue({ id: 'workflow-1' }),
      updateWorkflow: vi.fn(),
      setWorkflowStatus: vi.fn()
    };
    const automationWorkflowVersionService = {
      createDraftVersion: vi.fn().mockResolvedValue({ id: 'version-draft-1' }),
      publishVersion: vi.fn().mockResolvedValue({
        id: 'version-published-1',
        publishedAt: new Date('2026-05-10T12:00:00.000Z')
      })
    };
    const runtimeService = new MarketingService({
      repo,
      eventPublisher: eventPublisher as unknown as any,
      jobQueue: { enqueue: vi.fn() },
      aiProvider: {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      },
      emailProvider,
      automationWorkflowService: automationWorkflowService as unknown as any,
      automationWorkflowVersionService: automationWorkflowVersionService as unknown as any
    });

    (repo.findAutomationFlowById as Mock).mockResolvedValue({
      id: 'flow-1',
      workspaceId: 'workspace-1',
      name: 'Boas-vindas',
      description: 'Primeiro contato',
      status: 'DRAFT',
      triggerDefinition: {
        status: 'DRAFT',
        trigger: { event: 'lead.created' },
        metadata: {
          compiledAt: '2026-05-10T11:00:00.000Z',
          runtimeGraph: {
            version: 1,
            nodes: [
              { id: 'trigger-1', type: 'trigger', config: { triggerType: 'lead_captured' } }
            ],
            edges: []
          }
        }
      }
    });
    (repo.updateAutomationFlow as Mock).mockResolvedValue({
      id: 'flow-1',
      status: 'ACTIVE'
    });

    await runtimeService.updateAutomationFlow({
      workspaceId: 'workspace-1',
      flowId: 'flow-1',
      status: 'ACTIVE',
      actorUserId: 'user-1'
    });

    expect(automationWorkflowService.createWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      name: 'Boas-vindas',
      status: 'draft'
    }));
    expect(automationWorkflowVersionService.createDraftVersion).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1'
    }));
    expect(automationWorkflowVersionService.publishVersion).toHaveBeenCalledWith(expect.objectContaining({
      workflowId: 'workflow-1',
      versionId: 'version-draft-1',
      activateWorkflow: true
    }));
    expect(repo.updateAutomationFlow).toHaveBeenCalledWith(
      'flow-1',
      'workspace-1',
      expect.objectContaining({
        status: 'ACTIVE',
        triggerDefinition: expect.objectContaining({
          metadata: expect.objectContaining({
            runtime: expect.objectContaining({
              workflowId: 'workflow-1',
              workflowVersionId: 'version-published-1',
              status: 'active'
            })
          })
        })
      })
    );
  });
});
