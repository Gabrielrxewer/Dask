import { describe, expect, it, vi } from 'vitest';
import { maskCommunicationAddress, normalizeCommunicationAddress } from '@/modules/automation/communication/communication-address';
import { CommunicationContactService } from '@/modules/automation/communication/communication-contact-service';

function makeService() {
  const contacts: any[] = [];
  const channels: any[] = [];
  const prisma = {
    communicationContact: {
      create: vi.fn(async ({ data }) => {
        const contact = { id: `contact-${contacts.length + 1}`, archivedAt: null, ...data };
        contacts.push(contact);
        return contact;
      }),
      findFirst: vi.fn(async ({ where }) =>
        contacts.find((entry) =>
          entry.workspaceId === where.workspaceId
          && (!where.sourceType || entry.sourceType === where.sourceType)
          && (!where.sourceId || entry.sourceId === where.sourceId)
          && entry.archivedAt === null
        ) ?? null
      ),
      update: vi.fn(async ({ where, data }) => {
        const contact = contacts.find((entry) => entry.id === where.id);
        Object.assign(contact, data);
        return contact;
      })
    },
    communicationContactChannel: {
      findUnique: vi.fn(async ({ where }) => {
        const key = where.workspaceId_channel_normalizedAddress;
        const channel = channels.find((entry) =>
          entry.workspaceId === key.workspaceId
          && entry.channel === key.channel
          && entry.normalizedAddress === key.normalizedAddress
        );
        if (!channel) return null;
        return { ...channel, contact: contacts.find((entry) => entry.id === channel.contactId) };
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.workspaceId_channel_normalizedAddress;
        const existing = channels.find((entry) =>
          entry.workspaceId === key.workspaceId
          && entry.channel === key.channel
          && entry.normalizedAddress === key.normalizedAddress
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const channel = { id: `channel-${channels.length + 1}`, ...create };
        channels.push(channel);
        return channel;
      }),
      updateMany: vi.fn()
    }
  };

  return { service: new CommunicationContactService(prisma as any), contacts, channels };
}

describe('CommunicationContactService', () => {
  it('creates a contact and deduplicates by email channel in the same workspace', async () => {
    const { service, contacts, channels } = makeService();

    const first = await service.findOrCreateContact({
      workspaceId: 'ws-1',
      displayName: 'Maria',
      channel: 'email',
      address: 'Maria@Example.com'
    });
    await service.upsertChannel({
      workspaceId: 'ws-1',
      contactId: first.id,
      channel: 'email',
      address: 'Maria@Example.com',
      isPrimary: true
    });
    const second = await service.findOrCreateContact({
      workspaceId: 'ws-1',
      channel: 'email',
      address: 'maria@example.com'
    });

    expect(second.id).toBe(first.id);
    expect(contacts).toHaveLength(1);
    expect(channels[0]).toMatchObject({ normalizedAddress: 'maria@example.com', status: 'active' });
  });

  it('allows same email in different workspaces', async () => {
    const { service, contacts } = makeService();

    const one = await service.findOrCreateContact({ workspaceId: 'ws-1', channel: 'email', address: 'a@example.com' });
    await service.upsertChannel({ workspaceId: 'ws-1', contactId: one.id, channel: 'email', address: 'a@example.com' });
    const two = await service.findOrCreateContact({ workspaceId: 'ws-2', channel: 'email', address: 'a@example.com' });

    expect(two.id).not.toBe(one.id);
    expect(contacts).toHaveLength(2);
  });

  it('normalizes BR phone and prepares whatsapp channel without real send', async () => {
    const { service } = makeService();
    const contact = await service.findOrCreateContact({ workspaceId: 'ws-1', displayName: 'Phone contact' });

    const channel = await service.upsertChannel({
      workspaceId: 'ws-1',
      contactId: contact.id,
      channel: 'whatsapp',
      address: '(49) 99999-9999',
      isPrimary: true
    });

    expect(channel).toMatchObject({
      channel: 'whatsapp',
      normalizedAddress: '+5549999999999',
      status: 'unverified'
    });
    expect(normalizeCommunicationAddress('whatsapp', '(49) 99999-9999')).toBe('+5549999999999');
    expect(maskCommunicationAddress('whatsapp', '+5549999999999')).toBe('+55******9999');
  });

  it('marks short phones as invalid and archives contact', async () => {
    const { service } = makeService();
    const contact = await service.findOrCreateContact({ workspaceId: 'ws-1' });
    const channel = await service.upsertChannel({
      workspaceId: 'ws-1',
      contactId: contact.id,
      channel: 'phone',
      address: '123'
    });
    const archived = await service.archiveContact({ workspaceId: 'ws-1', contactId: contact.id });

    expect(channel.status).toBe('invalid');
    expect(archived.status).toBe('archived');
  });
});
