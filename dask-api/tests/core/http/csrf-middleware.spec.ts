import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/core/errors/app-error';
import { SESSION_COOKIE_NAME } from '@/core/http/cookie-config';
import { createCsrfMiddleware, generateCsrfToken } from '@/core/http/csrf-middleware';

type ReqInit = {
  cookies?: Record<string, string>;
  headers?: Record<string, string | undefined>;
  ip?: string;
};

function makeReq(init: ReqInit = {}): Request {
  return {
    cookies: init.cookies ?? {},
    headers: init.headers ?? {},
    ip: init.ip ?? '127.0.0.1'
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

async function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request
): Promise<unknown> {
  return new Promise((resolve) => {
    middleware(req, makeRes(), (err?: unknown) => resolve(err));
  });
}

describe('generateCsrfToken', () => {
  it('generates deterministic HMAC for the same input', () => {
    const tokenA = generateCsrfToken('refresh-token', 'secret-12345678901234567890123456789012');
    const tokenB = generateCsrfToken('refresh-token', 'secret-12345678901234567890123456789012');

    expect(tokenA).toBe(tokenB);
    expect(tokenA).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('createCsrfMiddleware', () => {
  const secret = 'csrf-secret-123456789012345678901234';
  const allowedOrigin = 'http://localhost:5173';

  it('allows requests without session cookie', async () => {
    const middleware = createCsrfMiddleware({
      secret,
      allowedOrigins: [allowedOrigin]
    });

    const err = await runMiddleware(middleware, makeReq());
    expect(err).toBeUndefined();
  });

  it('rejects when Origin is not allowlisted', async () => {
    const middleware = createCsrfMiddleware({
      secret,
      allowedOrigins: [allowedOrigin]
    });

    const req = makeReq({
      cookies: { [SESSION_COOKIE_NAME]: 'refresh-token' },
      headers: {
        origin: 'https://evil.example',
        'x-csrf-token': generateCsrfToken('refresh-token', secret)
      }
    });

    const err = await runMiddleware(middleware, req);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('rejects cross-site fetch hint without allowlisted origin', async () => {
    const middleware = createCsrfMiddleware({
      secret,
      allowedOrigins: [allowedOrigin]
    });

    const req = makeReq({
      cookies: { [SESSION_COOKIE_NAME]: 'refresh-token' },
      headers: {
        'sec-fetch-site': 'cross-site',
        'x-csrf-token': generateCsrfToken('refresh-token', secret)
      }
    });

    const err = await runMiddleware(middleware, req);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('rejects when CSRF header token is missing', async () => {
    const middleware = createCsrfMiddleware({
      secret,
      allowedOrigins: [allowedOrigin]
    });

    const req = makeReq({
      cookies: { [SESSION_COOKIE_NAME]: 'refresh-token' },
      headers: {
        origin: allowedOrigin
      }
    });

    const err = await runMiddleware(middleware, req);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('rejects when CSRF header token is invalid', async () => {
    const middleware = createCsrfMiddleware({
      secret,
      allowedOrigins: [allowedOrigin]
    });

    const req = makeReq({
      cookies: { [SESSION_COOKIE_NAME]: 'refresh-token' },
      headers: {
        origin: allowedOrigin,
        'x-csrf-token': 'invalid-token'
      }
    });

    const err = await runMiddleware(middleware, req);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('accepts valid signed token with allowlisted origin', async () => {
    const middleware = createCsrfMiddleware({
      secret,
      allowedOrigins: [allowedOrigin]
    });

    const refreshToken = 'refresh-token';
    const req = makeReq({
      cookies: { [SESSION_COOKIE_NAME]: refreshToken },
      headers: {
        origin: allowedOrigin,
        'sec-fetch-site': 'same-site',
        'x-csrf-token': generateCsrfToken(refreshToken, secret)
      }
    });

    const err = await runMiddleware(middleware, req);
    expect(err).toBeUndefined();
  });
});
