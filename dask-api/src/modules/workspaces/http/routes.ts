import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import type { WorkspacesService } from '@/modules/workspaces/application/workspaces-service';
import {
  boardSnapshotParamsDto,
  boardSnapshotQueryDto,
  createBoardDto,
  createTemplateDto,
  createWorkspaceDto,
  workspaceIdParamsDto
} from '@/modules/workspaces/http/dto';

export const buildWorkspacesRoutes = (deps: { workspacesService: WorkspacesService }): Router => {
  const router = Router();
  router.use(authMiddleware);

  router.get(
    '/workspaces',
    asyncHandler(async (req, res) => {
      const workspaces = await deps.workspacesService.listUserWorkspaces(req.auth!.userId);
      res.status(200).json(workspaces);
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

  router.get(
    '/workspaces/:workspaceId/boards',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const boards = await deps.workspacesService.listWorkspaceBoards({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(boards);
    })
  );

  router.get(
    '/workspaces/:workspaceId/boards/:boardId/snapshot',
    asyncHandler(async (req, res) => {
      const { workspaceId, boardId } = boardSnapshotParamsDto.parse(req.params);
      const { limit } = boardSnapshotQueryDto.parse(req.query);
      const snapshot = await deps.workspacesService.getBoardSnapshot({
        workspaceId,
        boardId,
        userId: req.auth!.userId,
        itemLimit: limit
      });
      res.status(200).json(snapshot);
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
