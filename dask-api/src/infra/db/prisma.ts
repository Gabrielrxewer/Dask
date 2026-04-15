import { PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import { createDebugLogger, getLogger } from '@/core/logging/logger';

const prismaLogger = getLogger('prisma');
const queryDebug = createDebugLogger('db.query');
const TX_CONTROL_QUERIES = new Set(['BEGIN', 'COMMIT', 'ROLLBACK']);

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

function isOutboxPollQuery(normalizedQuery: string): boolean {
  return (
    normalizedQuery.includes('FROM "DomainOutbox"') &&
    normalizedQuery.includes('FOR UPDATE SKIP LOCKED') &&
    normalizedQuery.includes('LIMIT 1')
  );
}

function shouldLogQuery(event: { query: string; duration: number }): boolean {
  const normalizedQuery = normalizeQuery(event.query);

  if (!env.LOG_DB_QUERY_INCLUDE_TX_CONTROL && TX_CONTROL_QUERIES.has(normalizedQuery)) {
    return false;
  }

  if (!env.LOG_DB_QUERY_INCLUDE_OUTBOX_POLL && isOutboxPollQuery(normalizedQuery)) {
    return false;
  }

  if (event.duration < env.LOG_DB_QUERY_MIN_DURATION_MS) {
    return false;
  }

  return true;
}

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' }
  ]
});

prisma.$on('query', (event) => {
  if (!shouldLogQuery(event)) {
    return;
  }

  queryDebug.log(
    {
      durationMs: event.duration,
      target: event.target,
      query: truncate(normalizeQuery(event.query), 800),
      params: truncate(event.params, 400)
    },
    'Prisma query'
  );
});

prisma.$on('info', (event) => {
  prismaLogger.info({ target: event.target }, event.message);
});

prisma.$on('warn', (event) => {
  prismaLogger.warn({ target: event.target }, event.message);
});

prisma.$on('error', (event) => {
  prismaLogger.error({ target: event.target }, event.message);
});
