import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/core/config/env';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import type { JobEnqueueOptions, JobName, JobQueue } from '@/core/jobs/job-queue';

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const daskQueue = new Queue('dask-jobs', { connection });
const queueLogger = getLogger('queue');
const queueDebug = createDebugLogger('queue.enqueue');

function sanitizeJobId(jobId: string | undefined): string | undefined {
  if (!jobId) {
    return undefined;
  }

  const normalized = jobId.trim();
  if (!normalized) {
    return undefined;
  }

  // BullMQ rejects custom IDs containing ":".
  return normalized.replace(/:/g, '__');
}

export class BullMqJobQueue implements JobQueue {
  public async enqueue<TPayload extends object>(
    jobName: JobName,
    payload: TPayload,
    options?: JobEnqueueOptions
  ): Promise<void> {
    const safeJobId = sanitizeJobId(options?.jobId);

    await daskQueue.add(jobName, payload, {
      jobId: safeJobId,
      removeOnComplete: 500,
      removeOnFail: 500
    });

    queueDebug.log(
      {
        jobName,
        jobId: safeJobId ?? null
      },
      'Job enqueued'
    );
  }
}

connection.on('error', (error) => {
  queueLogger.error({ err: error }, 'BullMQ Redis connection error');
});

export const queueConnection = connection;
