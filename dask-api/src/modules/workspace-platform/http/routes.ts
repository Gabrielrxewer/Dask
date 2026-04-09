import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
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
  workspaceConfigService: WorkspaceConfigService;
  workspaceWorkItemsService: WorkspaceWorkItemsService;
}): Router => {
  const router = Router();
  router.use(authMiddleware);

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
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createItemTypeDto.parse(req.body);
      const itemType = await deps.workspaceConfigService.createItemType({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(itemType);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/item-types/:typeId',
    asyncHandler(async (req, res) => {
      const { workspaceId, typeId } = itemTypeParamsDto.parse(req.params);
      const payload = patchItemTypeDto.parse(req.body);
      const itemType = await deps.workspaceConfigService.updateItemType({
        workspaceId,
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
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createWorkflowStateDto.parse(req.body);
      const state = await deps.workspaceConfigService.createWorkflowState({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(state);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/workflow-states/:stateId',
    asyncHandler(async (req, res) => {
      const { workspaceId, stateId } = workflowStateParamsDto.parse(req.params);
      const payload = patchWorkflowStateDto.parse(req.body);
      const state = await deps.workspaceConfigService.updateWorkflowState({
        workspaceId,
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
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createBoardColumnDto.parse(req.body);
      const column = await deps.workspaceConfigService.createBoardColumn({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(column);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/board-columns/:columnId',
    asyncHandler(async (req, res) => {
      const { workspaceId, columnId } = boardColumnParamsDto.parse(req.params);
      const payload = patchBoardColumnDto.parse(req.body);
      const column = await deps.workspaceConfigService.updateBoardColumn({
        workspaceId,
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
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createTagDto.parse(req.body);
      const tag = await deps.workspaceConfigService.createTag({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(tag);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/tags/:tagId',
    asyncHandler(async (req, res) => {
      const { workspaceId, tagId } = tagParamsDto.parse(req.params);
      const payload = patchTagDto.parse(req.body);
      const tag = await deps.workspaceConfigService.updateTag({
        workspaceId,
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
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createCustomFieldDto.parse(req.body);
      const field = await deps.workspaceConfigService.createCustomField({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(field);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/custom-fields/:fieldId',
    asyncHandler(async (req, res) => {
      const { workspaceId, fieldId } = customFieldParamsDto.parse(req.params);
      const payload = patchCustomFieldDto.parse(req.body);
      const field = await deps.workspaceConfigService.updateCustomField({
        workspaceId,
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
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = patchPreferencesDto.parse(req.body);
      const preferences = await deps.workspaceConfigService.updatePreferences({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(preferences);
    })
  );

  router.get(
    '/workspaces/:workspaceId/snapshot',
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
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.createWorkItem({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(item);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/work-items/:itemId',
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId } = workItemParamsDto.parse(req.params);
      const payload = patchWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.updateWorkItem({
        workspaceId,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/move',
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId } = workItemParamsDto.parse(req.params);
      const payload = moveWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.moveWorkItem({
        workspaceId,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/transitions',
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId } = workItemParamsDto.parse(req.params);
      const payload = transitionWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.transitionWorkItem({
        workspaceId,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/work-items/:itemId/custom-fields/:fieldId',
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId, fieldId } = fieldValueParamsDto.parse(req.params);
      const payload = patchWorkItemCustomFieldValueDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.setWorkItemCustomFieldValue({
        workspaceId,
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
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId, tagId } = workItemTagParamsDto.parse(req.params);
      const item = await deps.workspaceWorkItemsService.addTagToWorkItem({
        workspaceId,
        itemId,
        tagId,
        userId: req.auth!.userId
      });
      res.status(200).json(item);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/work-items/:itemId/tags/:tagId',
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId, tagId } = workItemTagParamsDto.parse(req.params);
      await deps.workspaceWorkItemsService.removeTagFromWorkItem({
        workspaceId,
        itemId,
        tagId,
        userId: req.auth!.userId
      });
      res.status(204).send();
    })
  );

  return router;
};
