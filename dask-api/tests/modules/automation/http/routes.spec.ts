import type { Router } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { buildAutomationRoutes } from '@/modules/automation/http/routes';

const UUIDS = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  ruleId: '22222222-2222-4222-8222-222222222222',
  viewId: '33333333-3333-4333-8333-333333333333',
  columnId: '44444444-4444-4444-8444-444444444444',
  itemId: '55555555-5555-4555-8555-555555555555'
};

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
    }
  };
  const authorizationService = {
    can: vi.fn().mockResolvedValue(true)
  };

  const automationService = {
    listRules: vi.fn().mockResolvedValue([{ id: 'rule-1' }]),
    createRule: vi.fn().mockResolvedValue({ id: 'rule-1' }),
    updateRule: vi.fn().mockResolvedValue({ id: 'rule-1' }),
    runRule: vi.fn().mockResolvedValue(undefined),
    listExecutions: vi.fn().mockResolvedValue([{ id: 'exec-1' }])
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
    automationService: automationService as any,
    automationViewService: automationViewService as any
  });

  return {
    router,
    prisma,
    authorizationService,
    automationService,
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

  await handler(req, res, next);

  expect(next).not.toHaveBeenCalled();
  return { res };
}

describe('automation/http routes', () => {
  it('registers router with auth middleware and handles automation rule/execution endpoints', async () => {
    const { router, automationService } = makeDeps();

    {
      const { res } = await invokeRoute(router, 'get', '/automation/workspaces/:workspaceId/rules', {
        params: { workspaceId: UUIDS.workspaceId },
        query: { includeDisabled: 'true' }
      });
      expect(automationService.listRules).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        userId: 'user-1',
        includeDisabled: true
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: 'rule-1' }]);
    }

    {
      const { res } = await invokeRoute(router, 'post', '/automation/rules', {
        body: {
          workspaceId: UUIDS.workspaceId,
          name: 'Sync done to QA',
          trigger: { type: 'item.moved' },
          actions: [{ type: 'set_view_column', targetViewKey: 'qa' }],
          enabled: true,
          priority: 5
        }
      });
      expect(automationService.createRule).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: UUIDS.workspaceId,
          userId: 'user-1',
          name: 'Sync done to QA'
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'rule-1' });
    }

    {
      const { res } = await invokeRoute(
        router,
        'patch',
        '/automation/workspaces/:workspaceId/rules/:ruleId',
        {
          params: {
            workspaceId: UUIDS.workspaceId,
            ruleId: UUIDS.ruleId
          },
          body: {
            enabled: false
          }
        }
      );
      expect(automationService.updateRule).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        ruleId: UUIDS.ruleId,
        userId: 'user-1',
        payload: { enabled: false }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'rule-1' });
    }

    {
      const { res } = await invokeRoute(router, 'post', '/automation/rules/:ruleId/run', {
        params: { ruleId: UUIDS.ruleId },
        body: {
          workspaceId: UUIDS.workspaceId,
          context: { itemId: UUIDS.itemId }
        }
      });
      expect(automationService.runRule).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        ruleId: UUIDS.ruleId,
        userId: 'user-1',
        context: { itemId: UUIDS.itemId }
      });
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ status: 'queued' });
    }

    {
      const { res } = await invokeRoute(
        router,
        'get',
        '/automation/workspaces/:workspaceId/executions',
        {
          params: { workspaceId: UUIDS.workspaceId },
          query: { limit: '30' }
        }
      );
      expect(automationService.listExecutions).toHaveBeenCalledWith({
        workspaceId: UUIDS.workspaceId,
        userId: 'user-1',
        limit: 30
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: 'exec-1' }]);
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
