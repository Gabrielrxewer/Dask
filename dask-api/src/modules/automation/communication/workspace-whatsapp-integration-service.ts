import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { PrismaClient, WorkspaceWhatsAppIntegration } from '@prisma/client';
import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';

type GraphFetch = typeof fetch;

export type WhatsAppIntegrationPublic = {
  id: string;
  workspaceId: string;
  provider: string;
  status: string;
  phoneNumberId: string;
  wabaId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  graphApiVersion: string;
  accessTokenLast4: string | null;
  tokenUpdatedAt: Date;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function encryptionKey(): Buffer {
  return createHash('sha256')
    .update(env.COMMUNICATION_CREDENTIAL_SECRET ?? env.JWT_REFRESH_SECRET, 'utf8')
    .digest();
}

function encryptSecret(value: string): { ciphertext: string; iv: string; authTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

function decryptSecret(record: Pick<WorkspaceWhatsAppIntegration, 'accessTokenCiphertext' | 'accessTokenIv' | 'accessTokenAuthTag'>): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(record.accessTokenIv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.accessTokenAuthTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.accessTokenCiphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function normalizeGraphApiVersion(value: string | undefined): string {
  const version = value?.trim() || 'v23.0';
  return version.startsWith('v') ? version : `v${version}`;
}

function sanitizeIntegration(record: WorkspaceWhatsAppIntegration): WhatsAppIntegrationPublic {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    provider: record.provider,
    status: record.status,
    phoneNumberId: record.phoneNumberId,
    wabaId: record.wabaId,
    displayPhoneNumber: record.displayPhoneNumber,
    verifiedName: record.verifiedName,
    graphApiVersion: record.graphApiVersion,
    accessTokenLast4: record.accessTokenLast4,
    tokenUpdatedAt: record.tokenUpdatedAt,
    lastTestedAt: record.lastTestedAt,
    lastTestStatus: record.lastTestStatus,
    lastTestError: record.lastTestError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function readGraphString(value: unknown, key: string): string | null {
  return value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === 'string'
    ? ((value as Record<string, unknown>)[key] as string)
    : null;
}

export class WorkspaceWhatsAppIntegrationService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly graphFetch: GraphFetch = fetch
  ) {}

  public async getIntegration(input: { workspaceId: string }): Promise<WhatsAppIntegrationPublic | null> {
    const record = await this.prisma.workspaceWhatsAppIntegration.findUnique({
      where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: 'meta' } }
    });
    return record ? sanitizeIntegration(record) : null;
  }

  public async getCredentials(input: { workspaceId: string }): Promise<{
    accessToken: string;
    phoneNumberId: string;
    graphApiVersion: string;
  } | null> {
    const record = await this.prisma.workspaceWhatsAppIntegration.findUnique({
      where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: 'meta' } }
    });
    if (!record || record.status === 'disabled') {
      return null;
    }
    return {
      accessToken: decryptSecret(record),
      phoneNumberId: record.phoneNumberId,
      graphApiVersion: record.graphApiVersion
    };
  }

  public async upsertManualIntegration(input: {
    workspaceId: string;
    accessToken: string;
    phoneNumberId: string;
    wabaId?: string | null;
    graphApiVersion?: string | null;
    displayPhoneNumber?: string | null;
    verifiedName?: string | null;
    userId?: string | null;
  }): Promise<WhatsAppIntegrationPublic> {
    const accessToken = input.accessToken.trim();
    const phoneNumberId = input.phoneNumberId.trim();
    if (!accessToken || !phoneNumberId) {
      throw new AppError('WhatsApp access token and phone number id are required.', 422);
    }

    const encrypted = encryptSecret(accessToken);
    const data = {
      status: 'configured',
      phoneNumberId,
      wabaId: input.wabaId?.trim() || null,
      displayPhoneNumber: input.displayPhoneNumber?.trim() || null,
      verifiedName: input.verifiedName?.trim() || null,
      graphApiVersion: normalizeGraphApiVersion(input.graphApiVersion ?? undefined),
      accessTokenCiphertext: encrypted.ciphertext,
      accessTokenIv: encrypted.iv,
      accessTokenAuthTag: encrypted.authTag,
      accessTokenLast4: accessToken.slice(-4),
      tokenUpdatedAt: new Date(),
      updatedById: input.userId ?? null
    };

    const record = await this.prisma.workspaceWhatsAppIntegration.upsert({
      where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: 'meta' } },
      create: {
        ...data,
        workspaceId: input.workspaceId,
        provider: 'meta',
        createdById: input.userId ?? null
      },
      update: data
    });
    return sanitizeIntegration(record);
  }

  public async disableIntegration(input: { workspaceId: string; userId?: string | null }): Promise<WhatsAppIntegrationPublic> {
    const record = await this.prisma.workspaceWhatsAppIntegration.update({
      where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: 'meta' } },
      data: {
        status: 'disabled',
        updatedById: input.userId ?? null
      }
    });
    return sanitizeIntegration(record);
  }

  public async testIntegration(input: { workspaceId: string }): Promise<WhatsAppIntegrationPublic> {
    const record = await this.prisma.workspaceWhatsAppIntegration.findUnique({
      where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: 'meta' } }
    });
    if (!record) {
      throw new AppError('WhatsApp integration is not configured.', 404);
    }

    const token = decryptSecret(record);
    const version = normalizeGraphApiVersion(record.graphApiVersion);
    try {
      const response = await this.graphFetch(
        `https://graph.facebook.com/${version}/${record.phoneNumberId}?fields=display_phone_number,verified_name,id`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new AppError(readGraphString(payload, 'message') ?? 'Meta WhatsApp connection test failed.', 422, {
          statusCode: response.status
        });
      }

      const updated = await this.prisma.workspaceWhatsAppIntegration.update({
        where: { id: record.id },
        data: {
          status: 'active',
          displayPhoneNumber: readGraphString(payload, 'display_phone_number') ?? record.displayPhoneNumber,
          verifiedName: readGraphString(payload, 'verified_name') ?? record.verifiedName,
          lastTestedAt: new Date(),
          lastTestStatus: 'success',
          lastTestError: null
        }
      });
      return sanitizeIntegration(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Meta WhatsApp connection test failed.';
      const updated = await this.prisma.workspaceWhatsAppIntegration.update({
        where: { id: record.id },
        data: {
          status: 'error',
          lastTestedAt: new Date(),
          lastTestStatus: 'failed',
          lastTestError: message
        }
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(message, 422, { integration: sanitizeIntegration(updated) });
    }
  }
}
