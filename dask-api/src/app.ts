import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from '@/core/config/env';
import { EventPublisher } from '@/core/events/event-publisher';
import { InMemoryEventBus } from '@/core/events/in-memory-event-bus';
import { errorMiddleware } from '@/core/http/error-middleware';
import { notFoundMiddleware } from '@/core/http/not-found-middleware';
import { logger } from '@/core/logging/logger';
import { prisma } from '@/infra/db/prisma';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';
import { BullMqJobQueue } from '@/infra/queue/bullmq-job-queue';
import { AuthService } from '@/modules/identity/application/auth-service';
import { OrganizationService } from '@/modules/identity/application/organization-service';
import { PasswordService } from '@/modules/identity/application/password-service';
import { PrismaIdentityRepository } from '@/modules/identity/repositories/prisma-identity-repository';
import { buildIdentityRoutes } from '@/modules/identity/http/routes';
import { PrismaWorkspacesRepository } from '@/modules/workspaces/repositories/prisma-workspaces-repository';
import { WorkspacesService } from '@/modules/workspaces/application/workspaces-service';
import { buildWorkspacesRoutes } from '@/modules/workspaces/http/routes';
import { PrismaItemsRepository } from '@/modules/items/repositories/prisma-items-repository';
import { ItemsService } from '@/modules/items/application/items-service';
import { buildItemsRoutes } from '@/modules/items/http/routes';
import { ImprovementRequestService } from '@/modules/ai/application/improvement-request-service';
import { buildAiRoutes } from '@/modules/ai/http/routes';
import { IndexingRequestService } from '@/modules/search/application/indexing-request-service';
import { HybridSearchService } from '@/modules/search/application/hybrid-search-service';
import { buildSearchRoutes } from '@/modules/search/http/routes';
import { AutomationService } from '@/modules/automation/application/automation-service';
import { buildAutomationRoutes } from '@/modules/automation/http/routes';
import { IntegrationService } from '@/modules/integration/application/integration-service';
import { buildIntegrationRoutes } from '@/modules/integration/http/routes';
import { AuditService } from '@/modules/audit/application/audit-service';
import { buildAuditRoutes } from '@/modules/audit/http/routes';

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

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));

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

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  const eventBus = new InMemoryEventBus();
  const outboxRepository = new PrismaOutboxRepository(prisma);
  const eventPublisher = new EventPublisher(eventBus, outboxRepository);
  const jobQueue = new BullMqJobQueue();

  const identityRepository = new PrismaIdentityRepository(prisma);
  const workspacesRepository = new PrismaWorkspacesRepository(prisma);
  const itemsRepository = new PrismaItemsRepository(prisma);

  const passwordService = new PasswordService(env.HASH_PEPPER);
  const authService = new AuthService(identityRepository, passwordService);
  const organizationService = new OrganizationService(identityRepository, eventPublisher);
  const workspacesService = new WorkspacesService(workspacesRepository, eventPublisher);
  const itemsService = new ItemsService(itemsRepository, eventPublisher);
  const improvementRequestService = new ImprovementRequestService(itemsRepository, eventPublisher, jobQueue);
  const indexingRequestService = new IndexingRequestService(itemsRepository, eventPublisher, jobQueue);
  const hybridSearchService = new HybridSearchService(prisma);
  const automationService = new AutomationService(prisma, eventPublisher, jobQueue);
  const integrationService = new IntegrationService(eventPublisher);
  const auditService = new AuditService(prisma, eventBus);

  auditService.registerEventListeners();

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'dask-backend',
      env: env.NODE_ENV
    });
  });

  app.use(
    env.API_PREFIX,
    buildIdentityRoutes({ authService, organizationService, allowedOrigins })
  );
  app.use(env.API_PREFIX, buildWorkspacesRoutes({ workspacesService }));
  app.use(env.API_PREFIX, buildItemsRoutes({ itemsService }));
  app.use(env.API_PREFIX, buildAiRoutes({ improvementRequestService }));
  app.use(env.API_PREFIX, buildSearchRoutes({ indexingRequestService, hybridSearchService }));
  app.use(env.API_PREFIX, buildAutomationRoutes({ automationService }));
  app.use(env.API_PREFIX, buildIntegrationRoutes({ integrationService }));
  app.use(env.API_PREFIX, buildAuditRoutes({ auditService }));

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
