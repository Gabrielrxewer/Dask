import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { buildAppContainer } from '@/bootstrap/build-app-container';
import { env } from '@/core/config/env';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import { errorMiddleware } from '@/core/http/error-middleware';
import { notFoundMiddleware } from '@/core/http/not-found-middleware';
import { createDebugLogger, createRequestId, getLogger, logger } from '@/core/logging/logger';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';
import { prisma } from '@/infra/db/prisma';
import { createSubscriptionMiddleware } from '@/modules/billing/http/subscription-middleware';
import { buildIdentityRoutes } from '@/modules/identity/http/routes';
import { buildWorkspacesRoutes } from '@/modules/workspaces/http/routes';
import { buildItemsRoutes } from '@/modules/items/http/routes';
import { buildAiRoutes } from '@/modules/ai/http/routes';
import { buildSearchRoutes } from '@/modules/search/http/routes';
import { buildAutomationRoutes } from '@/modules/automation/http/routes';
import { buildIntegrationRoutes } from '@/modules/integration/http/routes';
import { buildAuditRoutes } from '@/modules/audit/http/routes';
import { buildWorkspacePlatformRoutes } from '@/modules/workspace-platform/http/routes';
import { buildBillingRoutes } from '@/modules/billing/http/routes';

function parseAllowedOrigins(raw: string): string[] {
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(values));

  if (unique.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must include at least one origin.');
  }

  if (unique.some((origin) => origin === '*')) {
    throw new Error('CORS_ALLOWED_ORIGINS must not include wildcard origins.');
  }

  return unique;
}

const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
const httpLogger = getLogger('http');
const httpRequestDebug = createDebugLogger('http.request');

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger: httpLogger,
      autoLogging: {
        ignore(req) {
          return req.url === '/health';
        }
      },
      quietReqLogger: true,
      quietResLogger: true,
      genReqId(req, res) {
        const requestIdHeader = req.headers['x-request-id'];
        const requestId =
          typeof requestIdHeader === 'string' && requestIdHeader.trim()
            ? requestIdHeader.trim()
            : createRequestId();

        res.setHeader('x-request-id', requestId);
        return requestId;
      },
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage(req, res) {
        return `${req.method} ${req.url} -> ${res.statusCode}`;
      },
      customErrorMessage(req, res) {
        return `${req.method} ${req.url} -> ${res.statusCode}`;
      }
    })
  );

  app.use((req, _res, next) => {
    httpRequestDebug.log(
      {
        requestId: req.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      },
      'Incoming request detail'
    );
    next();
  });

  app.use(
    cors({
      origin(requestOrigin, callback) {
        if (!requestOrigin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(requestOrigin)) {
          callback(null, true);
          return;
        }

        logger.warn({ event: 'cors.rejected', origin: requestOrigin });
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      maxAge: 86400
    })
  );

  app.use(
    helmet({
      hsts:
        env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  );

  // Raw body for Stripe webhook validation — must be registered before express.json()
  app.use(`${env.API_PREFIX}/billing/webhook`, express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  const {
    roleAuthorizationService,
    authService,
    organizationService,
    workspacesService,
    itemsService,
    improvementRequestService,
    aiAgentService,
    indexingRequestService,
    hybridSearchService,
    automationService,
    automationViewService,
    integrationService,
    auditService,
    workspaceConfigService,
    workspaceWorkItemsService,
    billingService
  } = buildAppContainer();
  const requireSubscription = createSubscriptionMiddleware(prisma);
  const outboxRepository = new PrismaOutboxRepository(prisma);

  app.get(
    '/health',
    asyncHandler(async (_req: Request, res: Response) => {
      let metrics = {
        pendingCount: 0,
        retryPendingCount: 0,
        deadLetterCount: 0,
        oldestPendingAgeSeconds: null as number | null
      };

      try {
        metrics = await outboxRepository.getRelayMetrics();
      } catch (error) {
        logger.warn({ event: 'health.outbox_metrics.failed', err: error });
      }

      const retryRate =
        metrics.pendingCount > 0 ? Number((metrics.retryPendingCount / metrics.pendingCount).toFixed(4)) : 0;

      res.status(200).json({
        status: 'ok',
        service: 'dask-backend',
        env: env.NODE_ENV,
        outbox: {
          pending: metrics.pendingCount,
          retryPending: metrics.retryPendingCount,
          deadLetter: metrics.deadLetterCount,
          oldestPendingAgeSeconds: metrics.oldestPendingAgeSeconds,
          retryRate
        }
      });
    })
  );

  // Stripe webhook — must be registered directly on `app` BEFORE any router that applies
  // router.use(authMiddleware) globally, otherwise those routers intercept the request
  // and return 401 before it reaches the billing router.
  if (billingService) {
    app.post(
      `${env.API_PREFIX}/billing/webhook`,
      asyncHandler(async (req: Request, res: Response) => {
        const signature = req.headers['stripe-signature'];
        if (!signature || typeof signature !== 'string') {
          res.status(400).json({ error: 'Missing stripe-signature header' });
          return;
        }
        await billingService.handleWebhook(req.body as Buffer, signature);
        res.status(200).json({ received: true });
      })
    );
  }

  app.use(
    env.API_PREFIX,
    buildIdentityRoutes({ authService, organizationService, allowedOrigins })
  );
  app.use(
    env.API_PREFIX,
    authMiddleware,
    requireSubscription,
    buildWorkspacesRoutes({
      prisma,
      authorizationService: roleAuthorizationService,
      organizationService,
      workspacesService
    })
  );
  app.use(
    env.API_PREFIX,
    authMiddleware,
    requireSubscription,
    buildItemsRoutes({
      prisma,
      authorizationService: roleAuthorizationService,
      itemsService
    })
  );
  app.use(
    env.API_PREFIX,
    authMiddleware,
    requireSubscription,
    buildAiRoutes({
      prisma,
      authorizationService: roleAuthorizationService,
      improvementRequestService,
      aiAgentService
    })
  );
  app.use(
    env.API_PREFIX,
    authMiddleware,
    requireSubscription,
    buildSearchRoutes({ indexingRequestService, hybridSearchService })
  );
  app.use(
    env.API_PREFIX,
    authMiddleware,
    requireSubscription,
    buildAutomationRoutes({ automationService, automationViewService })
  );
  app.use(env.API_PREFIX, buildIntegrationRoutes({ integrationService }));
  app.use(
    env.API_PREFIX,
    authMiddleware,
    requireSubscription,
    buildAuditRoutes({
      prisma,
      authorizationService: roleAuthorizationService,
      auditService
    })
  );
  app.use(
    env.API_PREFIX,
    authMiddleware,
    requireSubscription,
    buildWorkspacePlatformRoutes({
      prisma,
      authorizationService: roleAuthorizationService,
      workspaceConfigService,
      workspaceWorkItemsService
    })
  );

  if (billingService) {
    app.use(env.API_PREFIX, buildBillingRoutes({ billingService }));
  }

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
