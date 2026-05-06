import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { maskCommunicationAddress, normalizeCommunicationAddress } from '@/modules/automation/communication/communication-address';
import { CommunicationConsentService } from '@/modules/automation/communication/communication-consent-service';
import { CommunicationSuppressionService } from '@/modules/automation/communication/communication-suppression-service';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

const activeConversationStatuses = ['open', 'pending', 'waiting_customer', 'waiting_internal', 'blocked'];
const conversationStatuses = [...activeConversationStatuses, 'resolved', 'archived'] as const;
const messageDirections = ['inbound', 'outbound', 'system'] as const;
const messageStatuses = [
  'draft',
  'pending_approval',
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'received',
  'cancelled',
  'blocked'
] as const;

type ConversationStatus = (typeof conversationStatuses)[number];
type MessageDirection = (typeof messageDirections)[number];
type MessageStatus = (typeof messageStatuses)[number];

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function previewText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function normalizeStatus(value: string | undefined, fallback: ConversationStatus): ConversationStatus {
  if (value && conversationStatuses.includes(value as ConversationStatus)) {
    return value as ConversationStatus;
  }
  return fallback;
}

function normalizeMessageStatus(value: string | undefined, fallback: MessageStatus): MessageStatus {
  if (value && messageStatuses.includes(value as MessageStatus)) {
    return value as MessageStatus;
  }
  return fallback;
}

function maskChannelAddress(channel: string, address: string | null | undefined): string | null {
  return address ? maskCommunicationAddress(channel, address) : null;
}

function readString(source: unknown, keys: string[]): string | null {
  if (!isRecord(source)) {
    return null;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function textFromPayload(payload: unknown): string | null {
  const direct = readString(payload, ['body', 'text', 'html', 'draftText']);
  if (direct) {
    return direct;
  }
  return readString(isRecord(payload) ? payload.draft : null, ['body', 'text', 'draftText']);
}

export class CommunicationConversationService {
  private readonly consentService: CommunicationConsentService;
  private readonly suppressionService: CommunicationSuppressionService;

  public constructor(
    private readonly prisma: PrismaClient,
    input?: {
      consentService?: CommunicationConsentService;
      suppressionService?: CommunicationSuppressionService;
    }
  ) {
    this.consentService = input?.consentService ?? new CommunicationConsentService(prisma);
    this.suppressionService = input?.suppressionService ?? new CommunicationSuppressionService(prisma);
  }

  public async findOrCreateConversation(input: {
    workspaceId: string;
    contactId: string;
    channel: string;
    contactChannelId?: string | null;
    workItemId?: string | null;
    metadata?: unknown;
  }) {
    const workspaceId = clean(input.workspaceId);
    const contactId = clean(input.contactId);
    const channel = clean(input.channel)?.toLowerCase();
    if (!workspaceId || !contactId || !channel) {
      throw new AppError('workspaceId, contactId and channel are required for a conversation.', 422);
    }

    const contact = await this.prisma.communicationContact.findFirst({
      where: { id: contactId, workspaceId, archivedAt: null },
      select: { id: true }
    });
    if (!contact) {
      throw new AppError('Communication contact not found.', 404);
    }

    const contactChannelId = clean(input.contactChannelId);
    if (contactChannelId) {
      const contactChannel = await this.prisma.communicationContactChannel.findFirst({
        where: { id: contactChannelId, workspaceId, contactId },
        select: { id: true }
      });
      if (!contactChannel) {
        throw new AppError('Communication contact channel not found.', 404);
      }
    }

    const workItemId = clean(input.workItemId);
    if (workItemId) {
      const workItem = await this.prisma.item.findFirst({
        where: { id: workItemId, workspaceId },
        select: { id: true }
      });
      if (!workItem) {
        throw new AppError('Work item not found.', 404);
      }
    }

    const existing = await this.prisma.communicationConversation.findFirst({
      where: {
        workspaceId,
        contactId,
        primaryChannel: channel,
        workItemId: workItemId ?? null,
        status: { in: activeConversationStatuses }
      },
      orderBy: [{ updatedAt: 'desc' }]
    });
    if (existing) {
      return existing;
    }

    return this.prisma.communicationConversation.create({
      data: {
        workspaceId,
        contactId,
        contactChannelId,
        primaryChannel: channel,
        workItemId,
        status: 'open',
        priority: 'normal',
        metadataJson: input.metadata !== undefined ? toJsonValue(sanitizeAutomationPayload(input.metadata)) : undefined
      }
    });
  }

  public async appendMessage(input: {
    workspaceId: string;
    conversationId?: string | null;
    contactId: string;
    contactChannelId?: string | null;
    sideEffectId?: string | null;
    providerEventId?: string | null;
    approvalRequestId?: string | null;
    runId?: string | null;
    stepRunId?: string | null;
    workItemId?: string | null;
    direction: string;
    channel: string;
    provider?: string | null;
    type?: string | null;
    status?: string | null;
    text?: string | null;
    body?: unknown;
    metadata?: unknown;
    occurredAt?: Date;
  }) {
    const direction = messageDirections.includes(input.direction as MessageDirection)
      ? input.direction as MessageDirection
      : 'system';
    const channel = clean(input.channel)?.toLowerCase();
    if (!channel) {
      throw new AppError('Message channel is required.', 422);
    }
    const conversation = input.conversationId
      ? await this.getConversation(input.workspaceId, input.conversationId)
      : await this.findOrCreateConversation({
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          contactChannelId: input.contactChannelId,
          channel,
          workItemId: input.workItemId
        });
    const occurredAt = input.occurredAt ?? new Date();
    const textPreview = previewText(input.text ?? textFromPayload(input.body) ?? undefined);
    const status = normalizeMessageStatus(
      clean(input.status) ?? undefined,
      direction === 'inbound' ? 'received' : direction === 'outbound' ? 'queued' : 'received'
    );

    const message = await this.prisma.communicationInteraction.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
        contactId: input.contactId,
        contactChannelId: clean(input.contactChannelId),
        sideEffectId: clean(input.sideEffectId),
        providerEventId: clean(input.providerEventId),
        approvalRequestId: clean(input.approvalRequestId),
        runId: clean(input.runId),
        stepRunId: clean(input.stepRunId),
        workItemId: clean(input.workItemId ?? conversation.workItemId),
        direction,
        channel,
        provider: clean(input.provider),
        type: clean(input.type) ?? 'message',
        status,
        textPreview,
        bodyJson: input.body !== undefined ? toJsonValue(sanitizeAutomationPayload(input.body)) : undefined,
        metadataJson: input.metadata !== undefined ? toJsonValue(sanitizeAutomationPayload(input.metadata)) : undefined,
        occurredAt
      }
    });

    await this.refreshConversationAfterMessage({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      direction,
      status,
      occurredAt,
      textPreview
    });

    if (input.sideEffectId) {
      await this.prisma.automationSideEffect.updateMany({
        where: { id: input.sideEffectId, workspaceId: input.workspaceId },
        data: { conversationId: conversation.id }
      });
    }
    if (input.approvalRequestId) {
      await this.prisma.automationApprovalRequest.updateMany({
        where: { id: input.approvalRequestId, workspaceId: input.workspaceId },
        data: { conversationId: conversation.id }
      });
    }

    return message;
  }

  public async listConversations(input: {
    workspaceId: string;
    status?: string;
    channel?: string;
    assignedTo?: string;
    workItemId?: string;
    contactId?: string;
    hasUnread?: boolean;
    hasPendingApproval?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    limit?: number;
  }) {
    const search = clean(input.search);
    const conversations = await this.prisma.communicationConversation.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: input.status ? normalizeStatus(input.status, 'open') : { not: 'archived' },
        primaryChannel: clean(input.channel)?.toLowerCase() ?? undefined,
        assignedToId: clean(input.assignedTo) ?? undefined,
        workItemId: clean(input.workItemId) ?? undefined,
        contactId: clean(input.contactId) ?? undefined,
        unreadCount: input.hasUnread ? { gt: 0 } : undefined,
        lastMessageAt: input.dateFrom || input.dateTo
          ? {
              ...(input.dateFrom ? { gte: input.dateFrom } : {}),
              ...(input.dateTo ? { lte: input.dateTo } : {})
            }
          : undefined,
        approvalRequests: input.hasPendingApproval ? { some: { status: 'pending' } } : undefined,
        ...(search
          ? {
              OR: [
                { lastMessagePreview: { contains: search, mode: 'insensitive' } },
                { contact: { displayName: { contains: search, mode: 'insensitive' } } },
                { contact: { companyName: { contains: search, mode: 'insensitive' } } },
                { workItem: { title: { contains: search, mode: 'insensitive' } } }
              ]
            }
          : {})
      },
      include: {
        contact: true,
        contactChannel: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        workItem: { select: { id: true, title: true, status: true, type: true } },
        approvalRequests: { where: { status: 'pending' }, take: 1 },
        interactions: { where: { status: 'failed' }, take: 1 }
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(Math.max(input.limit ?? 100, 1), 500)
    });

    return {
      items: conversations.map((conversation) => ({
        conversationId: conversation.id,
        contactName: conversation.contact.displayName ?? conversation.contact.companyName ?? 'Contato sem nome',
        contactMasked: this.maskConversationContact(conversation),
        channel: conversation.primaryChannel,
        status: conversation.status,
        priority: conversation.priority,
        assignedTo: conversation.assignedTo,
        workItemTitle: conversation.workItem?.title ?? null,
        workItemId: conversation.workItemId,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unreadCount,
        hasPendingApproval: conversation.approvalRequests.length > 0,
        hasFailedMessage: conversation.interactions.length > 0
      }))
    };
  }

  public async getConversationDetail(input: { workspaceId: string; conversationId: string }) {
    const conversation = await this.prisma.communicationConversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      include: {
        contact: { include: { channels: { orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }] } } },
        contactChannel: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        workItem: { select: { id: true, title: true, description: true, status: true, type: true, updatedAt: true } },
        interactions: {
          include: {
            sideEffect: { select: { id: true, status: true, sideEffectType: true, provider: true, resultJson: true, errorJson: true } },
            providerEvent: { select: { id: true, eventType: true, status: true, providerMessageId: true, receivedAt: true } },
            approvalRequest: { select: { id: true, type: true, status: true, title: true, requestedAt: true, reviewedAt: true } },
            run: { select: { id: true, status: true, triggerType: true, createdAt: true, workflow: { select: { id: true, name: true } } } }
          },
          orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
          take: 500
        },
        approvalRequests: {
          where: { status: 'pending' },
          orderBy: [{ requestedAt: 'asc' }],
          take: 20
        }
      }
    });
    if (!conversation) {
      throw new AppError('Communication conversation not found.', 404);
    }

    const recentRuns = await this.prisma.automationRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { approvalRequests: { some: { conversationId: conversation.id } } },
          { sideEffects: { some: { conversationId: conversation.id } } }
        ]
      },
      include: { workflow: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 10
    });

    return {
      conversation: {
        id: conversation.id,
        workspaceId: conversation.workspaceId,
        channel: conversation.primaryChannel,
        status: conversation.status,
        priority: conversation.priority,
        assignedTo: conversation.assignedTo,
        workItemId: conversation.workItemId,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: conversation.unreadCount,
        archivedAt: conversation.archivedAt,
        resolvedAt: conversation.resolvedAt
      },
      contact: {
        id: conversation.contact.id,
        displayName: conversation.contact.displayName,
        companyName: conversation.contact.companyName,
        primaryEmail: maskChannelAddress('email', conversation.contact.primaryEmail),
        primaryPhone: maskChannelAddress('whatsapp', conversation.contact.primaryPhone),
        status: conversation.contact.status,
        preferredChannel: conversation.contact.preferredChannel
      },
      channels: conversation.contact.channels.map((channel) => ({
        id: channel.id,
        channel: channel.channel,
        address: maskChannelAddress(channel.channel, channel.address),
        status: channel.status,
        isPrimary: channel.isPrimary
      })),
      workItem: conversation.workItem,
      messages: conversation.interactions.map((message) => ({
        id: message.id,
        direction: message.direction,
        channel: message.channel,
        provider: message.provider,
        type: message.type,
        status: message.status,
        textPreview: message.textPreview,
        body: sanitizeAutomationPayload(message.bodyJson),
        occurredAt: message.occurredAt,
        sideEffect: message.sideEffect,
        providerEvent: message.providerEvent,
        approvalRequest: message.approvalRequest,
        run: message.run
          ? {
              runId: message.run.id,
              status: message.run.status,
              workflowId: message.run.workflow.id,
              workflowName: message.run.workflow.name,
              triggerType: message.run.triggerType,
              createdAt: message.run.createdAt
            }
          : null,
        metadata: sanitizeAutomationPayload(message.metadataJson)
      })),
      pendingApprovals: conversation.approvalRequests.map((approval) => ({
        approvalId: approval.id,
        type: approval.type,
        status: approval.status,
        title: approval.title,
        requestedAt: approval.requestedAt
      })),
      recentAutomationRuns: recentRuns.map((run) => ({
        runId: run.id,
        status: run.status,
        workflowId: run.workflowId,
        workflowName: run.workflow.name,
        triggerType: run.triggerType,
        createdAt: run.createdAt
      })),
      timelineEvents: conversation.interactions.map((message) => ({
        id: message.id,
        type: message.type,
        status: message.status,
        direction: message.direction,
        occurredAt: message.occurredAt
      }))
    };
  }

  public async markAsRead(input: { workspaceId: string; conversationId: string }) {
    await this.getConversation(input.workspaceId, input.conversationId);
    return this.prisma.communicationConversation.update({
      where: { id: input.conversationId },
      data: { unreadCount: 0 }
    });
  }

  public async resolveConversation(input: { workspaceId: string; conversationId: string }) {
    await this.getConversation(input.workspaceId, input.conversationId);
    return this.prisma.communicationConversation.update({
      where: { id: input.conversationId },
      data: { status: 'resolved', resolvedAt: new Date(), unreadCount: 0 }
    });
  }

  public async archiveConversation(input: { workspaceId: string; conversationId: string }) {
    await this.getConversation(input.workspaceId, input.conversationId);
    return this.prisma.communicationConversation.update({
      where: { id: input.conversationId },
      data: { status: 'archived', archivedAt: new Date(), unreadCount: 0 }
    });
  }

  public async assignConversation(input: { workspaceId: string; conversationId: string; assignedToId?: string | null }) {
    await this.getConversation(input.workspaceId, input.conversationId);
    const assignedToId = clean(input.assignedToId);
    if (assignedToId) {
      const membership = await this.prisma.workspaceMembership.findFirst({
        where: { workspaceId: input.workspaceId, userId: assignedToId },
        select: { id: true }
      });
      if (!membership) {
        throw new AppError('Assigned user is not a workspace member.', 422);
      }
    }
    return this.prisma.communicationConversation.update({
      where: { id: input.conversationId },
      data: { assignedToId }
    });
  }

  public async linkWorkItem(input: { workspaceId: string; conversationId: string; workItemId?: string | null }) {
    await this.getConversation(input.workspaceId, input.conversationId);
    const workItemId = clean(input.workItemId);
    if (workItemId) {
      const item = await this.prisma.item.findFirst({
        where: { id: workItemId, workspaceId: input.workspaceId },
        select: { id: true }
      });
      if (!item) {
        throw new AppError('Work item not found.', 404);
      }
    }
    return this.prisma.communicationConversation.update({
      where: { id: input.conversationId },
      data: { workItemId }
    });
  }

  public async replyManually(input: {
    workspaceId: string;
    conversationId: string;
    userId: string;
    channel: string;
    text: string;
    sendMode: string;
  }) {
    if (input.sendMode !== 'manual') {
      throw new AppError('Only manual reply mode is supported.', 422);
    }
    const text = clean(input.text);
    if (!text) {
      throw new AppError('Reply text is required.', 422);
    }
    const channel = clean(input.channel)?.toLowerCase();
    if (channel !== 'email' && channel !== 'whatsapp') {
      throw new AppError('Unsupported conversation reply channel.', 422);
    }
    const conversation = await this.prisma.communicationConversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      include: { contact: true, contactChannel: true }
    });
    if (!conversation) {
      throw new AppError('Communication conversation not found.', 404);
    }
    if (conversation.status === 'archived' || conversation.status === 'blocked') {
      throw new AppError('Conversation cannot receive manual replies in its current status.', 422);
    }

    const targetChannel = conversation.contactChannel
      ?? await this.prisma.communicationContactChannel.findFirst({
        where: {
          workspaceId: input.workspaceId,
          contactId: conversation.contactId,
          channel,
          status: { not: 'invalid' }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }]
      });
    if (!targetChannel) {
      throw new AppError('No contact channel is available for this reply.', 422);
    }
    const address = normalizeCommunicationAddress(channel, targetChannel.normalizedAddress || targetChannel.address);
    await this.assertReplyAllowed({ workspaceId: input.workspaceId, channel, address });
    if (channel === 'whatsapp') {
      await this.assertWhatsAppFreeTextAllowed({
        workspaceId: input.workspaceId,
        contactId: conversation.contactId,
        contactChannelId: targetChannel.id
      });
    }

    const manualRun = await this.ensureManualReplyRun({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      userId: input.userId
    });
    const payload = {
      to: address,
      text,
      body: text,
      channel,
      source: 'manual_inbox_reply',
      sendMode: 'manual',
      conversationId: conversation.id,
      contactId: conversation.contactId,
      contactChannelId: targetChannel.id,
      metadata: {
        createdBy: input.userId,
        manualApproval: true
      }
    };
    const idempotencyKey = `manual-reply:${conversation.id}:${manualRun.stepRun.id}`;
    const sideEffect = await this.prisma.automationSideEffect.create({
      data: {
        workspaceId: input.workspaceId,
        runId: manualRun.run.id,
        stepRunId: manualRun.stepRun.id,
        sideEffectType: channel === 'email' ? 'communication.email' : 'communication.whatsapp',
        channel,
        provider: channel === 'email' ? 'mock' : 'mock',
        status: 'queued',
        idempotencyKey,
        payloadJson: toJsonValue(sanitizeAutomationPayload(payload)),
        contactId: conversation.contactId,
        contactChannelId: targetChannel.id,
        conversationId: conversation.id,
        maxAttempts: 3,
        nextAttemptAt: new Date()
      }
    });

    const message = await this.appendMessage({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      contactId: conversation.contactId,
      contactChannelId: targetChannel.id,
      sideEffectId: sideEffect.id,
      runId: manualRun.run.id,
      stepRunId: manualRun.stepRun.id,
      workItemId: conversation.workItemId,
      direction: 'outbound',
      channel,
      provider: sideEffect.provider,
      type: 'manual_reply',
      status: 'queued',
      text,
      body: payload,
      metadata: { createdBy: input.userId, sendMode: 'manual' }
    });

    return { sideEffect, message };
  }

  public async syncSideEffectMessage(input: { workspaceId: string; sideEffectId: string }) {
    const sideEffect = await this.prisma.automationSideEffect.findFirst({
      where: { id: input.sideEffectId, workspaceId: input.workspaceId },
      include: { approvalRequest: true }
    });
    if (!sideEffect || !sideEffect.channel || !sideEffect.contactId) {
      return null;
    }
    const payload = isRecord(sideEffect.payloadJson) ? sideEffect.payloadJson : {};
    const channel = sideEffect.channel.toLowerCase();
    const conversation = await this.findOrCreateConversation({
      workspaceId: sideEffect.workspaceId,
      contactId: sideEffect.contactId,
      contactChannelId: sideEffect.contactChannelId,
      channel,
      workItemId: sideEffect.approvalRequest?.workItemId ?? null,
      metadata: { source: 'side_effect', sideEffectId: sideEffect.id }
    });
    const existing = await this.prisma.communicationInteraction.findFirst({
      where: { workspaceId: sideEffect.workspaceId, sideEffectId: sideEffect.id }
    });
    if (existing) {
      await this.prisma.communicationInteraction.update({
        where: { id: existing.id },
        data: {
          conversationId: conversation.id,
          status: sideEffect.status === 'sent' ? 'sent' : sideEffect.status,
          textPreview: previewText(textFromPayload(payload) ?? undefined),
          provider: sideEffect.provider
        }
      });
      await this.refreshConversationAfterMessage({
        workspaceId: sideEffect.workspaceId,
        conversationId: conversation.id,
        direction: 'outbound',
        status: sideEffect.status === 'sent' ? 'sent' : normalizeMessageStatus(sideEffect.status, 'queued'),
        occurredAt: sideEffect.processedAt ?? sideEffect.createdAt,
        textPreview: previewText(textFromPayload(payload) ?? undefined)
      });
      return existing;
    }
    return this.appendMessage({
      workspaceId: sideEffect.workspaceId,
      conversationId: conversation.id,
      contactId: sideEffect.contactId,
      contactChannelId: sideEffect.contactChannelId,
      sideEffectId: sideEffect.id,
      approvalRequestId: sideEffect.approvalRequestId,
      runId: sideEffect.runId,
      stepRunId: sideEffect.stepRunId,
      workItemId: sideEffect.approvalRequest?.workItemId ?? null,
      direction: 'outbound',
      channel,
      provider: sideEffect.provider,
      type: 'side_effect',
      status: sideEffect.status === 'sent' ? 'sent' : sideEffect.status,
      text: textFromPayload(payload),
      body: payload,
      metadata: { source: 'side_effect' },
      occurredAt: sideEffect.createdAt
    });
  }

  public async syncApprovalMessage(input: { workspaceId: string; approvalRequestId: string }) {
    const approval = await this.prisma.automationApprovalRequest.findFirst({
      where: { id: input.approvalRequestId, workspaceId: input.workspaceId }
    });
    if (!approval?.contactId) {
      return null;
    }
    const payload = isRecord(approval.payloadJson) ? approval.payloadJson : {};
    const channel = readString(payload, ['channel']) ?? readString(payload.metadata, ['channel']) ?? 'whatsapp';
    const contactChannel = await this.prisma.communicationContactChannel.findFirst({
      where: {
        workspaceId: input.workspaceId,
        contactId: approval.contactId,
        channel
      },
      orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }]
    });
    const conversation = await this.findOrCreateConversation({
      workspaceId: input.workspaceId,
      contactId: approval.contactId,
      contactChannelId: contactChannel?.id,
      channel,
      workItemId: approval.workItemId,
      metadata: { source: 'approval_request', approvalRequestId: approval.id }
    });
    const existing = await this.prisma.communicationInteraction.findFirst({
      where: { workspaceId: input.workspaceId, approvalRequestId: approval.id }
    });
    if (existing) {
      return this.prisma.communicationInteraction.update({
        where: { id: existing.id },
        data: {
          conversationId: conversation.id,
          status: approval.status === 'pending' ? 'pending_approval' : approval.status,
          textPreview: previewText(textFromPayload(payload) ?? approval.title)
        }
      });
    }
    return this.appendMessage({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      contactId: approval.contactId,
      contactChannelId: contactChannel?.id,
      approvalRequestId: approval.id,
      runId: approval.runId,
      stepRunId: approval.stepRunId,
      workItemId: approval.workItemId,
      direction: 'system',
      channel,
      type: 'approval_request',
      status: approval.status === 'pending' ? 'pending_approval' : approval.status,
      text: textFromPayload(payload) ?? approval.title,
      body: payload,
      metadata: { source: 'approval_request', title: approval.title },
      occurredAt: approval.requestedAt
    });
  }

  private async getConversation(workspaceId: string, conversationId: string) {
    const conversation = await this.prisma.communicationConversation.findFirst({
      where: { id: conversationId, workspaceId }
    });
    if (!conversation) {
      throw new AppError('Communication conversation not found.', 404);
    }
    return conversation;
  }

  private async refreshConversationAfterMessage(input: {
    workspaceId: string;
    conversationId: string;
    direction: MessageDirection;
    status: string;
    occurredAt: Date;
    textPreview: string | null;
  }) {
    const data: Prisma.CommunicationConversationUpdateInput = {
      lastMessageAt: input.occurredAt,
      lastMessagePreview: input.textPreview ?? undefined
    };
    if (input.direction === 'inbound') {
      data.lastInboundAt = input.occurredAt;
      data.unreadCount = { increment: 1 };
      data.status = 'waiting_internal';
      data.archivedAt = null;
      data.resolvedAt = null;
    }
    if (input.direction === 'outbound') {
      data.lastOutboundAt = input.occurredAt;
      data.status = input.status === 'failed' ? 'open' : 'waiting_customer';
    }
    await this.prisma.communicationConversation.updateMany({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      data
    });
  }

  private maskConversationContact(conversation: {
    primaryChannel: string;
    contact: { primaryEmail: string | null; primaryPhone: string | null };
    contactChannel: { address: string; channel: string } | null;
  }) {
    if (conversation.contactChannel) {
      return maskChannelAddress(conversation.contactChannel.channel, conversation.contactChannel.address);
    }
    if (conversation.primaryChannel === 'email') {
      return maskChannelAddress('email', conversation.contact.primaryEmail);
    }
    return maskChannelAddress('whatsapp', conversation.contact.primaryPhone);
  }

  private async assertReplyAllowed(input: { workspaceId: string; channel: 'email' | 'whatsapp'; address: string }) {
    const suppression = await this.suppressionService.checkSuppression({
      workspaceId: input.workspaceId,
      channel: input.channel,
      address: input.address
    });
    if (suppression.blocked) {
      throw new AppError('Manual reply blocked because the recipient is suppressed.', 422, {
        reason: suppression.reason
      });
    }
    const consent = await this.consentService.checkConsent({
      workspaceId: input.workspaceId,
      channel: input.channel,
      address: input.address,
      category: input.channel === 'whatsapp' ? 'utility' : 'follow_up'
    });
    if (!consent.allowed) {
      throw new AppError('Manual reply blocked by consent or opt-out state.', 422, {
        status: consent.status,
        reason: consent.reason
      });
    }
  }

  private async assertWhatsAppFreeTextAllowed(input: {
    workspaceId: string;
    contactId: string;
    contactChannelId: string;
  }) {
    const window = await this.prisma.communicationConversationWindow.findFirst({
      where: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        contactChannelId: input.contactChannelId,
        channel: 'whatsapp',
        status: 'open',
        expiresAt: { gt: new Date() }
      },
      orderBy: [{ expiresAt: 'desc' }]
    });
    if (!window) {
      throw new AppError('WhatsApp free-text reply requires an open conversation window or an approved template.', 422, {
        reason: 'whatsapp_template_required'
      });
    }
  }

  private async ensureManualReplyRun(input: { workspaceId: string; conversationId: string; userId: string }) {
    const now = new Date();
    const workflowKey = 'manual-communication-reply';
    let workflow = await this.prisma.automationWorkflow.findFirst({
      where: {
        workspaceId: input.workspaceId,
        name: 'Manual communication replies'
      },
      include: { currentVersion: true }
    });
    if (!workflow) {
      const createdWorkflow = await this.prisma.automationWorkflow.create({
        data: {
          workspaceId: input.workspaceId,
          name: 'Manual communication replies',
          description: 'System workflow used only to queue approved manual Inbox replies.',
          status: 'active',
          createdById: input.userId,
          versions: {
            create: {
              workspaceId: input.workspaceId,
              version: 1,
              status: 'published',
              publishedAt: now,
              publishedById: input.userId,
              definitionJson: toJsonValue({ system: true, purpose: workflowKey }),
              graphNodesJson: toJsonValue([{ id: 'manual-reply', type: 'communication.manual_reply' }]),
              graphEdgesJson: toJsonValue([])
            }
          }
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 }, currentVersion: true }
      });
      const currentVersionId = createdWorkflow.versions[0]?.id;
      await this.prisma.automationWorkflow.update({
        where: { id: createdWorkflow.id },
        data: { currentVersionId }
      });
      workflow = await this.prisma.automationWorkflow.findFirst({
        where: { id: createdWorkflow.id },
        include: { currentVersion: true }
      });
    }
    if (!workflow?.currentVersionId) {
      throw new AppError('Manual reply workflow is not available.', 500);
    }
    const run = await this.prisma.automationRun.create({
      data: {
        workspaceId: input.workspaceId,
        workflowId: workflow.id,
        workflowVersionId: workflow.currentVersionId,
        triggerType: 'manual_inbox_reply',
        triggerRefId: input.conversationId,
        status: 'running',
        startedAt: now,
        contextJson: toJsonValue({ conversationId: input.conversationId, userId: input.userId })
      }
    });
    const stepRun = await this.prisma.automationStepRun.create({
      data: {
        workspaceId: input.workspaceId,
        runId: run.id,
        nodeId: 'manual-reply',
        nodeType: 'communication.manual_reply',
        status: 'completed',
        inputJson: toJsonValue({ conversationId: input.conversationId }),
        outputJson: toJsonValue({ sideEffectQueued: true }),
        startedAt: now,
        finishedAt: now,
        idempotencyKey: `manual-reply:${input.conversationId}:${run.id}`
      }
    });
    return { run, stepRun };
  }
}
