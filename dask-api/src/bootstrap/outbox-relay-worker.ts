import Stripe from 'stripe';
import { AuditSeverity, type Prisma, type PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import { assertProductionCriticalConfig } from '@/core/config/production-config';
import type { DomainEvent } from '@/core/events/domain-event';
import type { OutboxPendingEvent } from '@/core/events/outbox-repository';
import { EventPublisher } from '@/core/events/event-publisher';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import { redactErrorMessage } from '@/core/security/redaction';
import { recordTelemetryEvent } from '@/core/telemetry/telemetry-recorder';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';
import { MockEmailService } from '@/infra/email/mock-email-service';
import { ResendEmailService } from '@/infra/email/resend-email-service';
import { BullMqJobQueue } from '@/infra/queue/bullmq-job-queue';
import { buildAIProviderStack } from '@/infra/providers/ai/build-ai-provider-stack';
import { AiEventDispatcher } from '@/modules/ai/application/ai-event-dispatcher';
import { AutomationAIService } from '@/modules/automation/application/automation-ai-service';
import { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import { AutomationBusinessActionService } from '@/modules/automation/application/automation-business-action-service';
import { AutomationEventDispatcher } from '@/modules/automation/application/automation-event-dispatcher';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';
import { AutomationWorkflowExecutor } from '@/modules/automation/runtime/automation-workflow-executor';
import { BillingService } from '@/modules/billing/application/billing-service';
import { PrismaBillingRepository } from '@/modules/billing/repositories/prisma-billing-repository';
import { SearchEventDispatcher } from '@/modules/search/application/search-event-dispatcher';
import { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import { WorkspaceCustomersService } from '@/modules/workspace-platform/application/workspace-customers-service';
import { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';
import { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';
import { RoleAuthorizationService } from '@/modules/identity/application/role-authorization-service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

const relayLogger = getLogger('outbox-relay');
const relayDebug = createDebugLogger('outbox.relay');

function normalizePayload(payload: Prisma.JsonValue): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function extractActorId(payload: Record<string, unknown>): string | null {
  return typeof payload.requestedBy === 'string' ? payload.requestedBy : null;
}

function extractWorkspaceId(payload: Record<string, unknown>): string | null {
  return typeof payload.workspaceId === 'string' ? payload.workspaceId : null;
}

function extractRouteFromPayload(payload: Record<string, unknown>): string | null {
  return typeof payload.route === 'string' ? payload.route : null;
}

function toDomainEvent(row: OutboxPendingEvent): DomainEvent {
  return {
    id: row.id,
    name: row.eventName,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    occurredAt: row.occurredAt,
    payload: normalizePayload(row.payload)
  };
}

function toRetryDelayMs(retries: number): number {
  const baseDelayMs = 1_000;
  const maxDelayMs = 5 * 60 * 1_000;
  return Math.min(baseDelayMs * 2 ** Math.max(retries - 1, 0), maxDelayMs);
}

function sanitizeErrorMessage(error: unknown): string {
  return redactErrorMessage(error, 2000);
}

async function recordAuditEvent(
  prisma: PrismaClient | Prisma.TransactionClient,
  event: DomainEvent
): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  await prisma.auditEvent.upsert({
    where: { id: event.id },
    update: {},
    create: {
      id: event.id,
      eventName: event.name,
      severity: AuditSeverity.INFO,
      actorId: extractActorId(payload),
      workspaceId: extractWorkspaceId(payload),
      metadata: payload as Prisma.InputJsonValue,
      happenedAt: event.occurredAt
    }
  });
}

export type RelayWorkerHandle = {
  close(): Promise<void>;
};

export function startOutboxRelayWorker(prisma: PrismaClient): RelayWorkerHandle {
  assertProductionCriticalConfig({
    nodeEnv: env.NODE_ENV,
    rawEnv: process.env,
    stripeEnvironment: env.STRIPE_ENVIRONMENT,
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripePublicKey: env.STRIPE_PUBLIC_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeFiscalWebhookSecret: env.STRIPE_WEBHOOK_SECRET_FISCAL,
    billingPortalTokenSecret: env.BILLING_PORTAL_TOKEN_SECRET,
    stripePriceIdPersonalMonthly: env.STRIPE_PRICE_ID_PERSONAL_MONTHLY,
    stripePriceIdBusinessMonthly: env.STRIPE_PRICE_ID_BUSINESS_MONTHLY,
    stripeConnectApplicationFeeBps: env.STRIPE_CONNECT_APPLICATION_FEE_BPS,
    stripeConnectRequiredCapabilities: env.STRIPE_CONNECT_REQUIRED_CAPABILITIES,
    focusApiEnvironment: env.FOCUS_API_ENVIRONMENT,
    focusApiBaseUrl: env.FOCUS_API_BASE_URL,
    focusWebhookSecret: env.FOCUS_WEBHOOK_SECRET
  });

  const outboxRepository = new PrismaOutboxRepository(prisma);
  const eventPublisher = new EventPublisher(outboxRepository, prisma);
  const jobQueue = new BullMqJobQueue();
  const aiDispatcher = new AiEventDispatcher(jobQueue);
  const searchDispatcher = new SearchEventDispatcher(jobQueue);
  const { aiProvider } = buildAIProviderStack();
  const emailService = env.RESEND_API_KEY ? new ResendEmailService() : new MockEmailService();
  const workspaceConfigService = new WorkspaceConfigService(prisma);
  const roleAuthorizationService = new RoleAuthorizationService(prisma);
  const workspaceDocumentsService = new WorkspaceDocumentsService(prisma, workspaceConfigService, eventPublisher, emailService);
  const workspaceWorkItemsService = new WorkspaceWorkItemsService(prisma, workspaceConfigService, eventPublisher);
  const workspaceCustomersService = new WorkspaceCustomersService(prisma, workspaceConfigService, eventPublisher);
  const stripeClient = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  const billingService = stripeClient
    ? new BillingService({
        repo: new PrismaBillingRepository(prisma),
        stripe: stripeClient,
        appPublicUrl: env.APP_PUBLIC_URL,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
        portalTokenSecret: env.BILLING_PORTAL_TOKEN_SECRET,
        environment: env.NODE_ENV,
        stripeSecretConfigured: Boolean(env.STRIPE_SECRET_KEY?.trim()),
        webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()),
        portalTokenSecretConfigured: Boolean(env.BILLING_PORTAL_TOKEN_SECRET?.trim()),
        emailService,
        eventPublisher,
        priceIds: {
          PERSONAL: env.STRIPE_PRICE_ID_PERSONAL_MONTHLY ?? '',
          BUSINESS: env.STRIPE_PRICE_ID_BUSINESS_MONTHLY ?? ''
        },
        connectApplicationFeeBps: env.STRIPE_CONNECT_APPLICATION_FEE_BPS,
        connectRequiredCapabilities: env.STRIPE_CONNECT_REQUIRED_CAPABILITIES
      })
    : null;
  const automationRunEventService = new AutomationRunEventService(prisma);
  const automationApprovalRequestService = new AutomationApprovalRequestService(prisma, {
    eventService: automationRunEventService
  });
  const automationSideEffectService = new AutomationSideEffectService(prisma, {
    eventService: automationRunEventService
  });
  const automationBusinessActionService = new AutomationBusinessActionService({
    prisma,
    workItemsService: workspaceWorkItemsService,
    documentsService: workspaceDocumentsService,
    customersService: workspaceCustomersService,
    billingService,
    authorizationService: roleAuthorizationService
  });
  const automationWorkflowExecutor = new AutomationWorkflowExecutor(prisma, {
    eventService: automationRunEventService,
    sideEffectService: automationSideEffectService,
    approvalRequestService: automationApprovalRequestService,
    aiService: new AutomationAIService(prisma, aiProvider),
    businessActionService: automationBusinessActionService
  });
  const automationDispatcher = new AutomationEventDispatcher(
    prisma,
    new AutomationWorkflowRunnerService(prisma, {
      eventService: automationRunEventService,
      workflowExecutor: automationWorkflowExecutor
    })
  );
  let running = false;
  let closing = false;
  let lastMetricsLogAt = 0;

  const scheduleOutboxFailure = async (input: {
    row: OutboxPendingEvent;
    event: DomainEvent;
    error: unknown;
    db?: Prisma.TransactionClient;
  }): Promise<void> => {
    const writeFailure = async (db: Prisma.TransactionClient): Promise<void> => {
      const payload = input.event.payload as Record<string, unknown>;
      const nextRetries = input.row.retries + 1;
      const errorMessage = sanitizeErrorMessage(input.error);
      void recordTelemetryEvent({
        category: 'domain',
        eventName: `${input.event.name}.failed`,
        success: false,
        userId: extractActorId(payload),
        workspaceId: extractWorkspaceId(payload),
        reason: errorMessage,
        metadata: {
          aggregateType: input.event.aggregateType,
          aggregateId: input.event.aggregateId,
          retries: nextRetries
        }
      });
      if (nextRetries >= env.OUTBOX_RELAY_MAX_RETRIES) {
        await outboxRepository.markDeadLetter({
          outboxId: input.row.id,
          retries: nextRetries,
          errorMessage,
          db
        });
      } else {
        const nextAttemptAt = new Date(Date.now() + toRetryDelayMs(nextRetries));
        await outboxRepository.scheduleRetry({
          outboxId: input.row.id,
          retries: nextRetries,
          nextAttemptAt,
          errorMessage,
          db
        });
      }

      relayLogger.error(
        {
          event: 'outbox.relay.failed',
          outboxId: input.row.id,
          eventName: input.row.eventName,
          retries: nextRetries,
          err: input.error
        },
        'Outbox relay failed'
      );
    };

    if (input.db) {
      await writeFailure(input.db);
      return;
    }

    await prisma.$transaction(writeFailure);
  };

  const processNextEvent = async (): Promise<boolean> => {
    const claimed = await prisma.$transaction(async (db): Promise<{ row: OutboxPendingEvent; event: DomainEvent } | null | false> => {
      const row = await outboxRepository.claimNextPending(env.OUTBOX_RELAY_MAX_RETRIES, db);
      if (!row) {
        return false;
      }

      const event = toDomainEvent(row);
      const payload = event.payload as Record<string, unknown>;
      relayDebug.log(
        {
          outboxId: row.id,
          eventName: row.eventName,
          retries: row.retries
        },
        'Outbox event claimed for processing'
      );
      try {
        void recordTelemetryEvent({
          category: 'domain',
          eventName: event.name,
          success: true,
          userId: extractActorId(payload),
          workspaceId: extractWorkspaceId(payload),
          route: extractRouteFromPayload(payload),
          metadata: {
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId
          }
        });
        await recordAuditEvent(db, event);
        await aiDispatcher.dispatch(event, row.id);
        await searchDispatcher.dispatch(event, row.id);
        return { row, event };
      } catch (error) {
        await scheduleOutboxFailure({ row, event, error, db });
      }

      return null;
    });

    if (claimed && typeof claimed === 'object') {
      try {
        await automationDispatcher.dispatch(claimed.event);
        await outboxRepository.markProcessed(claimed.row.id);
      } catch (error) {
        await scheduleOutboxFailure({ row: claimed.row, event: claimed.event, error });
        relayLogger.error(
          {
            event: 'outbox.automation_dispatch.failed',
            eventName: claimed.event.name,
            aggregateType: claimed.event.aggregateType,
            aggregateId: claimed.event.aggregateId,
            err: error
          },
          'Automation event dispatch failed'
        );
      }
    }

    return claimed !== false;
  };

  const tick = async (): Promise<void> => {
    if (running || closing) {
      return;
    }

    running = true;
    try {
      while (!closing) {
        let processedInCycle = 0;

        while (!closing && processedInCycle < env.OUTBOX_RELAY_BATCH_SIZE) {
          const processed = await processNextEvent();
          if (!processed) {
            break;
          }
          processedInCycle += 1;
        }

        if (processedInCycle < env.OUTBOX_RELAY_BATCH_SIZE) {
          break;
        }
      }

      const now = Date.now();
      if (now - lastMetricsLogAt >= 60_000) {
        const metrics = await outboxRepository.getRelayMetrics();
        relayLogger.info(
          {
            event: 'outbox.relay.metrics',
            pending: metrics.pendingCount,
            retryPending: metrics.retryPendingCount,
            deadLetter: metrics.deadLetterCount,
            oldestPendingAgeSeconds: metrics.oldestPendingAgeSeconds
          },
          'Outbox relay metrics'
        );
        lastMetricsLogAt = now;
      }
    } catch (error) {
      relayLogger.error(
        {
          event: 'outbox.relay.tick_failed',
          retryInSeconds: Math.floor(env.OUTBOX_RELAY_INTERVAL_MS / 1000),
          err: error
        },
        'Outbox relay tick failed'
      );
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, env.OUTBOX_RELAY_INTERVAL_MS);
  timer.unref?.();

  void tick();

  return {
    close: async () => {
      closing = true;
      clearInterval(timer);
      const waitUntil = Date.now() + 3_000;

      while (running && Date.now() < waitUntil) {
        await sleep(25);
      }

      if (running) {
        relayLogger.warn('Outbox relay did not stop before shutdown timeout');
      }
    }
  };
}
