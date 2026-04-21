import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { AuditService } from '@/modules/audit/application/audit-service';
import {
  listWorkspaceAuditEventsQueryDto,
  workspaceAuditParamsDto
} from '@/modules/audit/http/dto';

export const buildAuditRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  auditService: AuditService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireWorkspaceRead = requireWorkspacePermission(deps.authorizationService, 'workspace.read');

  router.get(
    '/audit/workspaces/:workspaceId/events',
    resolveWorkspaceScope,
    requireWorkspaceRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceAuditParamsDto.parse(req.params);
      const { limit } = listWorkspaceAuditEventsQueryDto.parse(req.query);
      const events = await deps.auditService.listLatestByWorkspace(workspaceId, limit ?? 100);
      res.status(200).json(events);
    })
  );

  return router;
};

