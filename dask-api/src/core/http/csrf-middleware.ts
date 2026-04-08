import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/core/errors/app-error';
import { logger } from '@/core/logging/logger';
import { SESSION_COOKIE_NAME } from '@/core/http/cookie-config';

export type CsrfMiddlewareOptions = {
  secret: string;
  allowedOrigins: string[];
};

export function generateCsrfToken(rawRefreshToken: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawRefreshToken, 'utf8').digest('hex');
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin);
}

function isCrossSiteFetchSite(value: string | undefined): boolean {
  return value === 'cross-site';
}

function reject(next: NextFunction, message: string, details: Record<string, unknown>): void {
  logger.warn({ event: 'csrf.rejected', ...details });
  next(new AppError(message, 403));
}

export function createCsrfMiddleware({ secret, allowedOrigins }: CsrfMiddlewareOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const rawRefreshToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    // No cookie-backed session on this request.
    if (!rawRefreshToken) {
      next();
      return;
    }

    const origin = req.headers.origin as string | undefined;
    const secFetchSite = req.headers['sec-fetch-site'] as string | undefined;

    // Primary check: when Origin is present, it must be explicitly allowlisted.
    if (origin && !isAllowedOrigin(origin, allowedOrigins)) {
      reject(next, 'CSRF validation failed.', {
        reason: 'origin_not_allowed',
        origin,
        ip: req.ip
      });
      return;
    }

    // Defense-in-depth: explicit browser cross-site hint without allowlisted origin.
    if (isCrossSiteFetchSite(secFetchSite) && (!origin || !isAllowedOrigin(origin, allowedOrigins))) {
      reject(next, 'CSRF validation failed.', {
        reason: 'cross_site_fetch',
        origin,
        secFetchSite,
        ip: req.ip
      });
      return;
    }

    const headerToken = req.headers['x-csrf-token'] as string | undefined;

    if (!headerToken) {
      reject(next, 'CSRF token required.', {
        reason: 'missing_header_token',
        ip: req.ip
      });
      return;
    }

    const expected = generateCsrfToken(rawRefreshToken, secret);

    let valid = false;
    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const headerBuf = Buffer.from(headerToken, 'hex');
      valid = expectedBuf.length === headerBuf.length && crypto.timingSafeEqual(expectedBuf, headerBuf);
    } catch {
      valid = false;
    }

    if (!valid) {
      reject(next, 'CSRF validation failed.', {
        reason: 'invalid_token',
        ip: req.ip
      });
      return;
    }

    next();
  };
}
