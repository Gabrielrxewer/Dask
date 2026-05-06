import type { ContactConsent, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  isValidEmailAddress,
  maskCommunicationAddress,
  normalizeCommunicationAddress
} from '@/modules/automation/communication/communication-address';

export type ConsentDecision = {
  allowed: boolean;
  status: string;
  reason?: string;
  address: string;
  recipientMasked: string;
};

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

export class CommunicationConsentService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async upsertConsent(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    status: 'unknown' | 'opted_in' | 'opted_out' | 'suppressed' | 'bounced' | 'complained' | 'invalid';
    source?: string | null;
    reason?: string | null;
    contactType?: string | null;
    contactId?: string | null;
  }): Promise<ContactConsent> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    const address = normalizeCommunicationAddress(channel, input.address);
    if (channel === 'email' && !isValidEmailAddress(address)) {
      throw new AppError('Invalid email address.', 422);
    }

    const status = normalizeStatus(input.status);
    const now = new Date();
    return this.prisma.contactConsent.upsert({
      where: {
        workspaceId_channel_address: {
          workspaceId: input.workspaceId,
          channel,
          address
        }
      },
      create: {
        workspaceId: input.workspaceId,
        channel,
        address,
        status,
        source: input.source ?? null,
        reason: input.reason ?? null,
        contactType: input.contactType ?? null,
        contactId: input.contactId ?? null,
        optInAt: status === 'opted_in' ? now : null,
        optOutAt: status === 'opted_out' ? now : null
      },
      update: {
        status,
        source: input.source ?? undefined,
        reason: input.reason ?? undefined,
        contactType: input.contactType ?? undefined,
        contactId: input.contactId ?? undefined,
        optInAt: status === 'opted_in' ? now : undefined,
        optOutAt: status === 'opted_out' ? now : undefined
      }
    });
  }

  public async optIn(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    source?: string | null;
    reason?: string | null;
  }): Promise<ContactConsent> {
    return this.upsertConsent({
      ...input,
      status: 'opted_in'
    });
  }

  public async optOut(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    source?: string | null;
    reason?: string | null;
  }): Promise<ContactConsent> {
    return this.upsertConsent({
      ...input,
      status: 'opted_out'
    });
  }

  public async findConsent(input: {
    workspaceId: string;
    channel?: string;
    address: string;
  }): Promise<ContactConsent | null> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    return this.prisma.contactConsent.findUnique({
      where: {
        workspaceId_channel_address: {
          workspaceId: input.workspaceId,
          channel,
          address: normalizeCommunicationAddress(channel, input.address)
        }
      }
    });
  }

  public async checkConsent(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    category?: string | null;
  }): Promise<ConsentDecision> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    const address = normalizeCommunicationAddress(channel, input.address);
    const recipientMasked = maskCommunicationAddress(channel, address);
    const consent = await this.findConsent({
      workspaceId: input.workspaceId,
      channel,
      address
    });
    const status = consent?.status ?? 'unknown';
    const category = input.category?.trim().toLowerCase() ?? 'follow_up';

    if (['suppressed', 'bounced', 'complained', 'opted_out'].includes(status)) {
      return {
        allowed: false,
        status,
        reason: `contact_${status}`,
        address,
        recipientMasked
      };
    }

    if (category === 'marketing' && status !== 'opted_in') {
      return {
        allowed: false,
        status,
        reason: 'marketing_requires_opt_in',
        address,
        recipientMasked
      };
    }

    if (channel === 'whatsapp' && status !== 'opted_in') {
      return {
        allowed: false,
        status,
        reason: 'whatsapp_requires_opt_in',
        address,
        recipientMasked
      };
    }

    return {
      allowed: true,
      status,
      address,
      recipientMasked
    };
  }
}
