import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/core/errors/app-error';
import { logger } from '@/core/logging/logger';

export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ZodError) {
    res.status(422).json({
      message: 'Validation failed',
      issues: err.flatten()
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    message: 'Internal server error'
  });
};
