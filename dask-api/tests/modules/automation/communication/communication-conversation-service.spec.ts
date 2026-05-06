import { describe, expect, it, vi } from 'vitest';
import { CommunicationConversationService } from '@/modules/automation/communication/communication-conversation-service';

const baseDate = new Date('2026-05-06T12:00:00.000Z');

function makePrisma() {
  const conversations: any[] = [];
  const interactions: any[] = [];
  const contacts = [{
    id: 'contact-1',
    workspaceId: 'ws-1',
    displayName: 'Maria',
    companyName: null,
    primaryEmail: 'maria@example.com',
    primaryPhone: '+5549999999999',
    preferredChannel: 'whatsapp',
    status: 'active',
    archivedAt: null
  }];
  const channels = [{
    id: 'channel-1',
    workspaceId: 'ws-1',
    contactId: 'contact-1',
    channel: 'whatsapp',
    address: '+5549999999999',
    normalizedAddress: '+5549999999999',
    status: 'active',
    isPrimary: true
  }];
  const prisma = {
    communicationContact: {
      findFirst: vi.fn(async ({ where }) =>
        contacts.find((contact) =>
          contact.id === where.id
          && contact.workspaceId === where.workspaceId
          && contact.archivedAt === where.archivedAt
        ) ?? null
      )
    },
    communicationContactChannel: {
      findFirst: vi.fn(async ({ where }) =>
        channels.find((channel) =>
          (!where.id || channel.id === where.id)
          && (!where.workspaceId || channel.workspaceId === where.workspaceId)
          && (!where.contactId || channel.contactId === where.contactId)
          && (!where.channel || channel.channel === where.channel)
        ) ?? null
      )
    },
    communicationConversation: {
      findFirst: vi.fn(async ({ where }) =>
        conversations.find((conversation) =>
          (!where.id || conversation.id === where.id)
          && (!where.workspaceId || conversation.workspaceId === where.workspaceId)
          && (!where.contactId || conversation.contactId === where.contactId)
          && (!where.primaryChannel || conversation.primaryChannel === where.primaryChannel)
          && (where.status?.in ? where.status.in.includes(conversation.status) : true)
        ) ?? null
      ),
      create: vi.fn(async ({ data }) => {
        const conversation = {
          id: `conversation-${conversations.length + 1}`,
          lastMessageAt: null,
          lastInboundAt: null,
          lastOutboundAt: null,
          lastMessagePreview: null,
          unreadCount: 0,
          createdAt: baseDate,
          updatedAt: baseDate,
          archivedAt: null,
          resolvedAt: null,
          ...data
        };
        conversations.push(conversation);
        return conversation;
      }),
      update: vi.fn(async ({ where, data }) => {
        const conversation = conversations.find((entry) => entry.id === where.id);
        Object.assign(conversation, data);
        return conversation;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const conversation of conversations) {
          if (where.id && conversation.id !== where.id) continue;
          if (where.workspaceId && conversation.workspaceId !== where.workspaceId) continue;
          if (data.unreadCount?.increment) {
            conversation.unreadCount += data.unreadCount.increment;
          }
          const { unreadCount, ...rest } = data;
          if (!data.unreadCount?.increment && unreadCount !== undefined) {
            conversation.unreadCount = unreadCount;
          }
          Object.assign(conversation, rest);
          count += 1;
        }
        return { count };
      }),
      findMany: vi.fn(async () => conversations)
    },
    communicationInteraction: {
      create: vi.fn(async ({ data }) => {
        const interaction = { id: `interaction-${interactions.length + 1}`, createdAt: baseDate, ...data };
        interactions.push(interaction);
        return interaction;
      }),
      findFirst: vi.fn(async ({ where }) =>
        interactions.find((interaction) =>
          (!where.workspaceId || interaction.workspaceId === where.workspaceId)
          && (!where.sideEffectId || interaction.sideEffectId === where.sideEffectId)
          && (!where.approvalRequestId || interaction.approvalRequestId === where.approvalRequestId)
        ) ?? null
      ),
      update: vi.fn(async ({ where, data }) => {
        const interaction = interactions.find((entry) => entry.id === where.id);
        Object.assign(interaction, data);
        return interaction;
      })
    },
    item: {
      findFirst: vi.fn(async ({ where }) => where.id === 'item-1' && where.workspaceId === 'ws-1' ? { id: 'item-1' } : null)
    },
    automationSideEffect: { updateMany: vi.fn(async () => ({ count: 0 })), findFirst: vi.fn() },
    automationApprovalRequest: { updateMany: vi.fn(async () => ({ count: 0 })), findFirst: vi.fn() },
    contactConsent: { findUnique: vi.fn(async () => ({ status: 'opted_in' })) },
    communicationSuppression: { findUnique: vi.fn(async () => null) }
  };
  const service = new CommunicationConversationService(prisma as any);
  return { service, prisma, conversations, interactions };
}

describe('CommunicationConversationService', () => {
  it('creates a conversation and reuses the active conversation for the same contact/channel/work item', async () => {
    const { service, conversations } = makePrisma();

    const first = await service.findOrCreateConversation({
      workspaceId: 'ws-1',
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      channel: 'whatsapp',
      workItemId: 'item-1'
    });
    const second = await service.findOrCreateConversation({
      workspaceId: 'ws-1',
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      channel: 'whatsapp',
      workItemId: 'item-1'
    });

    expect(second.id).toBe(first.id);
    expect(conversations).toHaveLength(1);
  });

  it('adds inbound messages, updates preview and increments unread count', async () => {
    const { service, conversations, interactions } = makePrisma();
    const conversation = await service.findOrCreateConversation({
      workspaceId: 'ws-1',
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      channel: 'whatsapp'
    });

    await service.appendMessage({
      workspaceId: 'ws-1',
      conversationId: conversation.id,
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      direction: 'inbound',
      channel: 'whatsapp',
      status: 'received',
      text: 'Olá, tenho interesse.',
      occurredAt: baseDate
    });

    expect(interactions[0]).toMatchObject({
      conversationId: conversation.id,
      direction: 'inbound',
      status: 'received',
      textPreview: 'Olá, tenho interesse.'
    });
    expect(conversations[0]).toMatchObject({
      unreadCount: 1,
      status: 'waiting_internal',
      lastMessagePreview: 'Olá, tenho interesse.'
    });
  });

  it('marks conversations as read, resolved and archived inside the same workspace', async () => {
    const { service, conversations } = makePrisma();
    const conversation = await service.findOrCreateConversation({
      workspaceId: 'ws-1',
      contactId: 'contact-1',
      channel: 'whatsapp'
    });
    conversations[0].unreadCount = 3;

    await service.markAsRead({ workspaceId: 'ws-1', conversationId: conversation.id });
    expect(conversations[0].unreadCount).toBe(0);

    await service.resolveConversation({ workspaceId: 'ws-1', conversationId: conversation.id });
    expect(conversations[0].status).toBe('resolved');
    expect(conversations[0].resolvedAt).toBeInstanceOf(Date);

    await service.archiveConversation({ workspaceId: 'ws-1', conversationId: conversation.id });
    expect(conversations[0].status).toBe('archived');
    expect(conversations[0].archivedAt).toBeInstanceOf(Date);
  });
});
