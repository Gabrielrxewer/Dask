import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import { AutomationScheduledStepProcessor } from '@/modules/automation/runtime/automation-scheduled-step-processor';

export type AutomationScheduledStepWorkerHandle = {
  close(): Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

const schedulerLogger = getLogger('automation-scheduler');
const schedulerDebug = createDebugLogger('automation.scheduler');

export function startAutomationScheduledStepWorker(
  prisma: PrismaClient,
  input?: {
    intervalMs?: number;
    batchSize?: number;
    lockedBy?: string;
    processor?: AutomationScheduledStepProcessor;
  }
): AutomationScheduledStepWorkerHandle {
  const processor = input?.processor ?? new AutomationScheduledStepProcessor(prisma);
  const intervalMs = input?.intervalMs ?? env.AUTOMATION_SCHEDULED_STEP_INTERVAL_MS;
  const batchSize = input?.batchSize ?? env.AUTOMATION_SCHEDULED_STEP_BATCH_SIZE;
  const lockedBy = input?.lockedBy ?? `automation-scheduler:${process.pid}:${randomUUID()}`;
  let running = false;
  let closing = false;

  const tick = async (): Promise<void> => {
    if (running || closing) {
      return;
    }

    running = true;
    try {
      const result = await processor.processDueSteps({
        lockedBy,
        limit: batchSize
      });

      schedulerDebug.log(
        {
          lockedBy,
          ...result
        },
        'Automation scheduled step processor cycle completed'
      );
    } catch (error) {
      schedulerLogger.error(
        {
          event: 'automation.scheduler.tick_failed',
          retryInSeconds: Math.floor(intervalMs / 1000),
          err: error
        },
        'Automation scheduled step worker tick failed'
      );
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
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
        schedulerLogger.warn('Automation scheduled step worker did not stop before shutdown timeout');
      }
    }
  };
}
