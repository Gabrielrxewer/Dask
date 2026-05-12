import { type Job, Worker } from 'bullmq';
import { startOutboxRelayWorker, type RelayWorkerHandle } from '@/bootstrap/outbox-relay-worker';
import { env } from '@/core/config/env';
import { EventPublisher } from '@/core/events/event-publisher';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import { redactMetadata, redactSensitiveText } from '@/core/security/redaction';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';
import { prisma } from '@/infra/db/prisma';
import { queueConnection } from '@/infra/queue/bullmq-job-queue';
import { buildAIProviderStack } from '@/infra/providers/ai/build-ai-provider-stack';
import { PromptOrchestrationService } from '@/modules/ai/application/prompt-orchestration-service';
import { startAutomationScheduledStepWorker } from '@/modules/automation/runtime/automation-scheduled-step-worker';
import { startAutomationSideEffectWorker } from '@/modules/automation/runtime/automation-side-effect-worker';
import { FiscalService } from '@/modules/fiscal/application/fiscal-service';
import { FocusFiscalProvider } from '@/modules/fiscal/providers/focus/focus-fiscal-provider';
import { PrismaFiscalRepository } from '@/modules/fiscal/repositories/prisma-fiscal-repository';
import { MarketingService } from '@/modules/marketing/application/marketing-service';
import { MockMarketingEmailProvider } from '@/modules/marketing/providers/mock-marketing-email-provider';
import { ResendMarketingEmailProvider } from '@/modules/marketing/providers/resend-marketing-email-provider';
import { PrismaMarketingRepository } from '@/modules/marketing/repositories/prisma-marketing-repository';
import { BullMqJobQueue } from '@/infra/queue/bullmq-job-queue';

type WorkerHandle = Pick<Worker, 'close'> | RelayWorkerHandle;
const workerLogger = getLogger('worker');
const workerDebug = createDebugLogger('worker.jobs');

function chunkText(value: string, chunkSize: number, overlap: number): string[] {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export const startWorkers = (): WorkerHandle[] => {
  if (!env.ENABLE_WORKERS) {
    workerLogger.info('Workers are disabled by configuration');
    return [];
  }

  const { aiProvider, embeddingProvider } = buildAIProviderStack();
  const promptService = new PromptOrchestrationService();
  const outboxRepository = new PrismaOutboxRepository(prisma);
  const workerEventPublisher = new EventPublisher(outboxRepository, prisma);
  const fiscalRepository = new PrismaFiscalRepository(prisma);
  const fiscalProvider = new FocusFiscalProvider({
    baseUrl: env.FOCUS_API_BASE_URL,
    environment: env.NODE_ENV,
    providerEnvironment: env.FOCUS_API_ENVIRONMENT,
    isBaseUrlExplicit: Boolean(process.env.FOCUS_API_BASE_URL?.trim()),
    requireExplicitBaseUrl: env.NODE_ENV === 'production',
    timeoutMs: env.FOCUS_API_TIMEOUT_MS,
    retryAttempts: env.FOCUS_API_RETRY_ATTEMPTS,
    retryBackoffMs: env.FOCUS_API_RETRY_BACKOFF_MS
  });
  const sharedJobQueue = new BullMqJobQueue();
  const fiscalService = new FiscalService({
    repo: fiscalRepository,
    provider: fiscalProvider,
    jobQueue: sharedJobQueue,
    stripe: null,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    focusWebhookSecret: env.FOCUS_WEBHOOK_SECRET,
    environment: env.NODE_ENV
  });
  const marketingRepository = new PrismaMarketingRepository(prisma);
  const marketingEmailProvider = env.RESEND_API_KEY
    ? new ResendMarketingEmailProvider()
    : new MockMarketingEmailProvider();
  const marketingService = new MarketingService({
    repo: marketingRepository,
    eventPublisher: workerEventPublisher,
    jobQueue: sharedJobQueue,
    aiProvider,
    emailProvider: marketingEmailProvider
  });

  const worker = new Worker(
    'dask-jobs',
    async (job: Job) => {
      workerDebug.log(
        {
          jobId: job.id,
          jobName: job.name,
          attemptsMade: job.attemptsMade
        },
        'Worker started processing job'
      );

      if (job.name === 'ai.improve-description') {
        const itemId = job.data.itemId as string;
        const item = await prisma.item.findUnique({ where: { id: itemId } });
        if (!item || !item.description) {
          return;
        }

        const prompt = promptService.buildDescriptionImprovementPrompt({
          title: item.title,
          description: item.description
        });

        const improved = await aiProvider.improveDescription({
          title: item.title,
          description: prompt
        });

        await prisma.item.update({
          where: { id: itemId },
          data: {
            description: improved,
            metadata: {
              ...(item.metadata && typeof item.metadata === 'object'
                ? (item.metadata as Record<string, unknown>)
                : {}),
              aiLastImprovementAt: new Date().toISOString()
            }
          }
        });

        await prisma.itemHistory.create({
          data: {
            itemId,
            eventName: 'item.description.improved',
            payload: {
              method: 'mock-ai-provider'
            }
          }
        });
      }

      if (job.name === 'search.index-item') {
        const itemId = job.data.itemId as string;
        const item = await prisma.item.findUnique({
          where: { id: itemId },
          include: {
            history: {
              orderBy: { createdAt: 'desc' },
              take: 12
            }
          }
        });
        if (!item) {
          return;
        }

        const fullContent = redactSensitiveText([
          `Title: ${item.title}`,
          `Description: ${item.description ?? ''}`,
          `Status: ${item.status}`,
          `Type: ${item.type}`,
          `Metadata: ${JSON.stringify(redactMetadata(item.metadata ?? {}))}`,
          `Fields: ${JSON.stringify(redactMetadata(item.fields ?? {}))}`,
          'History:',
          ...item.history.map((entry) => `${entry.createdAt.toISOString()} ${entry.eventName}`)
        ].join('\n'));

        const chunks = chunkText(
          fullContent,
          env.AI_EMBEDDING_CHUNK_SIZE,
          env.AI_EMBEDDING_CHUNK_OVERLAP
        );
        const embeddings = await Promise.all(
          chunks.map((content) => embeddingProvider.embed({ content }))
        );

        await prisma.searchDocument.deleteMany({
          where: {
            itemId: item.id
          }
        });

        await prisma.searchDocument.createMany({
          data: chunks.map((content, index) => ({
            id: `${item.id}:${env.AI_EMBEDDING_VERSION}:${index}`,
            itemId: item.id,
            workspaceId: item.workspaceId,
            boardId: item.boardId,
            content,
            metadata: {
              status: item.status,
              type: item.type,
              chunkIndex: index,
              chunkTotal: chunks.length,
              embeddingVersion: env.AI_EMBEDDING_VERSION,
              embeddingModel: env.AI_EMBEDDING_MODEL,
              vectorPreview: embeddings[index].slice(0, 8)
            },
            embedding: embeddings[index]
          }))
        });
      }

      if (job.name === 'fiscal.reconcile-pending') {
        await fiscalService.processPendingDocumentStatus({
          workspaceId: job.data.workspaceId as string,
          documentId: job.data.documentId as string
        });
      }

      if (job.name === 'fiscal.sync-received') {
        await fiscalService.syncReceived({
          workspaceId: job.data.workspaceId as string,
          companyConfigId: job.data.companyConfigId as string,
          type: job.data.type as 'NFE_MDE' | 'NFSE_NFSER',
          trigger: (job.data.trigger as 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'RETRY') ?? 'SCHEDULED',
          requestedByUserId: (job.data.requestedByUserId as string) ?? 'system:worker'
        });
      }

      if (job.name === 'marketing.send-email') {
        await marketingService.processQueuedSend(job.data.sendId as string);
      }
    },
    {
      connection: queueConnection
    }
  );

  worker.on('failed', (job: Job | undefined, err: Error) => {
    workerLogger.error({ jobId: job?.id, jobName: job?.name, err }, 'Worker job failed');
  });

  worker.on('completed', (job: Job) => {
    workerLogger.info({ jobId: job.id, jobName: job.name }, 'Worker job completed');
  });

  const outboxRelayWorker = startOutboxRelayWorker(prisma);
  const automationScheduledStepWorker = startAutomationScheduledStepWorker(prisma);
  const automationSideEffectWorker = startAutomationSideEffectWorker(prisma);

  return [worker, outboxRelayWorker, automationScheduledStepWorker, automationSideEffectWorker];
};
