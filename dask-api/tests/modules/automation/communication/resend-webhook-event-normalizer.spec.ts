import { describe, expect, it } from 'vitest';
import { normalizeResendWebhookEvent } from '@/modules/automation/communication/resend-webhook-event-normalizer';

describe('normalizeResendWebhookEvent', () => {
  it('normalizes delivered events', () => {
    const event = normalizeResendWebhookEvent({
      id: 'evt-1',
      type: 'email.delivered',
      created_at: '2026-05-05T12:00:00.000Z',
      data: {
        email: {
          id: 'resend_123',
          to: 'person@example.com',
          subject: 'Hello'
        }
      }
    });

    expect(event).toMatchObject({
      provider: 'resend',
      channel: 'email',
      providerEventId: 'evt-1',
      providerMessageId: 'resend_123',
      eventType: 'email.delivered',
      recipient: 'person@example.com'
    });
  });

  it('normalizes bounced and complained events', () => {
    expect(normalizeResendWebhookEvent({
      id: 'evt-bounce',
      type: 'email.bounced',
      data: { email_id: 'resend_1', to: 'bad@example.com' }
    })).toMatchObject({ eventType: 'email.bounced', providerMessageId: 'resend_1' });

    expect(normalizeResendWebhookEvent({
      id: 'evt-complaint',
      type: 'email.complained',
      data: { message_id: 'resend_2', recipient: 'angry@example.com' }
    })).toMatchObject({ eventType: 'email.complained', providerMessageId: 'resend_2' });
  });

  it('normalizes opened and clicked events', () => {
    expect(normalizeResendWebhookEvent({
      id: 'evt-open',
      type: 'email.opened',
      data: { email: { id: 'resend_1' } }
    }).eventType).toBe('email.opened');
    expect(normalizeResendWebhookEvent({
      id: 'evt-click',
      type: 'email.clicked',
      data: { email: { id: 'resend_1' } }
    }).eventType).toBe('email.clicked');
  });

  it('handles incomplete payloads and creates a stable hash event id', () => {
    const event = normalizeResendWebhookEvent({
      type: 'email.failed',
      data: {}
    });

    expect(event.providerEventId).toMatch(/^hash:/);
    expect(event.eventType).toBe('email.failed');
    expect(event.providerMessageId).toBeUndefined();
  });
});
