import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { TelemetryEventInput } from '@/core/telemetry/telemetry-recorder';

type Nullable = string | null | undefined;

function normalizeText(value: Nullable, max = 250): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
}

function sanitizeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

function hashIp(ip: Nullable): string | null {
  const normalized = normalizeText(ip, 120);
  if (!normalized) {
    return null;
  }
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function toStoredIpHash(value: Nullable): string | null {
  const normalized = normalizeText(value, 128);
  if (!normalized) {
    return null;
  }

  if (/^[a-f0-9]{64}$/i.test(normalized)) {
    return normalized.toLowerCase();
  }

  return hashIp(normalized);
}

export function createPrismaTelemetryRecorder(prisma: PrismaClient) {
  return async (event: TelemetryEventInput): Promise<void> => {
    const id = crypto.randomUUID();
    const metadata = sanitizeMetadata(event.metadata);

    await prisma.$executeRaw`
      INSERT INTO "TelemetryEvent" (
        "id",
        "category",
        "eventName",
        "success",
        "userId",
        "workspaceId",
        "method",
        "route",
        "statusCode",
        "durationMs",
        "durationNs",
        "reason",
        "provider",
        "ipHash",
        "country",
        "city",
        "userAgent",
        "browser",
        "os",
        "deviceType",
        "metadata",
        "occurredAt"
      ) VALUES (
        ${id},
        ${normalizeText(event.category, 80) ?? 'unknown'},
        ${normalizeText(event.eventName, 120) ?? 'unknown'},
        ${event.success ?? null},
        ${normalizeText(event.userId, 80)},
        ${normalizeText(event.workspaceId, 80)},
        ${normalizeText(event.method, 12)},
        ${normalizeText(event.route, 220)},
        ${event.statusCode ?? null},
        ${event.durationMs ?? null},
        ${event.durationNs ?? null},
        ${normalizeText(event.reason, 240)},
        ${normalizeText(event.provider, 80)},
        ${toStoredIpHash(event.ipHash)},
        ${normalizeText(event.country, 32)},
        ${normalizeText(event.city, 80)},
        ${normalizeText(event.userAgent, 240)},
        ${normalizeText(event.browser, 40)},
        ${normalizeText(event.os, 40)},
        ${normalizeText(event.deviceType, 20)},
        CAST(${metadata} AS JSONB),
        ${event.occurredAt ?? new Date()}
      )
    `;
  };
}
