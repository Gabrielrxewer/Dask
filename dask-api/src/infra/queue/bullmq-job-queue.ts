import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/core/config/env';
import type { JobName, JobQueue } from '@/core/jobs/job-queue';

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const daskQueue = new Queue('dask-jobs', { connection });

export class BullMqJobQueue implements JobQueue {
  public async enqueue<TPayload extends object>(jobName: JobName, payload: TPayload): Promise<void> {
    await daskQueue.add(jobName, payload, {
      removeOnComplete: 500,
      removeOnFail: 500
    });
  }
}

export const queueConnection = connection;
