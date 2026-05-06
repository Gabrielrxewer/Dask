import { createHash } from 'crypto';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

export type NormalizedWhatsAppProviderEvent = {
  provider: 'meta' | 'mock';
  channel: 'whatsapp';
  providerEventId: string;
  providerMessageId?: string;
  eventType:
    | 'whatsapp.sent'
    | 'whatsapp.delivered'
    | 'whatsapp.read'
    | 'whatsapp.failed'
    | 'whatsapp.replied'
    | 'whatsapp.inbound_message';
  occurredAt?: Date;
  from?: string;
  to?: string;
  phoneNumberId?: string;
  text?: string;
  messageType?: string;
  errorCode?: string;
  errorMessage?: string;
  raw: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumberString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return readString(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((entry) => JSON.parse(stableStringify(entry))));
  }
  if (!isRecord(value)) {
    return JSON.stringify(value);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = JSON.parse(stableStringify(value[key]));
  }
  return JSON.stringify(sorted);
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableStringify(sanitizeAutomationPayload(value))).digest('hex');
}

function parseTimestamp(value: unknown): Date | undefined {
  const raw = readNumberString(value);
  if (!raw) {
    return undefined;
  }

  const numeric = Number(raw);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapStatus(status: string | undefined): NormalizedWhatsAppProviderEvent['eventType'] {
  const normalized = status?.trim().toLowerCase();
  if (normalized === 'delivered') {
    return 'whatsapp.delivered';
  }
  if (normalized === 'read') {
    return 'whatsapp.read';
  }
  if (normalized === 'failed') {
    return 'whatsapp.failed';
  }
  return 'whatsapp.sent';
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  return Array.isArray(value) && isRecord(value[0]) ? value[0] : undefined;
}

function normalizeStatusEvent(input: {
  payload: Record<string, unknown>;
  value: Record<string, unknown>;
  status: Record<string, unknown>;
}): NormalizedWhatsAppProviderEvent {
  const status = readString(input.status.status);
  const errors = firstRecord(input.status.errors);
  const providerMessageId = readString(input.status.id);
  const conversation = isRecord(input.status.conversation) ? input.status.conversation : undefined;
  const providerEventId =
    readString(input.status.id) && status
      ? `${input.status.id}:${status}:${readNumberString(input.status.timestamp) ?? 'unknown'}`
      : `hash:${hashPayload(input.payload)}`;

  return {
    provider: 'meta',
    channel: 'whatsapp',
    providerEventId,
    providerMessageId,
    eventType: mapStatus(status),
    occurredAt: parseTimestamp(input.status.timestamp),
    from: readString(input.status.recipient_id),
    to: readString(input.value.metadata && isRecord(input.value.metadata) ? input.value.metadata.display_phone_number : undefined),
    phoneNumberId: readString(input.value.metadata && isRecord(input.value.metadata) ? input.value.metadata.phone_number_id : undefined),
    errorCode: readNumberString(errors?.code),
    errorMessage: readString(errors?.message) ?? readString(errors?.title),
    raw: {
      ...input.payload,
      conversationId: readString(conversation?.id)
    }
  };
}

function normalizeMessageEvent(input: {
  payload: Record<string, unknown>;
  value: Record<string, unknown>;
  message: Record<string, unknown>;
}): NormalizedWhatsAppProviderEvent {
  const text = isRecord(input.message.text) ? readString(input.message.text.body) : undefined;
  const messageType = readString(input.message.type) ?? 'unknown';
  const providerMessageId = readString(input.message.id);
  const phoneNumberId = readString(input.value.metadata && isRecord(input.value.metadata) ? input.value.metadata.phone_number_id : undefined);
  const eventType = messageType === 'text' ? 'whatsapp.replied' : 'whatsapp.inbound_message';

  return {
    provider: 'meta',
    channel: 'whatsapp',
    providerEventId: providerMessageId ?? `hash:${hashPayload(input.payload)}`,
    providerMessageId,
    eventType,
    occurredAt: parseTimestamp(input.message.timestamp),
    from: readString(input.message.from),
    to: readString(input.value.metadata && isRecord(input.value.metadata) ? input.value.metadata.display_phone_number : undefined),
    phoneNumberId,
    text,
    messageType,
    raw: input.payload
  };
}

export function normalizeMetaWhatsAppWebhookEvents(payload: unknown): NormalizedWhatsAppProviderEvent[] {
  if (!isRecord(payload)) {
    throw new Error('Invalid WhatsApp webhook payload.');
  }

  const events: NormalizedWhatsAppProviderEvent[] = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      if (!isRecord(change) || !isRecord(change.value)) {
        continue;
      }
      const value = change.value;
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const status of statuses) {
        if (isRecord(status)) {
          events.push(normalizeStatusEvent({ payload, value, status }));
        }
      }
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        if (isRecord(message)) {
          events.push(normalizeMessageEvent({ payload, value, message }));
        }
      }
    }
  }

  if (events.length === 0) {
    events.push({
      provider: 'meta',
      channel: 'whatsapp',
      providerEventId: `hash:${hashPayload(payload)}`,
      eventType: 'whatsapp.inbound_message',
      raw: payload
    });
  }

  return events;
}
