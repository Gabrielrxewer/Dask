import { createHash, randomBytes } from 'crypto';
import type { CommunicationUnsubscribeToken, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { normalizeCommunicationAddress } from '@/modules/automation/communication/communication-address';
import { CommunicationConsentService } from '@/modules/automation/communication/communication-consent-service';
import { CommunicationSuppressionService } from '@/modules/automation/communication/communication-suppression-service';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class CommunicationUnsubscribeService {
  private readonly consentService: CommunicationConsentService;
  private readonly suppressionService: CommunicationSuppressionService;

  public constructor(private readonly prisma: PrismaClient, input?: {
    consentService?: CommunicationConsentService;
    suppressionService?: CommunicationSuppressionService;
  }) {
    this.consentService = input?.consentService ?? new CommunicationConsentService(prisma);
    this.suppressionService = input?.suppressionService ?? new CommunicationSuppressionService(prisma);
  }

  public async createToken(input: {
    workspaceId: string;
    channel?: string;
    address: string;
    category?: string | null;
    expiresAt?: Date;
  }): Promise<{ token: string; record: CommunicationUnsubscribeToken }> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    const token = randomBytes(32).toString('base64url');
    const record = await this.prisma.communicationUnsubscribeToken.create({
      data: {
        workspaceId: input.workspaceId,
        channel,
        address: normalizeCommunicationAddress(channel, input.address),
        tokenHash: hashToken(token),
        category: input.category ?? null,
        expiresAt: input.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });

    return { token, record };
  }

  public async consumeToken(input: {
    token: string;
    now?: Date;
  }): Promise<{
    status: 'unsubscribed' | 'already_used';
    workspaceId: string;
    channel: string;
    address: string;
  }> {
    const tokenHash = hashToken(input.token.trim());
    const record = await this.prisma.communicationUnsubscribeToken.findUnique({
      where: { tokenHash }
    });
    if (!record) {
      throw new AppError('Invalid unsubscribe token.', 404);
    }

    const now = input.now ?? new Date();
    if (record.expiresAt.getTime() <= now.getTime()) {
      throw new AppError('Unsubscribe token expired.', 410);
    }

    const alreadyUsed = Boolean(record.usedAt);
    if (!alreadyUsed) {
      await this.prisma.communicationUnsubscribeToken.update({
        where: { id: record.id },
        data: { usedAt: now }
      });
    }

    await this.consentService.optOut({
      workspaceId: record.workspaceId,
      channel: record.channel,
      address: record.address,
      source: 'unsubscribe',
      reason: record.category ? `unsubscribe:${record.category}` : 'unsubscribe'
    });
    await this.suppressionService.suppress({
      workspaceId: record.workspaceId,
      channel: record.channel,
      address: record.address,
      reason: 'unsubscribe',
      source: 'unsubscribe_token',
      metadata: {
        unsubscribeTokenId: record.id,
        category: record.category
      }
    });

    return {
      status: alreadyUsed ? 'already_used' : 'unsubscribed',
      workspaceId: record.workspaceId,
      channel: record.channel,
      address: record.address
    };
  }
}
