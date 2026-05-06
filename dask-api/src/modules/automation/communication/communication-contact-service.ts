import type { CommunicationContact, CommunicationContactChannel, Prisma, PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import {
  isValidEmailAddress,
  normalizeCommunicationAddress,
  normalizePhoneAddress
} from '@/modules/automation/communication/communication-address';
import { sanitizeAutomationPayload } from '@/modules/automation/runtime/automation-runtime-errors';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export class CommunicationContactService {
  public constructor(private readonly prisma: PrismaClient) {}

  public normalizeChannelAddress(channel: string, address: string): { normalizedAddress: string; status: string } {
    const normalizedChannel = channel.trim().toLowerCase();
    if (normalizedChannel === 'email') {
      const normalizedAddress = normalizeCommunicationAddress('email', address);
      return {
        normalizedAddress,
        status: isValidEmailAddress(normalizedAddress) ? 'active' : 'invalid'
      };
    }
    if (normalizedChannel === 'phone' || normalizedChannel === 'whatsapp') {
      const phone = normalizePhoneAddress(address, { defaultDdi: env.COMMUNICATION_DEFAULT_PHONE_DDI });
      return {
        normalizedAddress: phone.normalized,
        status: phone.status
      };
    }

    return {
      normalizedAddress: normalizeCommunicationAddress(normalizedChannel, address),
      status: 'unverified'
    };
  }

  public async findOrCreateContact(input: {
    workspaceId: string;
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    channel?: string | null;
    address?: string | null;
    metadata?: unknown;
  }): Promise<CommunicationContact> {
    if (input.channel && input.address) {
      const existing = await this.findByChannelAddress({
        workspaceId: input.workspaceId,
        channel: input.channel,
        address: input.address
      });
      if (existing?.contact) {
        return existing.contact;
      }
    }

    if (input.sourceType && input.sourceId) {
      const sourceContact = await this.prisma.communicationContact.findFirst({
        where: {
          workspaceId: input.workspaceId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          archivedAt: null
        }
      });
      if (sourceContact) {
        return sourceContact;
      }
    }

    return this.prisma.communicationContact.create({
      data: {
        workspaceId: input.workspaceId,
        displayName: clean(input.displayName),
        firstName: clean(input.firstName),
        lastName: clean(input.lastName),
        companyName: clean(input.companyName),
        sourceType: clean(input.sourceType) ?? 'manual',
        sourceId: clean(input.sourceId),
        metadataJson: input.metadata !== undefined ? toJsonValue(sanitizeAutomationPayload(input.metadata)) : undefined
      }
    });
  }

  public async upsertChannel(input: {
    workspaceId: string;
    contactId: string;
    channel: 'email' | 'phone' | 'whatsapp' | string;
    address: string;
    label?: string | null;
    isPrimary?: boolean;
    metadata?: unknown;
  }): Promise<CommunicationContactChannel> {
    const channel = input.channel.trim().toLowerCase();
    const normalized = this.normalizeChannelAddress(channel, input.address);
    if (!normalized.normalizedAddress) {
      throw new AppError('Communication channel address is required.', 422);
    }

    const channelRecord = await this.prisma.communicationContactChannel.upsert({
      where: {
        workspaceId_channel_normalizedAddress: {
          workspaceId: input.workspaceId,
          channel,
          normalizedAddress: normalized.normalizedAddress
        }
      },
      create: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        channel,
        address: input.address.trim(),
        normalizedAddress: normalized.normalizedAddress,
        label: clean(input.label),
        isPrimary: input.isPrimary ?? false,
        status: normalized.status,
        metadataJson: input.metadata !== undefined ? toJsonValue(sanitizeAutomationPayload(input.metadata)) : undefined
      },
      update: {
        contactId: input.contactId,
        address: input.address.trim(),
        label: clean(input.label) ?? undefined,
        isPrimary: input.isPrimary ?? undefined,
        status: normalized.status,
        metadataJson: input.metadata !== undefined ? toJsonValue(sanitizeAutomationPayload(input.metadata)) : undefined
      }
    });

    if (input.isPrimary) {
      await this.prisma.communicationContactChannel.updateMany({
        where: {
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          channel,
          id: { not: channelRecord.id }
        },
        data: { isPrimary: false }
      });
      await this.prisma.communicationContact.update({
        where: { id: input.contactId },
        data: {
          preferredChannel: channel,
          primaryEmail: channel === 'email' ? normalized.normalizedAddress : undefined,
          primaryPhone: channel === 'phone' || channel === 'whatsapp' ? normalized.normalizedAddress : undefined
        }
      });
    }

    return channelRecord;
  }

  public async findByChannelAddress(input: {
    workspaceId: string;
    channel: string;
    address: string;
  }): Promise<(CommunicationContactChannel & { contact: CommunicationContact }) | null> {
    const channel = input.channel.trim().toLowerCase();
    const normalized = this.normalizeChannelAddress(channel, input.address);
    return this.prisma.communicationContactChannel.findUnique({
      where: {
        workspaceId_channel_normalizedAddress: {
          workspaceId: input.workspaceId,
          channel,
          normalizedAddress: normalized.normalizedAddress
        }
      },
      include: { contact: true }
    });
  }

  public async findBySource(input: {
    workspaceId: string;
    sourceType: string;
    sourceId: string;
  }): Promise<CommunicationContact | null> {
    return this.prisma.communicationContact.findFirst({
      where: {
        workspaceId: input.workspaceId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        archivedAt: null
      }
    });
  }

  public async archiveContact(input: { workspaceId: string; contactId: string }): Promise<CommunicationContact> {
    return this.prisma.communicationContact.update({
      where: { id: input.contactId },
      data: {
        status: 'archived',
        archivedAt: new Date()
      }
    });
  }
}
