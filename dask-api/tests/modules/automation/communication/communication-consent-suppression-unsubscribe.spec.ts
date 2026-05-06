import { describe, expect, it, vi } from 'vitest';
import { CommunicationConsentService } from '@/modules/automation/communication/communication-consent-service';
import { CommunicationSuppressionService } from '@/modules/automation/communication/communication-suppression-service';
import { CommunicationUnsubscribeService } from '@/modules/automation/communication/communication-unsubscribe-service';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makePrisma() {
  const consents: any[] = [];
  const suppressions: any[] = [];
  const tokens: any[] = [];
  const prisma = {
    contactConsent: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.workspaceId_channel_address;
        const existing = consents.find((entry) => entry.workspaceId === key.workspaceId && entry.channel === key.channel && entry.address === key.address);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const record = { id: `consent-${consents.length + 1}`, createdAt: baseDate, updatedAt: baseDate, ...create };
        consents.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }) => {
        const key = where.workspaceId_channel_address;
        return consents.find((entry) => entry.workspaceId === key.workspaceId && entry.channel === key.channel && entry.address === key.address) ?? null;
      })
    },
    communicationSuppression: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.workspaceId_channel_address;
        const existing = suppressions.find((entry) => entry.workspaceId === key.workspaceId && entry.channel === key.channel && entry.address === key.address);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const record = { id: `suppression-${suppressions.length + 1}`, createdAt: baseDate, ...create };
        suppressions.push(record);
        return record;
      }),
      findFirst: vi.fn(async ({ where }) =>
        suppressions.find((entry) => entry.workspaceId === where.workspaceId && entry.channel === where.channel && entry.address === where.address) ?? null
      )
    },
    communicationUnsubscribeToken: {
      create: vi.fn(async ({ data }) => {
        const record = { id: `token-${tokens.length + 1}`, usedAt: null, createdAt: baseDate, ...data };
        tokens.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }) => tokens.find((entry) => entry.tokenHash === where.tokenHash) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const record = tokens.find((entry) => entry.id === where.id);
        Object.assign(record, data);
        return record;
      })
    }
  };

  return { prisma, consents, suppressions, tokens };
}

describe('CommunicationConsentService', () => {
  it('creates opt-in and opt-out consent and applies category rules', async () => {
    const { prisma } = makePrisma();
    const service = new CommunicationConsentService(prisma as any);

    await service.optIn({ workspaceId: 'ws-1', address: 'Person@Example.com', source: 'manual' });
    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      address: 'person@example.com',
      category: 'marketing'
    })).resolves.toMatchObject({ allowed: true, status: 'opted_in' });

    await service.optOut({ workspaceId: 'ws-1', address: 'person@example.com', source: 'manual' });
    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      address: 'person@example.com',
      category: 'follow_up'
    })).resolves.toMatchObject({ allowed: false, status: 'opted_out' });
  });

  it('blocks marketing when consent is unknown but allows transactional', async () => {
    const { prisma } = makePrisma();
    const service = new CommunicationConsentService(prisma as any);

    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      address: 'person@example.com',
      category: 'marketing'
    })).resolves.toMatchObject({ allowed: false, reason: 'marketing_requires_opt_in' });

    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      address: 'person@example.com',
      category: 'transactional'
    })).resolves.toMatchObject({ allowed: true, status: 'unknown' });
  });

  it('requires explicit WhatsApp opt-in and blocks opted-out or suppressed statuses', async () => {
    const { prisma } = makePrisma();
    const service = new CommunicationConsentService(prisma as any);

    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '(49) 99999-9999',
      category: 'utility'
    })).resolves.toMatchObject({
      allowed: false,
      status: 'unknown',
      reason: 'whatsapp_requires_opt_in',
      address: '+5549999999999'
    });

    await service.optIn({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      source: 'manual'
    });
    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      category: 'utility'
    })).resolves.toMatchObject({ allowed: true, status: 'opted_in' });

    await service.optOut({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      source: 'manual'
    });
    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      category: 'utility'
    })).resolves.toMatchObject({ allowed: false, status: 'opted_out' });

    await service.upsertConsent({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      status: 'suppressed'
    });
    await expect(service.checkConsent({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '+5549999999999',
      category: 'utility'
    })).resolves.toMatchObject({ allowed: false, status: 'suppressed' });
  });
});

describe('CommunicationSuppressionService', () => {
  it('normalizes email, prevents duplicates and blocks sending', async () => {
    const { prisma, suppressions } = makePrisma();
    const service = new CommunicationSuppressionService(prisma as any);

    await service.suppress({ workspaceId: 'ws-1', address: 'Person@Example.com', reason: 'unsubscribe' });
    await service.suppress({ workspaceId: 'ws-1', address: 'person@example.com', reason: 'manual_block' });

    expect(suppressions).toHaveLength(1);
    await expect(service.checkSuppression({
      workspaceId: 'ws-1',
      address: 'PERSON@example.com'
    })).resolves.toMatchObject({ blocked: true, reason: 'manual_block' });
  });
});

describe('CommunicationUnsubscribeService', () => {
  it('generates and consumes tokens idempotently', async () => {
    const { prisma, suppressions } = makePrisma();
    const service = new CommunicationUnsubscribeService(prisma as any);
    const { token } = await service.createToken({
      workspaceId: 'ws-1',
      address: 'Person@Example.com',
      category: 'follow_up'
    });

    await expect(service.consumeToken({ token, now: baseDate })).resolves.toMatchObject({
      status: 'unsubscribed',
      address: 'person@example.com'
    });
    await expect(service.consumeToken({ token, now: baseDate })).resolves.toMatchObject({
      status: 'already_used'
    });
    expect(suppressions).toHaveLength(1);
  });

  it('rejects invalid tokens without exposing contact data', async () => {
    const { prisma } = makePrisma();
    const service = new CommunicationUnsubscribeService(prisma as any);

    await expect(service.consumeToken({ token: 'invalid-token' })).rejects.toThrow('Invalid unsubscribe token.');
  });
});
