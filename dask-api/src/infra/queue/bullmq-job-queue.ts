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

export class BullMqJobQueue implements JobQueue {
  public async enqueue<TPayload extends object>(
    jobName: JobName,
    payload: TPayload,
    options?: JobEnqueueOptions
  ): Promise<void> {
    await daskQueue.add(jobName, payload, {
      jobId: options?.jobId,
      removeOnComplete: 500,
      removeOnFail: 500
    });

    queueDebug.log(
      {
        jobName,
        jobId: options?.jobId ?? null
      },
      'Job enqueued'
    );
  }
}

connection.on('error', (error) => {
  queueLogger.error({ err: error }, 'BullMQ Redis connection error');
});

export const queueConnection = connection;
