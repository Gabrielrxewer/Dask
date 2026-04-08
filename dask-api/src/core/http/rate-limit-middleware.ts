import type { NextFunction, Request, Response } from 'express';

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

export type RateLimiterOptions = {
  windowMs: number;
  max: number;
};

export const createRateLimiter = ({ windowMs, max }: RateLimiterOptions) => {
  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up expired records to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt < now) store.delete(key);
    }
  }, windowMs);

  // Allow GC to collect the interval when the map is no longer referenced
  if (cleanupInterval.unref) cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.ip ?? req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '');
    const now = Date.now();
    const record = store.get(key);

    if (!record || record.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        error: 'Too many requests',
        retryAfter
      });
      return;
    }

    record.count++;
    next();
  };
};
