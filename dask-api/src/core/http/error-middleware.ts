import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/core/errors/app-error';
import { toInfraUnavailableError } from '@/core/errors/infra-error';
import { logger } from '@/core/logging/logger';
import { redactErrorMessage, redactSensitiveValue } from '@/core/security/redaction';
import { recordTelemetryEvent } from '@/core/telemetry/telemetry-recorder';

export const errorMiddleware = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const infraError = toInfraUnavailableError(err);
  if (infraError) {
    err = infraError;
  }

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
    const safeMessage = redactErrorMessage(err.message);
    const safeDetails = redactSensitiveValue(err.details, {
      maskPersonalData: true
    });
    void recordTelemetryEvent({
      category: 'error',
      eventName: 'backend.app_error',
      success: false,
      userId: req.auth?.userId ?? null,
      workspaceId: req.workspace?.id ?? null,
      method: req.method,
      route: req.path,
      statusCode: err.statusCode,
      reason: safeMessage,
      metadata: {
        details: safeDetails ?? null
      }
    });
    res.status(err.statusCode).json({
      message: safeMessage,
      details: safeDetails
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
    reason: err instanceof Error ? redactErrorMessage(err) : 'unknown_error'
  });
  res.status(500).json({
    message: 'Internal server error'
  });
};
