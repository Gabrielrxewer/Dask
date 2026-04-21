import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { AutomationService } from '@/modules/automation/application/automation-service';
import type { AutomationViewService } from '@/modules/automation/application/automation-view-service';
import {
  automationRuleParamsDto,
  automationViewColumnParamsDto,
  automationViewParamsDto,
  createAutomationRuleDto,
  createAutomationViewColumnDto,
  createAutomationViewDto,
  itemPlacementParamsDto,
  listAutomationExecutionsQueryDto,
  listAutomationRulesQueryDto,
  listItemPlacementsParamsDto,
  patchAutomationRuleDto,
  patchAutomationViewColumnDto,
  patchAutomationViewDto,
  runAutomationRuleDto,
  upsertItemPlacementDto,
  workspaceIdParamsDto
} from '@/modules/automation/http/dto';
import { resolveWorkspaceAccessPolicy } from '@/modules/identity/domain/access-policy';

export const buildAutomationRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  automationService: AutomationService;
  automationViewService: AutomationViewService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireAutomationRead = requireWorkspacePermission(deps.authorizationService, 'automation.read');
  const requireAutomationModule = requireWorkspaceModule('automation');

  router.use('/automation/workspaces/:workspaceId', resolveWorkspaceScope, requireAutomationRead, requireAutomationModule);

  router.get(
    '/automation/workspaces/:workspaceId/rules',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = listAutomationRulesQueryDto.parse(req.query);

      const rules = await deps.automationService.listRules({
        workspaceId,
        userId: req.auth!.userId,
        includeDisabled: query.includeDisabled
      });

      res.status(200).json(rules);
    })
  );

  router.post(
    '/automation/rules',
    asyncHandler(async (req, res) => {
      const input = createAutomationRuleDto.parse(req.body);
      const [membership, user] = await Promise.all([
        deps.prisma.workspaceMembership.findFirst({
          where: {
            workspaceId: input.workspaceId,
            userId: req.auth!.userId
          },
          select: {
            role: true,
            permissions: true,
            workspace: {
              select: {
                config: true
              }
            }
          }
        }),
        deps.prisma.user.findUnique({
          where: { id: req.auth!.userId },
          select: { subscriptionPlan: true }
        })
      ]);

      if (!membership) {
        res.status(404).json({ message: 'Workspace not found.' });
        return;
      }

      const policy = resolveWorkspaceAccessPolicy({
        role: membership.role,
        membershipPermissions: membership.permissions,
        workspaceConfig: membership.workspace.config,
        subscriptionPlan: user?.subscriptionPlan ?? null
      });

      if (!policy.allowedModules.includes('automation') || !policy.permissions.includes('automation.create')) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      const rule = await deps.automationService.createRule({
        workspaceId: input.workspaceId,
        userId: req.auth!.userId,
        name: input.name,
        description: input.description,
        trigger: input.trigger,
        conditions: input.conditions,
        actions: input.actions,
        enabled: input.enabled,
        priority: input.priority
      });
      res.status(201).json(rule);
    })
  );

  router.patch(
    '/automation/workspaces/:workspaceId/rules/:ruleId',
    asyncHandler(async (req, res) => {
      const params = automationRuleParamsDto.parse(req.params);
      const payload = patchAutomationRuleDto.parse(req.body);
      const rule = await deps.automationService.updateRule({
        workspaceId: params.workspaceId,
        ruleId: params.ruleId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(rule);
    })
  );

  router.delete(
    '/automation/workspaces/:workspaceId/rules/:ruleId',
    asyncHandler(async (req, res) => {
      const params = automationRuleParamsDto.parse(req.params);
      await deps.automationService.deleteRule({
        workspaceId: params.workspaceId,
        ruleId: params.ruleId,
        userId: req.auth!.userId
      });
      res.status(204).send();
    })
  );

  router.post(
    '/automation/rules/:ruleId/run',
    asyncHandler(async (req, res) => {
      const { ruleId } = zRuleIdOnly.parse(req.params);
      const input = runAutomationRuleDto.parse(req.body);
      const [membership, user] = await Promise.all([
        deps.prisma.workspaceMembership.findFirst({
          where: {
            workspaceId: input.workspaceId,
            userId: req.auth!.userId
          },
          select: {
            role: true,
            permissions: true,
            workspace: {
              select: {
                config: true
              }
            }
          }
        }),
        deps.prisma.user.findUnique({
          where: { id: req.auth!.userId },
          select: { subscriptionPlan: true }
        })
      ]);

      if (!membership) {
        res.status(404).json({ message: 'Workspace not found.' });
        return;
      }

      const policy = resolveWorkspaceAccessPolicy({
        role: membership.role,
        membershipPermissions: membership.permissions,
        workspaceConfig: membership.workspace.config,
        subscriptionPlan: user?.subscriptionPlan ?? null
      });

      if (!policy.allowedModules.includes('automation') || !policy.permissions.includes('automation.run')) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      await deps.automationService.runRule({
        workspaceId: input.workspaceId,
        ruleId,
        userId: req.auth!.userId,
        context: input.context
      });
      res.status(202).json({ status: 'queued' });
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/executions',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const { limit } = listAutomationExecutionsQueryDto.parse(req.query);
      const executions = await deps.automationService.listExecutions({
        workspaceId,
        userId: req.auth!.userId,
        limit
      });
      res.status(200).json(executions);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/views',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const views = await deps.automationViewService.listViews({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(views);
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/views',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createAutomationViewDto.parse(req.body);
      const view = await deps.automationViewService.createView({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(view);
    })
  );

  router.patch(
    '/automation/workspaces/:workspaceId/views/:viewId',
    asyncHandler(async (req, res) => {
      const params = automationViewParamsDto.parse(req.params);
      const payload = patchAutomationViewDto.parse(req.body);
      const view = await deps.automationViewService.updateView({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(view);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/views/:viewId/columns',
    asyncHandler(async (req, res) => {
      const params = automationViewParamsDto.parse(req.params);
      const columns = await deps.automationViewService.listViewColumns({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        userId: req.auth!.userId
      });
      res.status(200).json(columns);
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/views/:viewId/columns',
    asyncHandler(async (req, res) => {
      const params = automationViewParamsDto.parse(req.params);
      const payload = createAutomationViewColumnDto.parse(req.body);
      const column = await deps.automationViewService.createViewColumn({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(column);
    })
  );

  router.patch(
    '/automation/workspaces/:workspaceId/views/:viewId/columns/:columnId',
    asyncHandler(async (req, res) => {
      const params = automationViewColumnParamsDto.parse(req.params);
      const payload = patchAutomationViewColumnDto.parse(req.body);
      const column = await deps.automationViewService.updateViewColumn({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        columnId: params.columnId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(column);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/items/:itemId/placements',
    asyncHandler(async (req, res) => {
      const params = listItemPlacementsParamsDto.parse(req.params);
      const placements = await deps.automationViewService.listItemPlacements({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        userId: req.auth!.userId
      });

      res.status(200).json(placements);
    })
  );

  router.put(
    '/automation/workspaces/:workspaceId/items/:itemId/placements/:viewId',
    asyncHandler(async (req, res) => {
      const params = itemPlacementParamsDto.parse(req.params);
      const payload = upsertItemPlacementDto.parse(req.body);
      const placement = await deps.automationViewService.upsertItemPlacement({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        viewId: params.viewId,
        userId: req.auth!.userId,
        payload
      });

      res.status(200).json(placement);
    })
  );

  router.delete(
    '/automation/workspaces/:workspaceId/items/:itemId/placements/:viewId',
    asyncHandler(async (req, res) => {
      const params = itemPlacementParamsDto.parse(req.params);
      await deps.automationViewService.removeItemPlacement({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        viewId: params.viewId,
        userId: req.auth!.userId
      });

      res.status(204).send();
    })
  );

  return router;
};

const zRuleIdOnly = z.object({
  ruleId: z.string().uuid()
});

