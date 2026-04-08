import { type Job, Worker } from 'bullmq';
import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import { prisma } from '@/infra/db/prisma';
import { queueConnection } from '@/infra/queue/bullmq-job-queue';
import { MockAIProvider } from '@/infra/providers/ai/mock-ai-provider';
import { MockEmbeddingProvider } from '@/infra/providers/ai/mock-embedding-provider';
import { PromptOrchestrationService } from '@/modules/ai/application/prompt-orchestration-service';

export const startWorkers = (): Worker[] => {
  if (!env.ENABLE_WORKERS) {
    logger.info('Workers are disabled by configuration');
    return [];
  }

  const aiProvider = new MockAIProvider();
  const embeddingProvider = new MockEmbeddingProvider();
  const promptService = new PromptOrchestrationService();

  const worker = new Worker(
    'dask-jobs',
    async (job: Job) => {
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
        const item = await prisma.item.findUnique({ where: { id: itemId } });
        if (!item) {
          return;
        }

        const content = `${item.title}\n${item.description ?? ''}`.trim();
        const embedding = await embeddingProvider.embed({ content });

        await prisma.searchDocument.upsert({
          where: { id: itemId },
          create: {
            id: itemId,
            itemId: item.id,
            workspaceId: item.workspaceId,
            boardId: item.boardId,
            content,
            metadata: {
              status: item.status,
              type: item.type,
              vectorPreview: embedding.slice(0, 8)
            }
          },
          update: {
            content,
            metadata: {
              status: item.status,
              type: item.type,
              vectorPreview: embedding.slice(0, 8)
            }
          }
        });
      }

      if (job.name === 'automation.run-rule') {
        const ruleId = job.data.ruleId as string;
        logger.info({ ruleId, context: job.data.context }, 'Executing automation rule');
      }
    },
    {
      connection: queueConnection
    }
  );

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err }, 'Worker job failed');
  });

  worker.on('completed', (job: Job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Worker job completed');
  });

  return [worker];
};
