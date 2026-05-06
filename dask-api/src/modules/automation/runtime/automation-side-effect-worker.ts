import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import { createDebugLogger, getLogger } from '@/core/logging/logger';
import { AutomationSideEffectProcessor } from '@/modules/automation/runtime/automation-side-effect-processor';

export type AutomationSideEffectWorkerHandle = {
  close(): Promise<void>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

const sideEffectLogger = getLogger('automation-side-effects');
const sideEffectDebug = createDebugLogger('automation.side_effects');

export function startAutomationSideEffectWorker(
  prisma: PrismaClient,
  input?: {
    intervalMs?: number;
    batchSize?: number;
    lockedBy?: string;
    processor?: AutomationSideEffectProcessor;
  }
): AutomationSideEffectWorkerHandle {
  const processor = input?.processor ?? new AutomationSideEffectProcessor(prisma);
  const intervalMs = input?.intervalMs ?? env.AUTOMATION_SIDE_EFFECT_POLL_INTERVAL_MS;
  const batchSize = input?.batchSize ?? env.AUTOMATION_SIDE_EFFECT_BATCH_SIZE;
  const lockedBy = input?.lockedBy ?? `automation-side-effect:${process.pid}:${randomUUID()}`;
  let running = false;
  let closing = false;

  const tick = async (): Promise<void> => {
    if (running || closing) {
      return;
    }

    running = true;
    try {
      const result = await processor.processPending({
        lockedBy,
        limit: batchSize
      });

      sideEffectDebug.log(
        {
          lockedBy,
          ...result
        },
        'Automation side effect processor cycle completed'
      );
    } catch (error) {
      sideEffectLogger.error(
        {
          event: 'automation.side_effects.tick_failed',
          retryInSeconds: Math.floor(intervalMs / 1000),
          err: error
        },
        'Automation side effect worker tick failed'
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
        sideEffectLogger.warn('Automation side effect worker did not stop before shutdown timeout');
      }
    }
  };
}
