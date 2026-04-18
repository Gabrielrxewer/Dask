import { type Job, Worker } from 'bullmq';
import { startOutboxRelayWorker, type RelayWorkerHandle } from '@/bootstrap/outbox-relay-worker';
import { env } from '@/core/config/env';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import { prisma } from '@/infra/db/prisma';
import { queueConnection } from '@/infra/queue/bullmq-job-queue';
import { buildAIProviderStack } from '@/infra/providers/ai/build-ai-provider-stack';
import { PromptOrchestrationService } from '@/modules/ai/application/prompt-orchestration-service';
import { AutomationRuntimeService } from '@/modules/automation/application/automation-runtime-service';
import { AutomationViewService } from '@/modules/automation/application/automation-view-service';
import { FiscalService } from '@/modules/fiscal/application/fiscal-service';
import { FocusFiscalProvider } from '@/modules/fiscal/providers/focus/focus-fiscal-provider';
import { PrismaFiscalRepository } from '@/modules/fiscal/repositories/prisma-fiscal-repository';
import { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
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
  const workspaceConfigService = new WorkspaceConfigService(prisma);
  const automationViewService = new AutomationViewService(prisma, workspaceConfigService);
  const automationRuntimeService = new AutomationRuntimeService(
    prisma,
    async (workspaceId: string) => automationViewService.ensureDefaultViews(workspaceId)
  );
  const fiscalRepository = new PrismaFiscalRepository(prisma);
  const fiscalProvider = new FocusFiscalProvider();
  const fiscalJobQueue = new BullMqJobQueue();
  const fiscalService = new FiscalService({
    repo: fiscalRepository,
    provider: fiscalProvider,
    jobQueue: fiscalJobQueue,
    stripe: null,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    focusWebhookSecret: env.FOCUS_WEBHOOK_SECRET
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

        const fullContent = [
          `Title: ${item.title}`,
          `Description: ${item.description ?? ''}`,
          `Status: ${item.status}`,
          `Type: ${item.type}`,
          `Metadata: ${JSON.stringify(item.metadata ?? {})}`,
          `Fields: ${JSON.stringify(item.fields ?? {})}`,
          'History:',
          ...item.history.map((entry) => `${entry.createdAt.toISOString()} ${entry.eventName}`)
        ].join('\n');

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

      if (job.name === 'automation.process-event') {
        await automationRuntimeService.processEvent({
          eventId: job.data.eventId as string | undefined,
          eventName: job.data.eventName as string,
          workspaceId: job.data.workspaceId as string,
          payload: (job.data.payload as Record<string, unknown>) ?? {}
        });
      }

      if (job.name === 'automation.run-rule') {
        await automationRuntimeService.runRule({
          ruleId: job.data.ruleId as string,
          context: (job.data.context as Record<string, unknown>) ?? {},
          requestedBy: job.data.requestedBy as string | undefined
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

  return [worker, outboxRelayWorker];
};
