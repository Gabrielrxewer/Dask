import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import type { ItemsService } from '@/modules/items/application/items-service';
import { createItemDto, updateItemDto } from '@/modules/items/http/dto';

export const buildItemsRoutes = (deps: { itemsService: ItemsService }): Router => {
  const router = Router();
  router.use(authMiddleware);

  router.post(
    '/items',
    asyncHandler(async (req, res) => {
      const input = createItemDto.parse(req.body);
      const item = await deps.itemsService.createItem({
        ...input,
        createdBy: req.auth!.userId
      });
      res.status(201).json(item);
    })
  );

  router.patch(
    '/items/:itemId',
    asyncHandler(async (req, res) => {
      const input = updateItemDto.parse(req.body);
      const item = await deps.itemsService.updateItem(req.params.itemId, {
        ...input,
        updatedBy: req.auth!.userId
      });
      res.status(200).json(item);
    })
  );

  return router;
};
