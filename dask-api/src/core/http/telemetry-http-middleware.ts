import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { recordTelemetryEvent } from '@/core/telemetry/telemetry-recorder';
import { parseUserAgent } from '@/core/telemetry/user-agent';

function hashIp(ip: string | undefined): string | null {
  if (!ip) {
    return null;
  }

  const normalized = ip.trim();
  if (!normalized) {
    return null;
  }

  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function resolveCountry(req: Request): string | null {
  const value =
    (req.headers['cf-ipcountry'] as string | undefined) ??
    (req.headers['x-vercel-ip-country'] as string | undefined) ??
    null;

  return value ? value.trim().toUpperCase().slice(0, 16) : null;
}

export const telemetryHttpMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/health') {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationNs = elapsedNs > BigInt(0) ? elapsedNs : BigInt(0);
    // Legacy integer ms metric kept for backward compatibility.
    const durationMs = durationNs > BigInt(0) ? Math.max(1, Math.ceil(Number(durationNs) / 1_000_000)) : 0;
    const uaRaw = (req.headers['user-agent'] as string | undefined) ?? null;
    const ua = parseUserAgent(uaRaw);

    void recordTelemetryEvent({
      category: 'http',
      eventName: 'http.request',
      success: res.statusCode < 500,
      userId: req.auth?.userId ?? null,
      workspaceId: req.workspace?.id ?? null,
      method: req.method,
      route: req.path,
      statusCode: res.statusCode,
      durationMs,
      durationNs,
      reason: res.statusCode >= 500 ? 'server_error' : res.statusCode >= 400 ? 'client_error' : null,
      ipHash: hashIp(req.ip),
      country: resolveCountry(req),
      userAgent: uaRaw,
      browser: ua.browser,
      os: ua.os,
      deviceType: ua.deviceType
    });
  });

  next();
};
