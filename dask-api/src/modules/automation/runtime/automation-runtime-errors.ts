import { AppError } from '@/core/errors/app-error';
import { redactErrorMessage, redactSensitiveValue } from '@/core/security/redaction';

export type AutomationSanitizedError = {
  message: string;
  code: string;
  retryable: boolean;
  statusCode?: number;
  details?: unknown;
  name?: string;
  [key: string]: unknown;
};

export class AutomationRuntimeError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  public constructor(input: {
    message: string;
    code?: string;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'AutomationRuntimeError';
    this.code = input.code ?? 'AUTOMATION_RUNTIME_ERROR';
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeAutomationPayload(value: unknown, _depth = 0): unknown {
  return redactSensitiveValue(value, {
    maskPersonalData: false,
    maxStringLength: 2000,
    maxArrayLength: 50,
    maxObjectKeys: 50,
    maxDepth: 6,
    omitKeys: ['stack'],
    additionalSensitiveKeyPattern: /(system[-_]?prompt|user[-_]?prompt|developer[-_]?prompt|prompt|messages|raw[-_]?payload|payload[-_]?json|request[-_]?payload|response[-_]?payload|request[-_]?body|response[-_]?body)/i
  });
}

function normalizeRecordError(error: Record<string, unknown>): AutomationSanitizedError {
  const sanitized = sanitizeAutomationPayload(error) as Record<string, unknown>;
  const message = typeof sanitized.message === 'string' && sanitized.message.trim().length > 0
    ? sanitized.message
    : 'Automation runtime error.';
  const code = typeof sanitized.code === 'string' && sanitized.code.trim().length > 0
    ? sanitized.code
    : 'AUTOMATION_NODE_ERROR';
  const retryable = sanitized.retryable === true;

  return {
    ...sanitized,
    message,
    code,
    retryable
  };
}

export function normalizeAutomationError(error: unknown): AutomationSanitizedError {
  if (error instanceof AutomationRuntimeError) {
    return {
      message: redactErrorMessage(error),
      code: error.code,
      retryable: error.retryable,
      details: sanitizeAutomationPayload(error.details)
    };
  }

  if (error instanceof AppError) {
    return {
      message: redactErrorMessage(error),
      code: 'APP_ERROR',
      retryable: error.statusCode >= 500,
      statusCode: error.statusCode,
      details: sanitizeAutomationPayload(error.details)
    };
  }

  if (error instanceof Error) {
    return {
      message: redactErrorMessage(error) || 'Automation runtime error.',
      code: 'UNEXPECTED_ERROR',
      retryable: false,
      name: error.name
    };
  }

  if (isRecord(error)) {
    return normalizeRecordError(error);
  }

  return {
    message: redactErrorMessage(error),
    code: 'UNKNOWN_THROWABLE',
    retryable: false
  };
}

export function isRetryableAutomationError(error: unknown): boolean {
  return normalizeAutomationError(error).retryable;
}
