import { beforeEach, describe, expect, it } from 'vitest';
import { toInfraUnavailableError } from '@/core/errors/infra-error';
import { resetInfraStateForTests } from '@/infra/runtime/infra-health';

describe('toInfraUnavailableError', () => {
  beforeEach(() => {
    resetInfraStateForTests();
  });

  it('maps Prisma connectivity failures to a 503 app error', () => {
    const error = Object.assign(new Error("Can't reach database server at localhost:5432"), {
      code: 'P1001'
    });

    const mapped = toInfraUnavailableError(error);

    expect(mapped).not.toBeNull();
    expect(mapped?.statusCode).toBe(503);
    expect(mapped?.message).toBe('Database temporarily unavailable');
    expect(mapped?.details).toMatchObject({
      retryInSeconds: 10
    });
  });

  it('maps Redis connectivity failures to a 503 app error', () => {
    const error = Object.assign(new Error('Redis connection is closed.'), {
      code: 'ECONNREFUSED'
    });

    const mapped = toInfraUnavailableError(error);

    expect(mapped).not.toBeNull();
    expect(mapped?.statusCode).toBe(503);
    expect(mapped?.message).toBe('Queue temporarily unavailable');
    expect(mapped?.details).toMatchObject({
      retryInSeconds: 10
    });
  });

  it('ignores non-infrastructure errors', () => {
    const mapped = toInfraUnavailableError(new Error('Validation failed'));
    expect(mapped).toBeNull();
  });
});
