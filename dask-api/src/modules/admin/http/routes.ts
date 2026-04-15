import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return fallback;
}

export const buildAdminRoutes = (deps: { prisma: PrismaClient }): Router => {
  const router = Router();
  const outboxRepository = new PrismaOutboxRepository(deps.prisma);
  const telemetryTimezone = process.env.ADMIN_TELEMETRY_TIMEZONE?.trim() || 'America/Sao_Paulo';

  router.get(
    '/admin/telemetry/overview',
    asyncHandler(async (_req, res) => {
      const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        usersTotal,
        usersVerified,
        usersLockedNow,
        usersAdmin,
        workspaceTotal,
        aiRuns24h,
        aiFailed24h,
        outbox,
        loginsByPeriodRows,
        activeUsersByPeriodRows,
        failedLoginReasonsRows,
        authChannelRows,
        refreshFailureRows,
        logoutRows,
        activeSessionRows,
        peakHourRows,
        backendLatencyRows,
        backendStatusRows,
        domainTopRows
      ] = await Promise.all([
        deps.prisma.user.count(),
        deps.prisma.user.count({ where: { emailVerified: true } }),
        deps.prisma.user.count({
          where: {
            lockedUntil: {
              gt: new Date()
            }
          }
        }),
        deps.prisma.$queryRaw<Array<{ total: number }>>`
          SELECT CAST(COUNT(*) AS INTEGER) AS total
          FROM "User"
          WHERE "isPlatformAdmin" = true
        `,
        deps.prisma.workspace.count(),
        deps.prisma.aIAgentRun.count({
          where: {
            createdAt: { gte: dayStart }
          }
        }),
        deps.prisma.aIAgentRun.count({
          where: {
            status: 'failed',
            createdAt: { gte: dayStart }
          }
        }),
        outboxRepository.getRelayMetrics(),
        deps.prisma.$queryRaw<Array<{ period: string; logins: number }>>`
          SELECT period, CAST(COUNT(*) AS INTEGER) AS logins
          FROM (
            SELECT 'day' AS period
            UNION ALL
            SELECT 'week' AS period
            UNION ALL
            SELECT 'month' AS period
          ) p
          LEFT JOIN "TelemetryEvent" t
            ON t."category" = 'auth'
           AND t."eventName" = 'auth.login.success'
           AND (
             (p.period = 'day' AND t."occurredAt" >= ${dayStart})
             OR (p.period = 'week' AND t."occurredAt" >= ${weekStart})
             OR (p.period = 'month' AND t."occurredAt" >= ${monthStart})
           )
          GROUP BY period
        `,
        deps.prisma.$queryRaw<Array<{ period: string; active_users: number }>>`
          SELECT period, CAST(COUNT(DISTINCT t."userId") AS INTEGER) AS active_users
          FROM (
            SELECT 'day' AS period
            UNION ALL
            SELECT 'week' AS period
            UNION ALL
            SELECT 'month' AS period
          ) p
          LEFT JOIN "TelemetryEvent" t
            ON t."category" = 'http'
           AND t."eventName" = 'http.request'
           AND t."success" = true
           AND t."userId" IS NOT NULL
           AND (
             (p.period = 'day' AND t."occurredAt" >= ${dayStart})
             OR (p.period = 'week' AND t."occurredAt" >= ${weekStart})
             OR (p.period = 'month' AND t."occurredAt" >= ${monthStart})
           )
          GROUP BY period
        `,
        deps.prisma.$queryRaw<Array<{ reason: string; attempts: number }>>`
          SELECT COALESCE(NULLIF("reason", ''), 'unknown') AS reason, CAST(COUNT(*) AS INTEGER) AS attempts
          FROM "TelemetryEvent"
          WHERE "category" = 'auth'
            AND "eventName" = 'auth.login.failure'
            AND "occurredAt" >= ${dayStart}
          GROUP BY COALESCE(NULLIF("reason", ''), 'unknown')
          ORDER BY attempts DESC
          LIMIT 8
        `,
        deps.prisma.$queryRaw<Array<{ channel: string; total: number }>>`
          SELECT
            CASE
              WHEN "provider" IS NULL OR "provider" = '' THEN 'password'
              ELSE 'social'
            END AS channel,
            CAST(COUNT(*) AS INTEGER) AS total
          FROM "TelemetryEvent"
          WHERE "category" = 'auth'
            AND "eventName" = 'auth.login.success'
            AND "occurredAt" >= ${monthStart}
          GROUP BY channel
        `,
        deps.prisma.$queryRaw<Array<{ failures: number }>>`
          SELECT CAST(COUNT(*) AS INTEGER) AS failures
          FROM "TelemetryEvent"
          WHERE "category" = 'auth'
            AND "eventName" = 'auth.refresh.invalid'
            AND "occurredAt" >= ${dayStart}
        `,
        deps.prisma.$queryRaw<Array<{ total: number }>>`
          SELECT CAST(COUNT(*) AS INTEGER) AS total
          FROM "TelemetryEvent"
          WHERE "category" = 'auth'
            AND "eventName" = 'auth.logout'
            AND "occurredAt" >= ${dayStart}
        `,
        deps.prisma.$queryRaw<Array<{ user_id: string; sessions: number }>>`
          SELECT "userId" AS user_id, CAST(COUNT(*) AS INTEGER) AS sessions
          FROM "RefreshToken"
          WHERE "revokedAt" IS NULL
            AND "expiresAt" > NOW()
          GROUP BY "userId"
          ORDER BY sessions DESC
          LIMIT 10
        `,
        deps.prisma.$queryRaw<Array<{ hour_of_day: number; total: number }>>`
          SELECT
            CAST(EXTRACT(HOUR FROM ("occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE ${telemetryTimezone})) AS INTEGER) AS hour_of_day,
            CAST(COUNT(*) AS INTEGER) AS total
          FROM "TelemetryEvent"
          WHERE "category" = 'http'
            AND "eventName" = 'http.request'
            AND "occurredAt" >= ${dayStart}
          GROUP BY hour_of_day
          ORDER BY total DESC, hour_of_day ASC
          LIMIT 3
        `,
        deps.prisma.$queryRaw<Array<{ avg_ms: number; p95_ms: number; p99_ms: number }>>`
          SELECT
            COALESCE(ROUND(AVG("durationMs")::numeric, 2), 0) AS avg_ms,
            COALESCE(ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2), 0) AS p95_ms,
            COALESCE(ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2), 0) AS p99_ms
          FROM "TelemetryEvent"
          WHERE "category" = 'http'
            AND "eventName" = 'http.request'
            AND "durationMs" IS NOT NULL
            AND "occurredAt" >= ${dayStart}
        `,
        deps.prisma.$queryRaw<Array<{ status_bucket: string; total: number }>>`
          SELECT
            CASE
              WHEN "statusCode" BETWEEN 200 AND 299 THEN '2xx'
              WHEN "statusCode" BETWEEN 300 AND 399 THEN '3xx'
              WHEN "statusCode" BETWEEN 400 AND 499 THEN '4xx'
              WHEN "statusCode" >= 500 THEN '5xx'
              ELSE 'other'
            END AS status_bucket,
            CAST(COUNT(*) AS INTEGER) AS total
          FROM "TelemetryEvent"
          WHERE "category" = 'http'
            AND "eventName" = 'http.request'
            AND "occurredAt" >= ${dayStart}
          GROUP BY status_bucket
          ORDER BY total DESC
        `,
        deps.prisma.$queryRaw<Array<{ event_name: string; total: number }>>`
          SELECT "eventName" AS event_name, CAST(COUNT(*) AS INTEGER) AS total
          FROM "TelemetryEvent"
          WHERE "category" = 'domain'
            AND "occurredAt" >= ${weekStart}
          GROUP BY "eventName"
          ORDER BY total DESC
          LIMIT 12
        `
      ]);

      const loginByPeriod = {
        day: asNumber(loginsByPeriodRows.find((row) => row.period === 'day')?.logins),
        week: asNumber(loginsByPeriodRows.find((row) => row.period === 'week')?.logins),
        month: asNumber(loginsByPeriodRows.find((row) => row.period === 'month')?.logins)
      };

      const activeUsersByPeriod = {
        day: asNumber(activeUsersByPeriodRows.find((row) => row.period === 'day')?.active_users),
        week: asNumber(activeUsersByPeriodRows.find((row) => row.period === 'week')?.active_users),
        month: asNumber(activeUsersByPeriodRows.find((row) => row.period === 'month')?.active_users)
      };

      const authChannel = {
        password: asNumber(authChannelRows.find((row) => row.channel === 'password')?.total),
        social: asNumber(authChannelRows.find((row) => row.channel === 'social')?.total)
      };

      const maxConcurrentSessions = activeSessionRows.reduce((max, row) => Math.max(max, row.sessions), 0);

      res.status(200).json({
        users: {
          total: usersTotal,
          verified: usersVerified,
          lockedNow: usersLockedNow,
          platformAdmins: asNumber(usersAdmin[0]?.total),
          activeByPeriod: activeUsersByPeriod
        },
        auth: {
          loginByPeriod,
          channel: authChannel,
          failedLoginReasons24h: failedLoginReasonsRows.map((row) => ({
            reason: row.reason,
            attempts: row.attempts
          })),
          refreshFailures24h: asNumber(refreshFailureRows[0]?.failures),
          logout24h: asNumber(logoutRows[0]?.total),
          concurrentSessions: {
            max: maxConcurrentSessions,
            topUsers: activeSessionRows
          }
        },
        workspaces: {
          total: workspaceTotal
        },
        traffic: {
          timezone: telemetryTimezone,
          peakHours24h: peakHourRows.map((row) => ({
            hour: row.hour_of_day,
            total: row.total
          }))
        },
        backend: {
          latency24h: {
            avgMs: asNumber(backendLatencyRows[0]?.avg_ms),
            p95Ms: asNumber(backendLatencyRows[0]?.p95_ms),
            p99Ms: asNumber(backendLatencyRows[0]?.p99_ms)
          },
          statusBuckets24h: backendStatusRows.map((row) => ({
            bucket: row.status_bucket,
            total: row.total
          }))
        },
        product: {
          topDomainEvents7d: domainTopRows.map((row) => ({
            eventName: row.event_name,
            total: row.total
          }))
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
