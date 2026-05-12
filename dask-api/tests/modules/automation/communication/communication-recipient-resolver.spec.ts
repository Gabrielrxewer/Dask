import { describe, expect, it, vi } from 'vitest';
import { CommunicationRecipientResolver } from '@/modules/automation/communication/communication-recipient-resolver';

function makeResolver(input?: { suppressed?: boolean; consentAllowed?: boolean; invalidChannel?: boolean }) {
  const contact = { id: 'contact-1', workspaceId: 'ws-1' };
  const channel = {
    id: 'channel-1',
    contactId: 'contact-1',
    workspaceId: 'ws-1',
    channel: 'email',
    address: 'Person@Example.com',
    normalizedAddress: 'person@example.com',
    status: 'active',
    contact
  };
  const contactService = {
    findBySource: vi.fn(async () => contact),
    findByChannelAddress: vi.fn(async ({ address, channel: channelName }) =>
      address === 'missing@example.com' || channelName === 'whatsapp' ? null : channel
    ),
    findOrCreateContact: vi.fn(async () => contact),
    upsertChannel: vi.fn(async ({ channel: channelName, address }) => ({
      ...channel,
      id: channelName === 'whatsapp' ? 'channel-whatsapp' : 'channel-1',
      channel: channelName,
      address,
      normalizedAddress: channelName === 'whatsapp' ? '+5549999999999' : 'missing@example.com',
      status: input?.invalidChannel ? 'invalid' : channelName === 'whatsapp' ? 'unverified' : 'active'
    }))
  };
  const consentService = {
    checkConsent: vi.fn(async () => ({
      allowed: input?.consentAllowed ?? true,
      status: input?.consentAllowed === false ? 'opted_out' : 'unknown',
      reason: input?.consentAllowed === false ? 'contact_opted_out' : undefined
    }))
  };
  const suppressionService = {
    checkSuppression: vi.fn(async () => ({
      blocked: input?.suppressed ?? false,
      reason: input?.suppressed ? 'unsubscribe' : undefined
    }))
  };
  const prisma = {
    communicationContact: {
      findFirst: vi.fn(async () => contact)
    },
    communicationContactChannel: {
      findFirst: vi.fn(async () => null)
    }
  };
  const resolver = new CommunicationRecipientResolver(prisma as any, {
    contactService: contactService as any,
    consentService: consentService as any,
    suppressionService: suppressionService as any
  });

  return { resolver, contactService, consentService, suppressionService };
}

describe('CommunicationRecipientResolver', () => {
  it('resolves by contactId and email literal', async () => {
    const { resolver } = makeResolver();

    await expect(resolver.resolveRecipient({
      workspaceId: 'ws-1',
      channel: 'email',
      address: 'Person@Example.com',
      recipient: { contactId: 'contact-1' }
    })).resolves.toMatchObject({
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      normalizedAddress: 'person@example.com',
      blocked: false
    });
  });

  it('resolves by source and contextJson', async () => {
    const { resolver, contactService } = makeResolver();

    await resolver.resolveRecipient({
      workspaceId: 'ws-1',
      channel: 'email',
      recipient: { sourceType: 'work_item', sourceId: 'work-item-1' },
      context: { contact: { email: 'Person@Example.com' } }
    });

    expect(contactService.findBySource).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      sourceType: 'work_item',
      sourceId: 'work-item-1'
    });
  });

  it('blocks suppressed and opted-out recipients', async () => {
    await expect(makeResolver({ suppressed: true }).resolver.resolveRecipient({
      workspaceId: 'ws-1',
      channel: 'email',
      address: 'Person@Example.com'
    })).resolves.toMatchObject({ blocked: true, blockReason: 'suppressed' });

    await expect(makeResolver({ consentAllowed: false }).resolver.resolveRecipient({
      workspaceId: 'ws-1',
      channel: 'email',
      address: 'Person@Example.com'
    })).resolves.toMatchObject({ blocked: true, blockReason: 'contact_opted_out' });
  });

  it('returns whatsapp channel structurally without sending', async () => {
    const { resolver } = makeResolver();

    await expect(resolver.resolveRecipient({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '(49) 99999-9999'
    })).resolves.toMatchObject({
      channel: 'whatsapp',
      normalizedAddress: '+5549999999999'
    });
  });

  it('blocks invalid WhatsApp contact channels', async () => {
    await expect(makeResolver({ consentAllowed: true, invalidChannel: true }).resolver.resolveRecipient({
      workspaceId: 'ws-1',
      channel: 'whatsapp',
      address: '(49) 99999-9999'
    })).resolves.toMatchObject({
      blocked: true,
      blockReason: 'channel_invalid'
    });
  });
});
