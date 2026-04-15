import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/core/errors/app-error';
import { logger } from '@/core/logging/logger';
import { recordTelemetryEvent } from '@/core/telemetry/telemetry-recorder';

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ZodError) {
    void recordTelemetryEvent({
      category: 'error',
      eventName: 'backend.validation_error',
      success: false,
      userId: req.auth?.userId ?? null,
      workspaceId: req.workspace?.id ?? null,
      method: req.method,
      route: req.path,
      statusCode: 422,
      reason: 'zod_validation_error',
      metadata: {
        issueCount: err.issues.length
      }
    });
    res.status(422).json({
      message: 'Validation failed',
      issues: err.flatten()
    });
    return;
  }

  if (err instanceof AppError) {
    void recordTelemetryEvent({
      category: 'error',
      eventName: 'backend.app_error',
      success: false,
      userId: req.auth?.userId ?? null,
      workspaceId: req.workspace?.id ?? null,
      method: req.method,
      route: req.path,
      statusCode: err.statusCode,
      reason: err.message,
      metadata: {
        details: err.details ?? null
      }
    });
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  void recordTelemetryEvent({
    category: 'error',
    eventName: 'backend.unhandled_error',
    success: false,
    userId: req.auth?.userId ?? null,
    workspaceId: req.workspace?.id ?? null,
    method: req.method,
    route: req.path,
    statusCode: 500,
    reason: err instanceof Error ? err.message : 'unknown_error'
  });
  res.status(500).json({
    message: 'Internal server error'
  });
};
