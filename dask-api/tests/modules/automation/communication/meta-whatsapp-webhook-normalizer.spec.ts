import { describe, expect, it } from 'vitest';
import { normalizeMetaWhatsAppWebhookEvents } from '@/modules/automation/communication/meta-whatsapp-webhook-normalizer';

function makeStatusPayload(status: string) {
  return {
    entry: [{
      changes: [{
        value: {
          metadata: {
            display_phone_number: '554933333333',
            phone_number_id: 'phone-number-1'
          },
          statuses: [{
            id: 'wamid.status.1',
            status,
            timestamp: '1777982400',
            recipient_id: '5549999999999',
            errors: status === 'failed' ? [{ code: 131047, message: 'Expired window' }] : undefined
          }]
        }
      }]
    }]
  };
}

describe('normalizeMetaWhatsAppWebhookEvents', () => {
  it('normalizes delivered, read and failed status events', () => {
    expect(normalizeMetaWhatsAppWebhookEvents(makeStatusPayload('delivered'))[0]).toEqual(
      expect.objectContaining({
        provider: 'meta',
        channel: 'whatsapp',
        providerMessageId: 'wamid.status.1',
        eventType: 'whatsapp.delivered',
        from: '5549999999999',
        phoneNumberId: 'phone-number-1'
      })
    );
    expect(normalizeMetaWhatsAppWebhookEvents(makeStatusPayload('read'))[0]).toEqual(
      expect.objectContaining({ eventType: 'whatsapp.read' })
    );
    expect(normalizeMetaWhatsAppWebhookEvents(makeStatusPayload('failed'))[0]).toEqual(
      expect.objectContaining({
        eventType: 'whatsapp.failed',
        errorCode: '131047',
        errorMessage: 'Expired window'
      })
    );
  });

  it('normalizes inbound text replies', () => {
    const [event] = normalizeMetaWhatsAppWebhookEvents({
      entry: [{
        changes: [{
          value: {
            metadata: {
              display_phone_number: '554933333333',
              phone_number_id: 'phone-number-1'
            },
            messages: [{
              id: 'wamid.reply.1',
              from: '5549999999999',
              timestamp: '1777982400',
              type: 'text',
              text: { body: 'Ola, tenho interesse' }
            }]
          }
        }]
      }]
    });

    expect(event).toEqual(
      expect.objectContaining({
        providerEventId: 'wamid.reply.1',
        providerMessageId: 'wamid.reply.1',
        eventType: 'whatsapp.replied',
        from: '5549999999999',
        to: '554933333333',
        text: 'Ola, tenho interesse',
        messageType: 'text'
      })
    );
    expect(event.occurredAt?.toISOString()).toBe('2026-05-05T12:00:00.000Z');
  });

  it('handles incomplete payloads with a stable hash event id', () => {
    const [event] = normalizeMetaWhatsAppWebhookEvents({ object: 'whatsapp_business_account' });

    expect(event.providerEventId).toMatch(/^hash:/);
    expect(event.eventType).toBe('whatsapp.inbound_message');
  });
});
