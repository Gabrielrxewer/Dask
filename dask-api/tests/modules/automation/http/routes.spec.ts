import type { Router } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { buildAutomationRoutes } from '@/modules/automation/http/routes';

const UUIDS = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  workflowId: '22222222-2222-4222-8222-222222222222',
  viewId: '33333333-3333-4333-8333-333333333333',
  columnId: '44444444-4444-4444-8444-444444444444',
  itemId: '55555555-5555-4555-8555-555555555555',
  versionId: '77777777-7777-4777-8777-777777777777',
  runId: '66666666-6666-4666-8666-666666666666',
  sideEffectId: '88888888-8888-4888-8888-888888888888'
};

const graph = {
  version: 1,
  nodes: [
    { id: 'trigger-manual', type: 'trigger', config: { triggerType: 'manual' } },
    { id: 'end', type: 'end', config: {} }
  ],
  edges: [{ id: 'edge-trigger-end', source: 'trigger-manual', target: 'end' }],
  metadata: {}
} as const;

function makeDeps() {
  const prisma = {
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue({
        role: 'ADMIN',
        permissions: {},
        workspace: { config: {} }
      })
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ subscriptionPlan: 'BUSINESS' })
    },
    communicationTemplate: {
      findMany: vi.fn().mockResolvedValue([{
        id: 'template-1',
        channel: 'whatsapp',
        versions: [{ id: UUIDS.versionId, approvalStatus: 'draft' }]
      }]),
      create: vi.fn().mockResolvedValue({
        id: 'template-1',
        workspaceId: UUIDS.workspaceId,
        channel: 'whatsapp',
        language: 'pt_BR',
        providerTemplateName: 'proposal_followup'
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'template-1',
        workspaceId: UUIDS.workspaceId,
        channel: 'whatsapp',
        language: 'pt_BR',
        providerTemplateName: 'proposal_followup'
      }),
      update: vi.fn().mockResolvedValue({ id: 'template-1' })
    },
    communicationTemplateVersion: {
      aggregate: vi.fn().mockResolvedValue({ _max: { version: 0 } }),
      create: vi.fn().mockResolvedValue({ id: UUIDS.versionId, status: 'draft' }),
      findFirst: vi.fn().mockResolvedValue({
        id: UUIDS.versionId,
        workspaceId: UUIDS.workspaceId,
        templateId: 'template-1',
        status: 'draft',
        approvalStatus: 'draft',
        subject: null,
        textBody: 'Ola {{contact.name}}',
        htmlBody: null,
        variablesJson: ['contact.name'],
        template: { id: 'template-1', channel: 'whatsapp' }
      }),
      update: vi.fn().mockResolvedValue({ id: UUIDS.versionId, approvalStatus: 'approved' })
    },
    contactConsent: {
      findMany: vi.fn().mockResolvedValue([{
        id: 'consent-1',
        workspaceId: UUIDS.workspaceId,
        channel: 'whatsapp',
        address: '+5549999999999',
        status: 'opted_in'
      }]),
      upsert: vi.fn().mockResolvedValue({
        id: 'consent-1',
        workspaceId: UUIDS.workspaceId,
        channel: 'whatsapp',
        address: '+5549999999999',
        status: 'opted_in'
      })
    },
    automationSideEffect: {
      findFirst: vi.fn().mockResolvedValue({
        id: UUIDS.sideEffectId,
        workspaceId: UUIDS.workspaceId,
        runId: UUIDS.runId,
        stepRunId: 'step-1',
        channel: 'whatsapp',
        provider: 'mock',
        status: 'sent',
        payloadJson: { to: '+5549999999999' },
        resultJson: { providerMessageId: 'mock-1' },
        contactId: null,
        contactChannelId: null
      }),
      update: vi.fn().mockResolvedValue({ id: UUIDS.sideEffectId, status: 'sent' })
    },
    communicationProviderEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'provider-event-1' }),
      update: vi.fn().mockResolvedValue({ id: 'provider-event-1', status: 'processed' })
    },
    communicationContactChannel: {
      findMany: vi.fn().mockResolvedValue([])
    },
    communicationInteraction: {
      create: vi.fn().mockResolvedValue({ id: 'interaction-1' })
    },
    automationRunEvent: {
      create: vi.fn().mockResolvedValue({ id: 'event-1' })
    }
  };
  const authorizationService = {
    can: vi.fn().mockResolvedValue(true)
  };

  const automationWorkflowService = {
    listWorkflows: vi.fn().mockResolvedValue([{ id: UUIDS.workflowId, name: 'Follow-up' }]),
    createWorkflow: vi.fn().mockResolvedValue({ id: UUIDS.workflowId }),
    getWorkflow: vi.fn().mockResolvedValue({ id: UUIDS.workflowId }),
    updateWorkflow: vi.fn().mockResolvedValue({ id: UUIDS.workflowId }),
    setWorkflowStatus: vi.fn().mockResolvedValue({ id: UUIDS.workflowId, status: 'active' }),
    archiveWorkflow: vi.fn().mockResolvedValue({ id: UUIDS.workflowId, status: 'archived' })
  };

  const automationWorkflowVersionService = {
    listVersions: vi.fn().mockResolvedValue([{ id: UUIDS.versionId, status: 'draft' }]),
    createDraftVersion: vi.fn().mockResolvedValue({ id: UUIDS.versionId, status: 'draft' }),
    getVersion: vi.fn().mockResolvedValue({ id: UUIDS.versionId }),
    updateDraftVersion: vi.fn().mockResolvedValue({ id: UUIDS.versionId, status: 'draft' }),
    publishVersion: vi.fn().mockResolvedValue({ id: UUIDS.versionId, status: 'published' }),
    cloneVersion: vi.fn().mockResolvedValue({ id: UUIDS.versionId, status: 'draft' })
  };

  const automationWorkflowRunnerService = {
    startRun: vi.fn().mockResolvedValue({
      run: { id: UUIDS.runId, status: 'completed' },
      executionResult: { status: 'completed', executedNodeIds: ['trigger-manual', 'end'] }
    })
  };

  const automationRunService = {
    cancelRun: vi.fn().mockResolvedValue({ id: UUIDS.runId })
  };

  const automationRunObservabilityService = {
    listRuns: vi.fn().mockResolvedValue({ items: [{ runId: UUIDS.runId }] }),
    getRunDetail: vi.fn().mockResolvedValue({ run: { runId: UUIDS.runId } }),
    listEvents: vi.fn().mockResolvedValue({ items: [{ id: 'event-1' }] }),
    listSteps: vi.fn().mockResolvedValue({ items: [{ id: 'step-1' }] }),
    listSideEffects: vi.fn().mockResolvedValue({ items: [{ id: 'side-effect-1' }] })
  };

  const automationViewService = {
    listViews: vi.fn().mockResolvedValue([{ id: 'view-1' }]),
    createView: vi.fn().mockResolvedValue({ id: 'view-1' }),
    updateView: vi.fn().mockResolvedValue({ id: 'view-1' }),
    listViewColumns: vi.fn().mockResolvedValue([{ id: 'col-1' }]),
    createViewColumn: vi.fn().mockResolvedValue({ id: 'col-1' }),
    updateViewColumn: vi.fn().mockResolvedValue({ id: 'col-1' }),
    listItemPlacements: vi.fn().mockResolvedValue([{ id: 'placement-1' }]),
    upsertItemPlacement: vi.fn().mockResolvedValue({ id: 'placement-1' }),
    removeItemPlacement: vi.fn().mockResolvedValue(undefined)
  };

  const router = buildAutomationRoutes({
    prisma: prisma as any,
    authorizationService: authorizationService as any,
    automationWorkflowService: automationWorkflowService as any,
    automationWorkflowVersionService: automationWorkflowVersionService as any,
    automationWorkflowRunnerService: automationWorkflowRunnerService as any,
    automationRunService: automationRunService as any,
    automationRunObservabilityService: automationRunObservabilityService as any,
    automationViewService: automationViewService as any
  });

  return {
    router,
    prisma,
    automationWorkflowService,
    automationWorkflowVersionService,
    automationWorkflowRunnerService,
    automationRunService,
    automationRunObservabilityService,
    automationViewService
  };
}

function getRouteHandler(router: Router, method: string, path: string) {
  const layer = (router as any).stack.find(
    (entry: any) => entry.route?.path === path && entry.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
}

async function invokeRoute(
  router: Router,
  method: string,
  path: string,
  request: {
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  }
) {
  const handler = getRouteHandler(router, method, path);
  const req: any = {
    params: request.params ?? {},
    query: request.query ?? {},
    body: request.body ?? {},
    auth: {
      userId: 'user-1'
    }
  };
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
  const next = vi.fn();

  handler(req, res, next);
  await new Promise<void>((resolve) => setImmediate(resolve));

  expect(next).not.toHaveBeenCalled();
  return { res };
}

describe('automation/http routes', () => {
  it('handles workflow CRUD/status endpoints', async () => {
    const { router, automationWorkflowService } = makeDeps();

    {
      const { res } = await invokeRoute(router, 'get', '/workspaces/:workspaceId/automation-workflows', {
        params: { workspaceId: UUIDS.workspaceId },
        query: { status: 'active', limit: '20' }
      });
      expect(automationWorkflowService.listWorkflows).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        status: 'active',
        limit: 20
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ items: [{ id: UUIDS.workflowId, name: 'Follow-up' }] });
    }

    {
      const { res } = await invokeRoute(router, 'post', '/workspaces/:workspaceId/automation-workflows', {
        params: { workspaceId: UUIDS.workspaceId },
        body: {
          name: 'Follow-up de proposta',
          description: 'Comercial',
          status: 'draft'
        }
      });
      expect(automationWorkflowService.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: UUIDS.workspaceId,
          name: 'Follow-up de proposta',
          createdById: 'user-1'
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    }

    {
      await invokeRoute(router, 'get', '/workspaces/:workspaceId/automation-workflows/:workflowId', {
        params: { workspaceId: UUIDS.workspaceId, workflowId: UUIDS.workflowId }
      });
      expect(automationWorkflowService.getWorkflow).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        workflowId: UUIDS.workflowId
      });
    }

    {
      await invokeRoute(router, 'patch', '/workspaces/:workspaceId/automation-workflows/:workflowId', {
        params: { workspaceId: UUIDS.workspaceId, workflowId: UUIDS.workflowId },
        body: { name: 'Follow-up revisado' }
      });
      expect(automationWorkflowService.updateWorkflow).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        workflowId: UUIDS.workflowId,
        name: 'Follow-up revisado',
        description: undefined,
        status: undefined
      });
    }

    for (const action of ['activate', 'pause'] as const) {
      await invokeRoute(router, 'post', `/workspaces/:workspaceId/automation-workflows/:workflowId/${action}`, {
        params: { workspaceId: UUIDS.workspaceId, workflowId: UUIDS.workflowId }
      });
    }
    expect(automationWorkflowService.setWorkflowStatus).toHaveBeenCalledWith({
      workspaceId: UUIDS.workspaceId,
      workflowId: UUIDS.workflowId,
      status: 'active'
    });
    expect(automationWorkflowService.setWorkflowStatus).toHaveBeenCalledWith({
      workspaceId: UUIDS.workspaceId,
      workflowId: UUIDS.workflowId,
      status: 'paused'
    });

    await invokeRoute(router, 'post', '/workspaces/:workspaceId/automation-workflows/:workflowId/archive', {
      params: { workspaceId: UUIDS.workspaceId, workflowId: UUIDS.workflowId }
    });
    expect(automationWorkflowService.archiveWorkflow).toHaveBeenCalledWith({
      workspaceId: UUIDS.workspaceId,
      workflowId: UUIDS.workflowId
    });
  });

  it('handles workflow version endpoints', async () => {
    const { router, automationWorkflowVersionService } = makeDeps();
    const params = { workspaceId: UUIDS.workspaceId, workflowId: UUIDS.workflowId };
    const versionParams = { ...params, versionId: UUIDS.versionId };

    await invokeRoute(router, 'get', '/workspaces/:workspaceId/automation-workflows/:workflowId/versions', {
      params,
      query: { status: 'draft', limit: '5' }
    });
    expect(automationWorkflowVersionService.listVersions).toHaveBeenCalledWith({
      ...params,
      status: 'draft',
      limit: 5
    });

    await invokeRoute(router, 'post', '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/draft', {
      params,
      body: { graph }
    });
    expect(automationWorkflowVersionService.createDraftVersion).toHaveBeenCalledWith({
      ...params,
      definition: undefined,
      graph,
      graphNodes: undefined,
      graphEdges: undefined
    });

    await invokeRoute(router, 'get', '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId', {
      params: versionParams
    });
    expect(automationWorkflowVersionService.getVersion).toHaveBeenCalledWith(versionParams);

    await invokeRoute(router, 'patch', '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId', {
      params: versionParams,
      body: { graph }
    });
    expect(automationWorkflowVersionService.updateDraftVersion).toHaveBeenCalledWith({
      ...versionParams,
      definition: undefined,
      graph,
      graphNodes: undefined,
      graphEdges: undefined
    });

    await invokeRoute(router, 'post', '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId/publish', {
      params: versionParams,
      body: { activateWorkflow: true }
    });
    expect(automationWorkflowVersionService.publishVersion).toHaveBeenCalledWith({
      ...versionParams,
      publishedById: 'user-1',
      activateWorkflow: true
    });

    await invokeRoute(router, 'post', '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId/clone', {
      params: versionParams
    });
    expect(automationWorkflowVersionService.cloneVersion).toHaveBeenCalledWith(versionParams);
  });

  it('runs a published workflow through the runner service', async () => {
    const { router, automationWorkflowRunnerService } = makeDeps();

    const { res } = await invokeRoute(router, 'post', '/workspaces/:workspaceId/automation-workflows/:workflowId/run', {
      params: { workspaceId: UUIDS.workspaceId, workflowId: UUIDS.workflowId },
      body: { triggerType: 'manual', context: { itemId: UUIDS.itemId } }
    });

    expect(automationWorkflowRunnerService.startRun).toHaveBeenCalledWith({
      workspaceId: UUIDS.workspaceId,
      workflowId: UUIDS.workflowId,
      triggerType: 'manual',
      context: { itemId: UUIDS.itemId }
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      runId: UUIDS.runId,
      status: 'completed',
      executionStatus: 'completed',
      executedNodeIds: ['trigger-manual', 'end']
    });
  });

  it('handles automation run observability endpoints and cancel action', async () => {
    const { router, automationRunService, automationRunObservabilityService } = makeDeps();
    const runParams = {
      workspaceId: UUIDS.workspaceId,
      runId: UUIDS.runId
    };

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/runs', {
        params: { workspaceId: UUIDS.workspaceId },
        query: { status: 'waiting', search: 'welcome', limit: '25' }
      });
      expect(automationRunObservabilityService.listRuns).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        workflowId: undefined,
        status: 'waiting',
        triggerType: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        search: 'welcome',
        limit: 25
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ items: [{ runId: UUIDS.runId }] });
    }

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/runs/:runId', {
        params: runParams
      });
      expect(automationRunObservabilityService.getRunDetail).toHaveBeenCalledWith(runParams);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/runs/:runId/events', {
        params: runParams,
        query: { limit: '20' }
      });
      expect(automationRunObservabilityService.listEvents).toHaveBeenCalledWith({ ...runParams, limit: 20 });
      expect(res.json).toHaveBeenCalledWith({ items: [{ id: 'event-1' }] });
    }

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/runs/:runId/steps', {
        params: runParams
      });
      expect(automationRunObservabilityService.listSteps).toHaveBeenCalledWith(runParams);
      expect(res.json).toHaveBeenCalledWith({ items: [{ id: 'step-1' }] });
    }

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/runs/:runId/side-effects', {
        params: runParams,
        query: { limit: '15' }
      });
      expect(automationRunObservabilityService.listSideEffects).toHaveBeenCalledWith({ ...runParams, limit: 15 });
      expect(res.json).toHaveBeenCalledWith({ items: [{ id: 'side-effect-1' }] });
    }

    {
      const { res } = await invokeRoute(router, 'post', '/automation/workspaces/:workspaceId/runs/:runId/cancel', {
        params: runParams,
        body: { reason: 'manual stop' }
      });
      expect(automationRunService.cancelRun).toHaveBeenCalledWith({
        workspaceId: runParams.workspaceId,
        runId: runParams.runId,
        reason: 'manual stop'
      });
      expect(automationRunObservabilityService.getRunDetail).toHaveBeenCalledWith(runParams);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ run: { runId: UUIDS.runId } });
    }
  });

  it('handles WhatsApp operational template, consent and mock event endpoints', async () => {
    const { router, prisma } = makeDeps();

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/communication/templates', {
        params: { workspaceId: UUIDS.workspaceId },
        query: { channel: 'whatsapp' }
      });
      expect(prisma.communicationTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: UUIDS.workspaceId,
            channel: 'whatsapp'
          })
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    }

    {
      const { res } = await invokeRoute(router, 'post', '/automation/workspaces/:workspaceId/communication/templates/whatsapp', {
        params: { workspaceId: UUIDS.workspaceId },
        body: {
          name: 'Proposal follow-up',
          key: 'proposal_followup_whatsapp',
          body: 'Ola {{contact.name}}',
          providerTemplateName: 'proposal_followup_whatsapp',
          variables: ['contact.name']
        }
      });
      expect(prisma.communicationTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: UUIDS.workspaceId,
            channel: 'whatsapp',
            providerTemplateName: 'proposal_followup_whatsapp'
          })
        })
      );
      expect(prisma.communicationTemplateVersion.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    }

    {
      const { res } = await invokeRoute(router, 'patch', '/automation/workspaces/:workspaceId/communication/templates/versions/:versionId/approval-status', {
        params: { workspaceId: UUIDS.workspaceId, versionId: UUIDS.versionId },
        body: { approvalStatus: 'approved' }
      });
      expect(prisma.communicationTemplateVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ approvalStatus: 'approved' })
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    }

    {
      const { res } = await invokeRoute(router, 'put', '/automation/workspaces/:workspaceId/communication/whatsapp/consents', {
        params: { workspaceId: UUIDS.workspaceId },
        body: {
          address: '+55 49 99999-9999',
          status: 'opted_in',
          reason: 'manual approval'
        }
      });
      expect(prisma.contactConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            channel: 'whatsapp',
            status: 'opted_in'
          })
        })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ address: '+55******9999' }));
    }

    {
      const { res } = await invokeRoute(router, 'post', '/automation/workspaces/:workspaceId/side-effects/:sideEffectId/whatsapp-mock-events', {
        params: { workspaceId: UUIDS.workspaceId, sideEffectId: UUIDS.sideEffectId },
        body: { eventType: 'delivered' }
      });
      expect(prisma.communicationProviderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'mock',
            channel: 'whatsapp',
            eventType: 'whatsapp.delivered'
          })
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    }
  });

  it('handles view/column/placement endpoints', async () => {
    const { router, automationViewService } = makeDeps();

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/views', {
        params: { workspaceId: UUIDS.workspaceId }
      });
      expect(automationViewService.listViews).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        userId: 'user-1'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: 'view-1' }]);
    }

    {
      const { res } = await invokeRoute(router, 'post', '/automation/workspaces/:workspaceId/views', {
        params: { workspaceId: UUIDS.workspaceId },
        body: {
          key: 'qa',
          name: 'QA',
          columns: [{ key: 'ready', name: 'Ready' }]
        }
      });
      expect(automationViewService.createView).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        userId: 'user-1',
        payload: {
          key: 'qa',
          name: 'QA',
          columns: [{ key: 'ready', name: 'Ready' }]
        }
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'view-1' });
    }

    {
      const { res } = await invokeRoute(
        router,
        'patch',
        '/automation/workspaces/:workspaceId/views/:viewId',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            viewId: UUIDS.viewId
          },
          body: {
            name: 'Quality Assurance'
          }
        }
      );
      expect(automationViewService.updateView).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        viewId: UUIDS.viewId,
        userId: 'user-1',
        payload: { name: 'Quality Assurance' }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'view-1' });
    }

    {
      const { res } = await invokeRoute(
        router,
        'get',
        '/automation/workspaces/:workspaceId/views/:viewId/columns',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            viewId: UUIDS.viewId
          }
        }
      );
      expect(automationViewService.listViewColumns).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        viewId: UUIDS.viewId,
        userId: 'user-1'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: 'col-1' }]);
    }

    {
      const { res } = await invokeRoute(
        router,
        'post',
        '/automation/workspaces/:workspaceId/views/:viewId/columns',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            viewId: UUIDS.viewId
          },
          body: {
            key: 'doing',
            name: 'Doing'
          }
        }
      );
      expect(automationViewService.createViewColumn).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        viewId: UUIDS.viewId,
        userId: 'user-1',
        payload: {
          key: 'doing',
          name: 'Doing'
        }
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'col-1' });
    }

    {
      const { res } = await invokeRoute(
        router,
        'patch',
        '/automation/workspaces/:workspaceId/views/:viewId/columns/:columnId',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            viewId: UUIDS.viewId,
            columnId: UUIDS.columnId
          },
          body: {
            isTerminal: true
          }
        }
      );
      expect(automationViewService.updateViewColumn).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        viewId: UUIDS.viewId,
        columnId: UUIDS.columnId,
        userId: 'user-1',
        payload: {
          isTerminal: true
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'col-1' });
    }

    {
      const { res } = await invokeRoute(
        router,
        'get',
        '/automation/workspaces/:workspaceId/items/:itemId/placements',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            itemId: UUIDS.itemId
          }
        }
      );
      expect(automationViewService.listItemPlacements).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        itemId: UUIDS.itemId,
        userId: 'user-1'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: 'placement-1' }]);
    }

    {
      const { res } = await invokeRoute(
        router,
        'put',
        '/automation/workspaces/:workspaceId/items/:itemId/placements/:viewId',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            itemId: UUIDS.itemId,
            viewId: UUIDS.viewId
          },
          body: {
            columnId: UUIDS.columnId,
            metadata: { copied: true }
          }
        }
      );
      expect(automationViewService.upsertItemPlacement).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        itemId: UUIDS.itemId,
        viewId: UUIDS.viewId,
        userId: 'user-1',
        payload: {
          columnId: UUIDS.columnId,
          metadata: { copied: true }
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'placement-1' });
    }

    {
      const { res } = await invokeRoute(
        router,
        'delete',
        '/automation/workspaces/:workspaceId/items/:itemId/placements/:viewId',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            itemId: UUIDS.itemId,
            viewId: UUIDS.viewId
          }
        }
      );
      expect(automationViewService.removeItemPlacement).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        itemId: UUIDS.itemId,
        viewId: UUIDS.viewId,
        userId: 'user-1'
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledWith();
    }
  });
});
