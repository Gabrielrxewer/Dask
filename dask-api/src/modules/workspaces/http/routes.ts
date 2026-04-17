import { Router } from 'express';
import { MembershipRole, type PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  requireWorkspaceRole,
  workspaceScopeMiddleware
} from '@/core/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { WorkspacesService } from '@/modules/workspaces/application/workspaces-service';
import {
  getWorkspaceTemplateByKey,
  workspaceTemplateCatalog
} from '@/modules/workspaces/application/workspace-template-catalog';
import type { OrganizationService } from '@/modules/identity/application/organization-service';
import {
  boardSnapshotParamsDto,
  boardSnapshotQueryDto,
  createBoardDto,
  createTemplateDto,
  createWorkspaceDto,
  patchWorkspaceDto,
  provisionWorkspaceDto,
  workspaceTemplateCatalogQueryDto
} from '@/modules/workspaces/http/dto';

export const buildWorkspacesRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  organizationService: OrganizationService;
  workspacesService: WorkspacesService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireWorkspaceRead = requireWorkspacePermission(deps.authorizationService, 'workspace.read');
  const requireBoardRead = requireWorkspacePermission(deps.authorizationService, 'board.read');
  const requireBoardWrite = requireWorkspacePermission(deps.authorizationService, 'board.write');
  const requireBoardModule = requireWorkspaceModule('board');
  const requireSettingsModule = requireWorkspaceModule('settings');

  const slugify = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const workspaceKeyFromName = (value: string): string => {
    const base = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 12);

    const fallback = base.length >= 2 ? base : 'WORKSPACE';
    const suffix = Date.now().toString().slice(-4);
    return `${fallback}${suffix}`.slice(0, 20);
  };

  router.get(
    '/workspaces',
    asyncHandler(async (req, res) => {
      const workspaces = await deps.workspacesService.listUserWorkspaces(req.auth!.userId);
      res.status(200).json(workspaces);
    })
  );

  router.get(
    '/workspaces/templates-catalog',
    asyncHandler(async (req, res) => {
      const { includeDescriptions } = workspaceTemplateCatalogQueryDto.parse(req.query);
      const templates = workspaceTemplateCatalog.map((template) => ({
        key: template.key,
        name: template.name,
        description: includeDescriptions === false ? undefined : template.description
      }));

      res.status(200).json(templates);
    })
  );

  router.post(
    '/workspaces',
    asyncHandler(async (req, res) => {
      const input = createWorkspaceDto.parse(req.body);
      const workspace = await deps.workspacesService.createWorkspace({
        ...input,
        ownerUserId: req.auth!.userId
      });
      res.status(201).json(workspace);
    })
  );

  router.post(
    '/workspaces/provision',
    asyncHandler(async (req, res) => {
      const input = provisionWorkspaceDto.parse(req.body);

      if (input.kind === 'CORPORATE') {
        const userAccess = await deps.prisma.user.findUnique({
          where: { id: req.auth!.userId },
          select: {
            hasActiveSubscription: true,
            subscriptionPlan: true
          }
        });
        const hasCorporateAccess = process.env.NODE_ENV !== 'production'
          ? true
          : userAccess?.hasActiveSubscription === true &&
            userAccess.subscriptionPlan === 'BUSINESS';

        if (!hasCorporateAccess) {
          res.status(403).json({ message: 'Corporate workspace requires an active BUSINESS plan.' });
          return;
        }
      }

      const selectedTemplate = getWorkspaceTemplateByKey(input.templateKey);
      if (input.templateKey && !selectedTemplate) {
        res.status(422).json({ message: 'Invalid workspace template.' });
        return;
      }

      let organizationId: string | undefined;
      if (input.kind === 'CORPORATE') {
        const name = input.organizationName!.trim();
        const slugBase = input.organizationSlug?.trim() || slugify(name);
        const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

        const organization = await deps.organizationService.createOrganization({
          name,
          slug,
          ownerUserId: req.auth!.userId
        });

        organizationId = organization.id;
      }

      const workspace = await deps.workspacesService.createWorkspace({
        kind: input.kind,
        organizationId,
        name: input.workspaceName.trim(),
        key: input.workspaceKey?.trim().toUpperCase() || workspaceKeyFromName(input.workspaceName),
        templateKey: selectedTemplate?.key,
        ownerUserId: req.auth!.userId
      });

      res.status(201).json(workspace);
    })
  );

  router.get(
    '/workspaces/:workspaceId/boards',
    resolveWorkspaceScope,
    requireWorkspaceRead,
    requireBoardModule,
    requireBoardRead,
    asyncHandler(async (req, res) => {
      const boards = await deps.workspacesService.listWorkspaceBoards({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId
      });
      res.status(200).json(boards);
    })
  );

  router.get(
    '/workspaces/:workspaceId/boards/:boardId/snapshot',
    resolveWorkspaceScope,
    requireWorkspaceRead,
    requireBoardModule,
    requireBoardRead,
    asyncHandler(async (req, res) => {
      const { boardId } = boardSnapshotParamsDto.parse(req.params);
      const { limit } = boardSnapshotQueryDto.parse(req.query);
      const snapshot = await deps.workspacesService.getBoardSnapshot({
        workspaceId: req.workspace!.id,
        boardId,
        userId: req.auth!.userId,
        itemLimit: limit
      });
      res.status(200).json(snapshot);
    })
  );

  router.post(
    '/workspaces/:workspaceId/boards',
    resolveWorkspaceScope,
    requireBoardModule,
    requireBoardWrite,
    requireWorkspaceRole(MembershipRole.MEMBER),
    asyncHandler(async (req, res) => {
      const input = createBoardDto.parse(req.body);
      const board = await deps.workspacesService.createBoard({
        workspaceId: req.workspace!.id,
        templateId: input.templateId,
        name: input.name,
        description: input.description,
        config: input.config,
        userId: req.auth!.userId
      });
      res.status(201).json(board);
    })
  );

  router.get(
    '/workspaces/:workspaceId',
    resolveWorkspaceScope,
    requireSettingsModule,
    requireWorkspaceRead,
    asyncHandler(async (req, res) => {
      const profile = await deps.workspacesService.getWorkspaceProfile({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId
      });
      res.status(200).json(profile);
    })
  );

  router.patch(
    '/workspaces/:workspaceId',
    resolveWorkspaceScope,
    requireSettingsModule,
    requireWorkspacePermission(deps.authorizationService, 'workspace.write'),
    requireWorkspaceRole(MembershipRole.ADMIN),
    asyncHandler(async (req, res) => {
      const payload = patchWorkspaceDto.parse(req.body);
      const profile = await deps.workspacesService.updateWorkspaceProfile({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        patch: payload
      });
      res.status(200).json(profile);
    })
  );

  router.post(
    '/workspaces/:workspaceId/templates',
    resolveWorkspaceScope,
    requireSettingsModule,
    requireWorkspacePermission(deps.authorizationService, 'workspace.write'),
    requireWorkspaceRole(MembershipRole.ADMIN),
    asyncHandler(async (req, res) => {
      const input = createTemplateDto.parse(req.body);
      const template = await deps.workspacesService.createTemplate({
        workspaceId: req.workspace!.id,
        name: input.name,
        description: input.description,
        schema: input.schema,
        rules: input.rules,
        userId: req.auth!.userId
      });
      res.status(201).json(template);
    })
  );

  return router;
};
