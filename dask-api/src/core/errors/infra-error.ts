import { AppError } from '@/core/errors/app-error';
import { getInfraStates, markInfraDependencyFailure } from '@/infra/runtime/infra-health';

const INFRA_RETRY_SECONDS = 10;
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'EPIPE'
]);
const PRISMA_INFRA_CODES = new Set(['P1001', 'P1002', 'P1017']);

type ErrorWithCode = Error & {
  code?: string;
  cause?: unknown;
};

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return String(error).toLowerCase();
}

function isRedisInfraError(error: ErrorWithCode, message: string): boolean {
  return (
    error.code === 'CONNECTION_CLOSED' ||
    NETWORK_ERROR_CODES.has(error.code ?? '') ||
    message.includes('redis') ||
    message.includes('max retries per request') ||
    message.includes('connection is closed') ||
    message.includes('stream isn\'t writeable') ||
    message.includes('connection is not yet established')
  );
}

function isDatabaseInfraError(error: ErrorWithCode, message: string): boolean {
  return (
    PRISMA_INFRA_CODES.has(error.code ?? '') ||
    message.includes('can\'t reach database server') ||
    message.includes('server has closed the connection') ||
    message.includes('prisma client could not locate the query engine') ||
    message.includes('prepared statement') ||
    message.includes('connection pool') ||
    (NETWORK_ERROR_CODES.has(error.code ?? '') &&
      (message.includes('postgres') || message.includes('prisma') || message.includes('database server')))
  );
}

export function toInfraUnavailableError(error: unknown): AppError | null {
  const candidate = error as ErrorWithCode;
  const message = extractMessage(error);

  if (isRedisInfraError(candidate, message)) {
    markInfraDependencyFailure('redis', error);
    return new AppError('Queue temporarily unavailable', 503, {
      retryInSeconds: INFRA_RETRY_SECONDS,
      dependencies: getInfraStates()
    });
  }

  if (isDatabaseInfraError(candidate, message)) {
    markInfraDependencyFailure('database', error);
    return new AppError('Database temporarily unavailable', 503, {
      retryInSeconds: INFRA_RETRY_SECONDS,
      dependencies: getInfraStates()
    });
  }

  return null;
}
