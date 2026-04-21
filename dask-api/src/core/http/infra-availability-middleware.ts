import type { NextFunction, Request, Response } from 'express';
import { getInfraStates, hasCriticalInfraFailure } from '@/infra/runtime/infra-health';

const INFRA_RETRY_SECONDS = 10;

export const infraAvailabilityMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!hasCriticalInfraFailure()) {
    next();
    return;
  }

  res.status(503).json({
    message: 'Infrastructure temporarily unavailable',
    retryInSeconds: INFRA_RETRY_SECONDS,
    dependencies: getInfraStates()
  });
};
