import { AppError } from '@/core/errors/app-error';

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

const sensitiveKeyPattern = /(authorization|cookie|password|secret|token|api[_-]?key|session)/i;
const maxStringLength = 2000;
const maxArrayLength = 50;
const maxObjectKeys = 50;
const maxDepth = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeString(value: string): string {
  return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value;
}

export function sanitizeAutomationPayload(value: unknown, depth = 0): unknown {
  if (depth > maxDepth) {
    return '[MaxDepth]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, maxArrayLength).map((entry) => sanitizeAutomationPayload(entry, depth + 1));
  }

  if (!isRecord(value)) {
    return String(value);
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, maxObjectKeys)) {
    if (key === 'stack') {
      continue;
    }

    output[key] = sensitiveKeyPattern.test(key)
      ? '[REDACTED]'
      : sanitizeAutomationPayload(entry, depth + 1);
  }

  return output;
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
      message: error.message,
      code: error.code,
      retryable: error.retryable,
      details: sanitizeAutomationPayload(error.details)
    };
  }

  if (error instanceof AppError) {
    return {
      message: error.message,
      code: 'APP_ERROR',
      retryable: error.statusCode >= 500,
      statusCode: error.statusCode,
      details: sanitizeAutomationPayload(error.details)
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'Automation runtime error.',
      code: 'UNEXPECTED_ERROR',
      retryable: false,
      name: error.name
    };
  }

  if (isRecord(error)) {
    return normalizeRecordError(error);
  }

  return {
    message: String(error),
    code: 'UNKNOWN_THROWABLE',
    retryable: false
  };
}

export function isRetryableAutomationError(error: unknown): boolean {
  return normalizeAutomationError(error).retryable;
}
