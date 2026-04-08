import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import type { ImprovementRequestService } from '@/modules/ai/application/improvement-request-service';

export const buildAiRoutes = (deps: { improvementRequestService: ImprovementRequestService }): Router => {
  const router = Router();
  router.use(authMiddleware);

  router.post(
    '/items/:itemId/ai/improve-description',
    asyncHandler(async (req, res) => {
      await deps.improvementRequestService.requestDescriptionImprovement({
        itemId: req.params.itemId,
        requestedBy: req.auth!.userId
      });
      res.status(202).json({
        status: 'queued'
      });
    })
  );

  return router;
};
