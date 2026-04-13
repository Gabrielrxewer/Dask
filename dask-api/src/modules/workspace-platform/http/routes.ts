import { Router } from 'express';
import { MembershipRole, type PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import {
  requireWorkspacePermission,
  requireWorkspaceRole,
  workspaceScopeMiddleware
} from '@/core/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import type { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';
import {
  boardColumnParamsDto,
  createBoardColumnDto,
  createCustomFieldDto,
  createItemTypeDto,
  createTagDto,
  createWorkflowStateDto,
  createWorkItemDto,
  customFieldParamsDto,
  fieldValueParamsDto,
  itemTypeParamsDto,
  moveWorkItemDto,
  patchBoardColumnDto,
  patchCustomFieldDto,
  patchItemTypeDto,
  patchPreferencesDto,
  patchTagDto,
  patchWorkflowStateDto,
  patchWorkItemCustomFieldValueDto,
  patchWorkItemDto,
  tagParamsDto,
  transitionWorkItemDto,
  workflowStateParamsDto,
  workItemParamsDto,
  workItemTagParamsDto,
  workspaceIdParamsDto,
  workspaceSnapshotQueryDto
} from '@/modules/workspace-platform/http/dto';

export const buildWorkspacePlatformRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  workspaceConfigService: WorkspaceConfigService;
  workspaceWorkItemsService: WorkspaceWorkItemsService;
}): Router => {
  const router = Router();
  router.use(authMiddleware);
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireWorkspaceRead = requireWorkspacePermission(deps.authorizationService, 'workspace.read');
  const requireConfigWrite = [
    requireWorkspacePermission(deps.authorizationService, 'workspace.write'),
    requireWorkspaceRole(MembershipRole.ADMIN)
  ];
  const requireItemRead = requireWorkspacePermission(deps.authorizationService, 'item.read');
  const requireItemWrite = [
    requireWorkspacePermission(deps.authorizationService, 'item.write'),
    requireWorkspaceRole(MembershipRole.MEMBER)
  ];

  router.use('/workspaces/:workspaceId', resolveWorkspaceScope, requireWorkspaceRead);

  router.get(
    '/workspaces/:workspaceId/config',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const config = await deps.workspaceConfigService.getWorkspaceConfig({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(config);
    })
  );

  router.get(
    '/workspaces/:workspaceId/item-types',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const itemTypes = await deps.workspaceConfigService.listItemTypes({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(itemTypes);
    })
  );

  router.post(
    '/workspaces/:workspaceId/item-types',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createItemTypeDto.parse(req.body);
      const itemType = await deps.workspaceConfigService.createItemType({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(itemType);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/item-types/:typeId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { typeId } = itemTypeParamsDto.parse(req.params);
      const payload = patchItemTypeDto.parse(req.body);
      const itemType = await deps.workspaceConfigService.updateItemType({
        workspaceId: req.workspace!.id,
        typeId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(itemType);
    })
  );

  router.get(
    '/workspaces/:workspaceId/workflow-states',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const states = await deps.workspaceConfigService.listWorkflowStates({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(states);
    })
  );

  router.post(
    '/workspaces/:workspaceId/workflow-states',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createWorkflowStateDto.parse(req.body);
      const state = await deps.workspaceConfigService.createWorkflowState({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(state);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/workflow-states/:stateId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { stateId } = workflowStateParamsDto.parse(req.params);
      const payload = patchWorkflowStateDto.parse(req.body);
      const state = await deps.workspaceConfigService.updateWorkflowState({
        workspaceId: req.workspace!.id,
        stateId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(state);
    })
  );

  router.get(
    '/workspaces/:workspaceId/board-columns',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const columns = await deps.workspaceConfigService.listBoardColumns({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(columns);
    })
  );

  router.post(
    '/workspaces/:workspaceId/board-columns',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createBoardColumnDto.parse(req.body);
      const column = await deps.workspaceConfigService.createBoardColumn({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(column);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/board-columns/:columnId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { columnId } = boardColumnParamsDto.parse(req.params);
      const payload = patchBoardColumnDto.parse(req.body);
      const column = await deps.workspaceConfigService.updateBoardColumn({
        workspaceId: req.workspace!.id,
        columnId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(column);
    })
  );

  router.get(
    '/workspaces/:workspaceId/tags',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const tags = await deps.workspaceConfigService.listTags({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(tags);
    })
  );

  router.post(
    '/workspaces/:workspaceId/tags',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createTagDto.parse(req.body);
      const tag = await deps.workspaceConfigService.createTag({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(tag);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/tags/:tagId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { tagId } = tagParamsDto.parse(req.params);
      const payload = patchTagDto.parse(req.body);
      const tag = await deps.workspaceConfigService.updateTag({
        workspaceId: req.workspace!.id,
        tagId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(tag);
    })
  );

  router.get(
    '/workspaces/:workspaceId/custom-fields',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const fields = await deps.workspaceConfigService.listCustomFields({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(fields);
    })
  );

  router.post(
    '/workspaces/:workspaceId/custom-fields',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createCustomFieldDto.parse(req.body);
      const field = await deps.workspaceConfigService.createCustomField({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(field);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/custom-fields/:fieldId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { fieldId } = customFieldParamsDto.parse(req.params);
      const payload = patchCustomFieldDto.parse(req.body);
      const field = await deps.workspaceConfigService.updateCustomField({
        workspaceId: req.workspace!.id,
        fieldId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(field);
    })
  );

  router.get(
    '/workspaces/:workspaceId/preferences',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const preferences = await deps.workspaceConfigService.getPreferences({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(preferences);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/preferences',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = patchPreferencesDto.parse(req.body);
      const preferences = await deps.workspaceConfigService.updatePreferences({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(preferences);
    })
  );

  router.get(
    '/workspaces/:workspaceId/snapshot',
    requireItemRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const { limit } = workspaceSnapshotQueryDto.parse(req.query);
      const snapshot = await deps.workspaceWorkItemsService.getWorkspaceSnapshot({
        workspaceId,
        userId: req.auth!.userId,
        limit
      });
      res.status(200).json(snapshot);
    })
  );

  router.get(
    '/workspaces/:workspaceId/work-items',
    requireItemRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const items = await deps.workspaceWorkItemsService.listWorkItems({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(items);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const payload = createWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.createWorkItem({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(item);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/work-items/:itemId',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId } = workItemParamsDto.parse(req.params);
      const payload = patchWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.updateWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/move',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId } = workItemParamsDto.parse(req.params);
      const payload = moveWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.moveWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/transitions',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId } = workItemParamsDto.parse(req.params);
      const payload = transitionWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.transitionWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/work-items/:itemId/custom-fields/:fieldId',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId, fieldId } = fieldValueParamsDto.parse(req.params);
      const payload = patchWorkItemCustomFieldValueDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.setWorkItemCustomFieldValue({
        workspaceId: req.workspace!.id,
        itemId,
        fieldId,
        userId: req.auth!.userId,
        value: payload.value
      });
      res.status(200).json(item);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/tags/:tagId',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId, tagId } = workItemTagParamsDto.parse(req.params);
      const item = await deps.workspaceWorkItemsService.addTagToWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        tagId,
        userId: req.auth!.userId
      });
      res.status(200).json(item);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/work-items/:itemId/tags/:tagId',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId, tagId } = workItemTagParamsDto.parse(req.params);
      await deps.workspaceWorkItemsService.removeTagFromWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        tagId,
        userId: req.auth!.userId
      });
      res.status(204).send();
    })
  );

  return router;
};
