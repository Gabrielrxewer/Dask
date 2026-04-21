import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { infraAvailabilityMiddleware } from '@/core/http/infra-availability-middleware';
import {
  markInfraDependencyFailure,
  markInfraDependencyHealthyForTests,
  resetInfraStateForTests
} from '@/infra/runtime/infra-health';

function makeReq(): Request {
  return {} as Request;
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  } as Response & { statusCode: number; body: unknown };
}

describe('infraAvailabilityMiddleware', () => {
  beforeEach(() => {
    resetInfraStateForTests();
  });

  it('allows the request when infrastructure is healthy', () => {
    const res = makeRes();
    const next = vi.fn<[unknown?], void>();

    markInfraDependencyHealthyForTests('database');
    markInfraDependencyHealthyForTests('redis');
    infraAvailabilityMiddleware(makeReq(), res, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('returns 503 when a critical dependency is unavailable', () => {
    const res = makeRes();
    const next = vi.fn<[unknown?], void>();

    markInfraDependencyFailure('database', new Error('db offline'));
    infraAvailabilityMiddleware(makeReq(), res, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      message: 'Infrastructure temporarily unavailable',
      retryInSeconds: 10
    });
  });
});
