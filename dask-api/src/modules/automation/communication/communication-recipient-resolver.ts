import type { PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { maskCommunicationAddress } from '@/modules/automation/communication/communication-address';
import { CommunicationConsentService } from '@/modules/automation/communication/communication-consent-service';
import { CommunicationContactService } from '@/modules/automation/communication/communication-contact-service';
import { CommunicationSuppressionService } from '@/modules/automation/communication/communication-suppression-service';

export type ResolvedCommunicationRecipient = {
  contactId: string;
  contactChannelId: string;
  channel: string;
  address: string;
  normalizedAddress: string;
  recipientMasked: string;
  consentStatus: string;
  suppressed: boolean;
  blocked: boolean;
  blockReason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, source);
}

export class CommunicationRecipientResolver {
  private readonly contactService: CommunicationContactService;
  private readonly consentService: CommunicationConsentService;
  private readonly suppressionService: CommunicationSuppressionService;

  public constructor(private readonly prisma: PrismaClient, input?: {
    contactService?: CommunicationContactService;
    consentService?: CommunicationConsentService;
    suppressionService?: CommunicationSuppressionService;
  }) {
    this.contactService = input?.contactService ?? new CommunicationContactService(prisma);
    this.consentService = input?.consentService ?? new CommunicationConsentService(prisma);
    this.suppressionService = input?.suppressionService ?? new CommunicationSuppressionService(prisma);
  }

  public async resolveRecipient(input: {
    workspaceId: string;
    channel: string;
    address?: string | null;
    recipient?: unknown;
    context?: Record<string, unknown>;
    category?: string | null;
  }): Promise<ResolvedCommunicationRecipient> {
    const channel = input.channel.trim().toLowerCase();
    const recipient = isRecord(input.recipient) ? input.recipient : {};
    const contactId = readString(recipient.contactId);
    let contact = contactId
      ? await this.prisma.communicationContact.findFirst({
          where: { id: contactId, workspaceId: input.workspaceId, archivedAt: null }
        })
      : null;

    if (!contact && readString(recipient.sourceType) && readString(recipient.sourceId)) {
      contact = await this.contactService.findBySource({
        workspaceId: input.workspaceId,
        sourceType: readString(recipient.sourceType)!,
        sourceId: readString(recipient.sourceId)!
      });
    }

    let address = input.address ?? readString(recipient.address);
    if (!address && contact) {
      const channelRecord = await this.prisma.communicationContactChannel.findFirst({
        where: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          channel,
          status: { not: 'invalid' }
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }]
      });
      address = channelRecord?.normalizedAddress ?? channelRecord?.address ?? null;
    }
    if (!address && input.context) {
      const path = channel === 'email' ? 'contact.email' : 'contact.phone';
      const resolved = readPath(input.context, path);
      address = readString(resolved);
    }
    if (!address) {
      throw new AppError('Communication recipient address could not be resolved.', 422);
    }

    const existingChannel = await this.contactService.findByChannelAddress({
      workspaceId: input.workspaceId,
      channel,
      address
    });
    if (existingChannel) {
      contact = existingChannel.contact;
    }
    if (!contact) {
      contact = await this.contactService.findOrCreateContact({
        workspaceId: input.workspaceId,
        sourceType: readString(recipient.sourceType) ?? 'automation',
        sourceId: readString(recipient.sourceId),
        displayName: readString(recipient.displayName),
        channel,
        address
      });
    }

    const channelRecord = existingChannel ?? await this.contactService.upsertChannel({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      channel,
      address,
      isPrimary: true
    });

    const suppression = await this.suppressionService.checkSuppression({
      workspaceId: input.workspaceId,
      channel,
      address: channelRecord.normalizedAddress
    });
    const consent = await this.consentService.checkConsent({
      workspaceId: input.workspaceId,
      channel,
      address: channelRecord.normalizedAddress,
      category: input.category
    });
    const channelStatusBlocked = ['suppressed', 'opted_out', 'invalid'].includes(channelRecord.status);
    const blocked = suppression.blocked || !consent.allowed || channelStatusBlocked;

    return {
      contactId: contact.id,
      contactChannelId: channelRecord.id,
      channel,
      address: channelRecord.address,
      normalizedAddress: channelRecord.normalizedAddress,
      recipientMasked: maskCommunicationAddress(channel, channelRecord.normalizedAddress),
      consentStatus: consent.status,
      suppressed: suppression.blocked,
      blocked,
      blockReason: suppression.blocked
        ? 'suppressed'
        : consent.reason ?? (channelStatusBlocked ? `channel_${channelRecord.status}` : undefined)
    };
  }
}
