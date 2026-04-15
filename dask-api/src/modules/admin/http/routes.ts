import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';

export const buildAdminRoutes = (deps: { prisma: PrismaClient }): Router => {
  const router = Router();
  const outboxRepository = new PrismaOutboxRepository(deps.prisma);

  router.get(
    '/admin/telemetry/overview',
    asyncHandler(async (_req, res) => {
      const [usersTotal, usersVerified, workspaceTotal, aiRuns24h, aiFailed24h, outbox] = await Promise.all([
        deps.prisma.user.count(),
        deps.prisma.user.count({ where: { emailVerified: true } }),
        deps.prisma.workspace.count(),
        deps.prisma.aIAgentRun.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        deps.prisma.aIAgentRun.count({
          where: {
            status: 'failed',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        }),
        outboxRepository.getRelayMetrics()
      ]);

      res.status(200).json({
        users: {
          total: usersTotal,
          verified: usersVerified
        },
        workspaces: {
          total: workspaceTotal
        },
        ai: {
          runs24h: aiRuns24h,
          failed24h: aiFailed24h,
          failureRate24h: aiRuns24h > 0 ? Number((aiFailed24h / aiRuns24h).toFixed(4)) : 0
        },
        outbox: {
          pending: outbox.pendingCount,
          retryPending: outbox.retryPendingCount,
          deadLetter: outbox.deadLetterCount,
          oldestPendingAgeSeconds: outbox.oldestPendingAgeSeconds
        }
      });
    })
  );

  return router;
};
