import { Router } from 'express';
import { MembershipRole, type PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspacePermission,
  requireWorkspaceRole,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { ItemsService } from '@/modules/items/application/items-service';
import { createItemDto, updateItemDto } from '@/modules/items/http/dto';

export const buildItemsRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  itemsService: ItemsService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireItemWrite = [
    requireWorkspacePermission(deps.authorizationService, 'item.write'),
    requireWorkspaceRole(MembershipRole.MEMBER)
  ];

  router.post(
    '/workspaces/:workspaceId/items',
    resolveWorkspaceScope,
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const input = createItemDto.parse(req.body);
      const item = await deps.itemsService.createItem({
        ...input,
        workspaceId: req.workspace!.id,
        createdBy: req.auth!.userId
      });
      res.status(201).json(item);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/items/:itemId',
    resolveWorkspaceScope,
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const input = updateItemDto.parse(req.body);
      const item = await deps.itemsService.updateItem(req.workspace!.id, req.params.itemId, {
        ...input,
        updatedBy: req.auth!.userId
      });
      res.status(200).json(item);
    })
  );

  return router;
};

