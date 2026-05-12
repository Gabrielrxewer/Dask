import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { MarketingService } from '@/modules/marketing/application/marketing-service';
import type { MarketingCommercialContact } from '@/modules/marketing/domain/types';
import type { MarketingRepository } from '@/modules/marketing/repositories/marketing-repository';

function makeContact(overrides: Partial<MarketingCommercialContact> = {}): MarketingCommercialContact {
  return {
    id: 'item-1',
    workspaceId: 'workspace-1',
    workItemId: 'item-1',
    customerId: null,
    captureSource: 'MANUAL',
    status: 'commercial_intake',
    score: 40,
    temperature: null,
    firstName: 'Maria',
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
    tags: [],
    ownerUserId: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    metadata: {},
    createdByUserId: 'user-1',
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
    listContactsForSegment: vi.fn(),
    upsertContactPreference: vi.fn(),
    createCampaignSend: vi.fn(),
    listCampaignSends: vi.fn(),
    findCampaignSendById: vi.fn(),
    updateCampaignSend: vi.fn(),
    findCampaignSendByProviderMessageId: vi.fn(),
    createMarketingEvent: vi.fn(),
    findMarketingEventById: vi.fn(),
    listCampaignAnalytics: vi.fn(),
    createWorkItemActivity: vi.fn(),
    updateWorkItemFollowUp: vi.fn(),
    updateWorkItemScore: vi.fn(),
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
      eventPublisher,
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
      objective: 'COMMERCIAL_NURTURE',
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
    (repo.listContactsForSegment as Mock).mockResolvedValue([
      makeContact({ id: 'item-1', workItemId: 'item-1', email: 'contact1@example.com' }),
      makeContact({ id: 'item-2', workItemId: 'item-2', email: null })
    ]);
    (repo.upsertContactPreference as Mock).mockResolvedValue({
      id: 'pref-1',
      consentStatus: 'OPT_IN',
      allowEmail: true
    });
    (repo.createCampaignSend as Mock).mockResolvedValue({ id: 'send-1' });
    (repo.createMarketingEvent as Mock).mockResolvedValue({ id: 'event-1' });
    (repo.createWorkItemActivity as Mock).mockResolvedValue({ id: 'activity-1' });
    (repo.updateCampaign as Mock).mockResolvedValue({ id: 'campaign-1', status: 'ACTIVE' });

    const result = await service.launchCampaign({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1'
    });

    expect(result.queued).toBe(1);
    expect(result.skippedWithoutEmail).toBe(1);
    expect(repo.createCampaignSend).toHaveBeenCalledWith(
      expect.objectContaining({
        workItemId: 'item-1',
        contactEmail: 'contact1@example.com'
      })
    );
    expect(repo.createCampaignSend).toHaveBeenCalledWith(expect.not.objectContaining({ leadId: expect.anything() }));
  });

  it('applies score change on click event', async () => {
    (repo.findCampaignSendByProviderMessageId as Mock).mockResolvedValue({
      id: 'send-1',
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      variantId: 'variant-1',
      contactEmail: 'contact1@example.com',
      metadata: {
        sourceWorkItemId: 'item-1'
      }
    });
    (repo.updateCampaignSend as Mock).mockResolvedValue({ id: 'send-1', status: 'CLICKED' });
    (repo.createMarketingEvent as Mock).mockResolvedValue({ id: 'event-1' });
    (repo.listAudienceContacts as Mock).mockResolvedValue([
      { contact: makeContact({ id: 'item-1', workItemId: 'item-1', score: 50 }), preference: null, lastEventAt: null }
    ]);
    (repo.updateWorkItemScore as Mock).mockResolvedValue(makeContact({ id: 'item-1', workItemId: 'item-1', score: 56 }));
    (repo.createWorkItemActivity as Mock).mockResolvedValue({ id: 'activity-1' });

    await service.registerProviderEvent({
      workspaceId: 'workspace-1',
      provider: 'resend',
      providerMessageId: 'provider-1',
      eventType: 'EMAIL_CLICKED'
    });

    expect(repo.updateWorkItemScore).toHaveBeenCalledWith('workspace-1', 'item-1', 56);
    expect(repo.createWorkItemActivity).toHaveBeenCalledWith(expect.objectContaining({
      workItemId: 'item-1',
      title: 'Score comercial atualizado'
    }));
  });

  it('sends a dedicated template test email with variables', async () => {
    (repo.findTemplateById as Mock).mockResolvedValue({
      id: 'template-1',
      subject: 'Ola {{contact.firstName}}',
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
        'contact.firstName': 'Ana',
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

  it('creates a work item activity and optional work item for signal follow-up', async () => {
    const workspaceWorkItemsService = {
      createWorkItem: vi.fn().mockResolvedValue({ id: 'item-1' })
    };
    const followUpService = new MarketingService({
      repo,
      eventPublisher,
      jobQueue: { enqueue: vi.fn() },
      aiProvider: {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      },
      emailProvider,
      workspaceWorkItemsService
    });

    (repo.findMarketingEventById as Mock).mockResolvedValue({
      id: 'signal-1',
      itemId: 'item-1',
      type: 'EMAIL_CLICKED'
    });
    (repo.createWorkItemActivity as Mock).mockResolvedValue({
      id: 'activity-1',
      title: 'Retornar contato',
      description: 'Clique no email',
      occurredAt: new Date('2026-05-10T12:00:00.000Z')
    });
    (repo.updateWorkItemFollowUp as Mock).mockResolvedValue({
      id: 'item-1',
      status: 'commercial_qualification',
      lastContactAt: new Date('2026-05-10T12:00:00.000Z'),
      nextFollowUpAt: new Date('2026-05-11T12:00:00.000Z')
    });
    (repo.markSignal as Mock).mockResolvedValue(undefined);

    const result = await followUpService.createSignalFollowUp({
      workspaceId: 'workspace-1',
      eventId: 'signal-1',
      workItemId: 'item-1',
      title: 'Retornar contato',
      description: 'Clique no email',
      dueAt: new Date('2026-05-11T12:00:00.000Z'),
      priority: 'high',
      createWorkItem: true,
      actorUserId: 'user-1'
    });

    expect(result.sourceWorkItemId).toBe('item-1');
    expect(result.createdFollowUpWorkItemId).toBe('item-1');
    expect(result).not.toHaveProperty('leadId');
    expect(result).not.toHaveProperty('lead');
    expect(workspaceWorkItemsService.createWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      payload: expect.objectContaining({
        title: 'Retornar contato',
        dueDate: new Date('2026-05-11T12:00:00.000Z'),
        fields: expect.objectContaining({
          sourceWorkItemId: 'item-1'
        })
      })
    }));
    expect(repo.createWorkItemActivity).toHaveBeenCalledWith(expect.objectContaining({
      workItemId: 'item-1',
      payload: expect.objectContaining({
        createdFollowUpWorkItemId: 'item-1',
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
      eventPublisher,
      jobQueue: { enqueue: vi.fn() },
      aiProvider: {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      },
      emailProvider,
      automationWorkflowService,
      automationWorkflowVersionService
    });

    (repo.findAutomationFlowById as Mock).mockResolvedValue({
      id: 'flow-1',
      workspaceId: 'workspace-1',
      name: 'Boas-vindas',
      description: 'Primeiro contato',
      status: 'DRAFT',
      triggerDefinition: {
        version: 1,
        trigger: { event: 'commercial_work_item.created' },
        nodes: [
          { id: 'trigger-1', type: 'TRIGGER', data: { kind: 'TRIGGER', config: { event: 'commercial_work_item.created' } } },
          { id: 'send-1', type: 'ACTION', data: { kind: 'ACTION', config: { type: 'send_campaign', campaignId: 'campaign-1' } } },
          { id: 'end', type: 'EXIT', data: { kind: 'EXIT', config: {} } }
        ],
        edges: [
          { id: 'edge-trigger-send', source: 'trigger-1', target: 'send-1' },
          { id: 'edge-send-end', source: 'send-1', target: 'end' }
        ],
        metadata: {
          compiledAt: '2026-05-10T11:00:00.000Z'
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
      workflowId: 'workflow-1',
      definition: expect.objectContaining({
        schemaVersion: 1,
        definitionType: 'automation_workflow',
        source: expect.objectContaining({
          kind: 'marketing_journey',
          flowId: 'flow-1'
        }),
        graph: expect.objectContaining({
          version: 1,
          metadata: expect.objectContaining({
            source: 'marketing_journey',
            flowId: 'flow-1',
            triggerCount: 1
          })
        })
      }),
      graph: expect.objectContaining({
        version: 1,
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'trigger-1', type: 'trigger' }),
          expect.objectContaining({ id: 'send-1', type: 'communication_send' }),
          expect.objectContaining({ id: 'end', type: 'end' })
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ id: 'edge-trigger-send', source: 'trigger-1', target: 'send-1' }),
          expect.objectContaining({ id: 'edge-send-end', source: 'send-1', target: 'end' })
        ])
      })
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

  it('does not activate a marketing journey when runtime compilation fails', async () => {
    const automationWorkflowService = {
      createWorkflow: vi.fn().mockResolvedValue({ id: 'workflow-1' }),
      updateWorkflow: vi.fn(),
      setWorkflowStatus: vi.fn()
    };
    const automationWorkflowVersionService = {
      createDraftVersion: vi.fn().mockResolvedValue({ id: 'version-draft-1' }),
      publishVersion: vi.fn()
    };
    const runtimeService = new MarketingService({
      repo,
      eventPublisher,
      jobQueue: { enqueue: vi.fn() },
      aiProvider: {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      },
      emailProvider,
      automationWorkflowService,
      automationWorkflowVersionService
    });

    (repo.findAutomationFlowById as Mock).mockResolvedValue({
      id: 'flow-1',
      workspaceId: 'workspace-1',
      name: 'Boas-vindas',
      description: 'Primeiro contato',
      status: 'DRAFT',
      triggerDefinition: {
        version: 1,
        trigger: { event: 'commercial_work_item.created' },
        nodes: [
          { id: 'trigger-1', type: 'TRIGGER', data: { kind: 'TRIGGER', config: { event: 'commercial_work_item.created' } } },
          { id: 'send-1', type: 'ACTION', data: { kind: 'ACTION', config: { type: 'send_campaign' } } },
          { id: 'end', type: 'EXIT', data: { kind: 'EXIT', config: {} } }
        ],
        edges: [
          { id: 'edge-trigger-send', source: 'trigger-1', target: 'send-1' },
          { id: 'edge-send-end', source: 'send-1', target: 'end' }
        ],
        metadata: {}
      }
    });

    await expect(runtimeService.updateAutomationFlow({
      workspaceId: 'workspace-1',
      flowId: 'flow-1',
      status: 'ACTIVE',
      actorUserId: 'user-1'
    })).rejects.toThrowError(/campaignId/);

    expect(automationWorkflowService.createWorkflow).not.toHaveBeenCalled();
    expect(automationWorkflowVersionService.createDraftVersion).not.toHaveBeenCalled();
    expect(automationWorkflowVersionService.publishVersion).not.toHaveBeenCalled();
    expect(repo.updateAutomationFlow).not.toHaveBeenCalled();
  });
});
