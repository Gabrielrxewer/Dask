import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '@/core/http/async-handler';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { DashboardQueryService } from '@/modules/dashboard/dashboard-query-service';
import { DashboardController } from '@/modules/dashboard/dashboard-controller';

const workspaceParamsDto = z.object({
  workspaceId: z.string().min(1)
});

export const buildDashboardRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  dashboardQueryService: DashboardQueryService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const controller = new DashboardController(deps.dashboardQueryService);
  const requireDashboardView = requireWorkspacePermission(deps.authorizationService, 'dashboard.view');
  const requireItemRead = requireWorkspacePermission(deps.authorizationService, 'item.read');
  const requireAutomationRunRead = requireWorkspacePermission(deps.authorizationService, 'automation.runs.read');

  router.use(
    '/workspaces/:workspaceId/dashboard',
    resolveWorkspaceScope,
    requireWorkspaceModule('dashboard'),
    requireDashboardView
  );

  router.get(
    '/workspaces/:workspaceId/dashboard/overview',
    requireItemRead,
    asyncHandler(async (req, res) => {
      workspaceParamsDto.parse(req.params);
      await controller.getOverview(req, res);
    })
  );

  router.get(
    '/workspaces/:workspaceId/dashboard/crm',
    requireItemRead,
    asyncHandler(async (req, res) => {
      workspaceParamsDto.parse(req.params);
      await controller.getCrm(req, res);
    })
  );

  router.get(
    '/workspaces/:workspaceId/dashboard/automation',
    requireWorkspaceModule('automation'),
    requireAutomationRunRead,
    asyncHandler(async (req, res) => {
      workspaceParamsDto.parse(req.params);
      await controller.getAutomation(req, res);
    })
  );

  router.get(
    '/workspaces/:workspaceId/dashboard/widgets',
    requireItemRead,
    asyncHandler(async (req, res) => {
      workspaceParamsDto.parse(req.params);
      await controller.getWidgets(req, res);
    })
  );

  return router;
};
