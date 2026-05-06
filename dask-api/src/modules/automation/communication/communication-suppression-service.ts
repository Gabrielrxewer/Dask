import type { CommunicationSuppression, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  isValidEmailAddress,
  maskCommunicationAddress,
  normalizeCommunicationAddress
} from '@/modules/automation/communication/communication-address';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class CommunicationSuppressionService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async suppress(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    reason: string;
    source?: string | null;
    expiresAt?: Date | null;
    metadata?: unknown;
  }): Promise<CommunicationSuppression> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    const address = normalizeCommunicationAddress(channel, input.address);
    if (channel === 'email' && !isValidEmailAddress(address)) {
      throw new AppError('Invalid email address.', 422);
    }

    return this.prisma.communicationSuppression.upsert({
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
        reason: input.reason,
        source: input.source ?? null,
        expiresAt: input.expiresAt ?? null,
        metadataJson: input.metadata !== undefined ? toJsonValue(input.metadata) : undefined
      },
      update: {
        reason: input.reason,
        source: input.source ?? undefined,
        expiresAt: input.expiresAt ?? undefined,
        metadataJson: input.metadata !== undefined ? toJsonValue(input.metadata) : undefined
      }
    });
  }

  public async findActiveSuppression(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    now?: Date;
  }): Promise<CommunicationSuppression | null> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    const address = normalizeCommunicationAddress(channel, input.address);
    const now = input.now ?? new Date();

    return this.prisma.communicationSuppression.findFirst({
      where: {
        workspaceId: input.workspaceId,
        channel,
        address,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      }
    });
  }

  public async checkSuppression(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    now?: Date;
  }): Promise<{
    blocked: boolean;
    reason?: string;
    address: string;
    recipientMasked: string;
    suppressionId?: string;
  }> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    const address = normalizeCommunicationAddress(channel, input.address);
    const suppression = await this.findActiveSuppression({
      workspaceId: input.workspaceId,
      channel,
      address,
      now: input.now
    });

    return {
      blocked: Boolean(suppression),
      reason: suppression?.reason,
      address,
      recipientMasked: maskCommunicationAddress(channel, address),
      suppressionId: suppression?.id
    };
  }
}
