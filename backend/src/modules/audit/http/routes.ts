import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import type { AuditService } from '@/modules/audit/application/audit-service';

export const buildAuditRoutes = (deps: { auditService: AuditService }): Router => {
  const router = Router();
  router.use(authMiddleware);

  router.get(
    '/audit/events',
    asyncHandler(async (req, res) => {
      const events = await deps.auditService.listLatest(100);
      res.status(200).json(events);
    })
  );

  return router;
};
