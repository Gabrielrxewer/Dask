import { createHash } from 'crypto';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

export type NormalizedCommunicationProviderEvent = {
  provider: 'resend';
  channel: 'email';
  providerEventId: string;
  providerMessageId?: string;
  eventType: string;
  occurredAt?: Date;
  recipient?: string;
  subject?: string;
  metadata?: Record<string, unknown>;
  raw: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function stableStringify(value: unknown): string {
  if (!isRecord(value)) {
    return JSON.stringify(value);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = isRecord(value[key]) ? JSON.parse(stableStringify(value[key])) : value[key];
  }

  return JSON.stringify(sorted);
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableStringify(sanitizeAutomationPayload(value))).digest('hex');
}

function mapResendEventType(rawType: string | undefined): string {
  const type = rawType?.trim().toLowerCase() ?? 'unknown';
  const normalized = type.replace(/^email\./, '');
  const map: Record<string, string> = {
    sent: 'email.sent',
    delivered: 'email.delivered',
    delivery_delayed: 'email.delivery_delayed',
    bounced: 'email.bounced',
    complained: 'email.complained',
    complained_received: 'email.complained',
    opened: 'email.opened',
    clicked: 'email.clicked',
    unsubscribed: 'email.unsubscribed',
    failed: 'email.failed'
  };

  return map[normalized] ?? `email.${normalized}`;
}

export function normalizeResendWebhookEvent(payload: unknown): NormalizedCommunicationProviderEvent {
  if (!isRecord(payload)) {
    throw new Error('Invalid Resend webhook payload.');
  }

  const data = isRecord(payload.data) ? payload.data : payload;
  const email = isRecord(data.email) ? data.email : data;
  const rawType = readString(payload.type) ?? readString(data.type) ?? readString(payload.event);
  const providerMessageId =
    readString(email.id)
    ?? readString(email.email_id)
    ?? readString(data.email_id)
    ?? readString(data.message_id)
    ?? readString(data.messageId);
  const providerEventId =
    readString(payload.id)
    ?? readString(data.id)
    ?? readString(data.event_id)
    ?? `hash:${hashPayload(payload)}`;
  const occurredAtRaw = readString(payload.created_at) ?? readString(data.created_at) ?? readString(data.timestamp);
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : undefined;

  return {
    provider: 'resend',
    channel: 'email',
    providerEventId,
    providerMessageId,
    eventType: mapResendEventType(rawType),
    occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : undefined,
    recipient: readString(email.to) ?? readString(data.to) ?? readString(data.recipient),
    subject: readString(email.subject) ?? readString(data.subject),
    metadata: isRecord(email.headers) ? email.headers : undefined,
    raw: payload
  };
}
