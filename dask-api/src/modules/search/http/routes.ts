import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import type { IndexingRequestService } from '@/modules/search/application/indexing-request-service';
import type { HybridSearchService } from '@/modules/search/application/hybrid-search-service';
import { searchQueryDto } from '@/modules/search/http/dto';

export const buildSearchRoutes = (deps: {
  indexingRequestService: IndexingRequestService;
  hybridSearchService: HybridSearchService;
}): Router => {
  const router = Router();

  router.post(
    '/items/:itemId/search/index',
    asyncHandler(async (req, res) => {
      await deps.indexingRequestService.requestIndexing({
        itemId: req.params.itemId,
        requestedBy: req.auth!.userId
      });
      res.status(202).json({ status: 'queued' });
    })
  );

  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const input = searchQueryDto.parse(req.query);
      const docs = await deps.hybridSearchService.search({
        query: input.q,
        filters: {
          workspaceId: input.workspaceId,
          boardId: input.boardId,
          status: input.status,
          itemType: input.itemType
        },
        limit: input.limit
      });
      res.status(200).json(docs);
    })
  );

  return router;
};
