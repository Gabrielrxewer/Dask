import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import type { WorkspacesService } from '@/modules/workspaces/application/workspaces-service';
import { createBoardDto, createTemplateDto, createWorkspaceDto } from '@/modules/workspaces/http/dto';

export const buildWorkspacesRoutes = (deps: { workspacesService: WorkspacesService }): Router => {
  const router = Router();
  router.use(authMiddleware);

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
    '/boards',
    asyncHandler(async (req, res) => {
      const input = createBoardDto.parse(req.body);
      const board = await deps.workspacesService.createBoard(input);
      res.status(201).json(board);
    })
  );

  router.post(
    '/templates',
    asyncHandler(async (req, res) => {
      const input = createTemplateDto.parse(req.body);
      const template = await deps.workspacesService.createTemplate(input);
      res.status(201).json(template);
    })
  );

  return router;
};
