import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { AppError } from '@/core/errors/app-error';
import { isSensitiveRedactionKey, redactSensitiveValue } from '@/core/security/redaction';
import type { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';

interface CommercialIntakeServiceDeps {
  prisma: PrismaClient;
  workspaceWorkItemsService: WorkspaceWorkItemsService;
  webhookSecret?: string;
  environment?: 'development' | 'test' | 'production';
  allowInsecureWebhooks?: boolean;
}

type IntegrationSource = 'ZAPIER' | 'MAKE' | 'N8N' | 'HUBSPOT' | 'RD_STATION' | 'GENERIC_WEBHOOK';

const SECRET_HEADER_NAMES = [
  'x-commercial-intake-secret',
  'x-commercial-webhook-secret',
  'authorization',
  'x-webhook-secret'
] as const;

const SIGNATURE_HEADER_NAMES = [
  'x-commercial-intake-signature',
  'x-commercial-webhook-signature',
  'x-dask-signature'
] as const;

const INTAKE_RAW_PAYLOAD_KEY_PATTERN = /(raw[-_]?body|raw[-_]?payload|^payload$|^body$)/i;

function isIntakeSensitiveKey(key: string): boolean {
  return isSensitiveRedactionKey(key, INTAKE_RAW_PAYLOAD_KEY_PATTERN);
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveSource(source: string): IntegrationSource {
  const s = source.trim().toLowerCase();
  if (s === 'zapier') return 'ZAPIER';
  if (s === 'make' || s === 'integromat') return 'MAKE';
  if (s === 'n8n') return 'N8N';
  if (s === 'hubspot') return 'HUBSPOT';
  if (s === 'rd' || s === 'rd_station' || s === 'rdstation') return 'RD_STATION';
  return 'GENERIC_WEBHOOK';
}

function resolveContactName(payload: Record<string, unknown>): string {
  const fullName = normalizeText(payload['fullName'] as string | undefined) ?? normalizeText(payload['name'] as string | undefined);
  if (fullName) return fullName;

  const firstName = normalizeText(payload['firstName'] as string | undefined);
  const lastName = normalizeText(payload['lastName'] as string | undefined);
  const composed = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (composed) return composed;

  const email = normalizeText(payload['email'] as string | undefined);
  if (email) return email;

  return 'Novo contato';
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

function buildIdempotencyKey(input: {
  workspaceId: string;
  source: IntegrationSource;
  payload: Record<string, unknown>;
  commercialPayload: Record<string, unknown>;
}): string {
  const explicitId =
    normalizeText(input.payload['eventId'] as string | undefined) ??
    normalizeText(input.payload['id'] as string | undefined) ??
    normalizeText(input.commercialPayload['externalId'] as string | undefined) ??
    normalizeText(input.commercialPayload['id'] as string | undefined);

  if (explicitId) {
    return `${input.workspaceId}:${input.source}:${explicitId}`;
  }

  const hash = crypto.createHash('sha256').update(stableStringify(input.payload), 'utf8').digest('hex');
  return `${input.workspaceId}:${input.source}:${hash}`;
}

function stripBearer(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase().startsWith('bearer ')) return normalized.slice(7).trim();
  return normalized;
}

function getHeader(headers: Record<string, string | undefined>, names: readonly string[]): string | null {
  for (const name of names) {
    const value = headers[name];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeSignature(value: string | null | undefined): string | null {
  const normalized = stripBearer(value)?.replace(/^sha256=/i, '').trim().toLowerCase();
  return normalized && /^[a-f0-9]+$/.test(normalized) ? normalized : null;
}

function verifyWebhookSignature(input: {
  rawBody: Buffer | undefined;
  secret: string;
  signature: string | null;
}): boolean {
  const normalizedSignature = normalizeSignature(input.signature);
  if (!input.rawBody || !normalizedSignature) {
    return false;
  }

  const expected = crypto.createHmac('sha256', input.secret).update(input.rawBody).digest('hex');
  return timingSafeEqualString(normalizedSignature, expected);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safePayloadKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record)
    .filter((key) => !isIntakeSensitiveKey(key))
    .sort();
}

function safePayloadSummary(payload: Record<string, unknown>, commercialPayload: Record<string, unknown>): Record<string, unknown> {
  const payloadKeys = safePayloadKeys(payload);
  const commercialPayloadKeys = safePayloadKeys(commercialPayload);
  return {
    payloadKeys,
    commercialPayloadKeys,
    omittedSensitivePayloadKeyCount: Object.keys(payload).length - payloadKeys.length,
    omittedSensitiveCommercialPayloadKeyCount: Object.keys(commercialPayload).length - commercialPayloadKeys.length,
    hasEmail: typeof commercialPayload.email === 'string' && commercialPayload.email.trim().length > 0,
    hasPhone: typeof commercialPayload.phone === 'string' && commercialPayload.phone.trim().length > 0,
    hasMessage: typeof commercialPayload.message === 'string' && commercialPayload.message.trim().length > 0,
    fieldCount: Object.keys(commercialPayload).length
  };
}

function sanitizeMetadataRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !isIntakeSensitiveKey(key))
      .map(([key, value]) => [
        key,
        redactSensitiveValue(value, {
          maskPersonalData: true,
          additionalSensitiveKeyPattern: INTAKE_RAW_PAYLOAD_KEY_PATTERN
        })
      ])
  );
}

function sanitizeCommercialIntakeMetadata(metadata: unknown): Record<string, unknown> {
  if (!isRecord(metadata)) {
    return {};
  }

  const commercialIntake = isRecord(metadata.commercialIntake) ? metadata.commercialIntake : {};
  const safeMetadata = sanitizeMetadataRecord(metadata);
  return {
    ...safeMetadata,
    commercialIntake: sanitizeMetadataRecord(commercialIntake)
  };
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function parseEstimatedValue(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CommercialIntakeService {
  private readonly prisma: PrismaClient;
  private readonly workspaceWorkItemsService: WorkspaceWorkItemsService;
  private readonly webhookSecret: string | null;
  private readonly environment: 'development' | 'test' | 'production';
  private readonly allowInsecureWebhooks: boolean;

  public constructor(deps: CommercialIntakeServiceDeps) {
    this.prisma = deps.prisma;
    this.workspaceWorkItemsService = deps.workspaceWorkItemsService;
    this.webhookSecret = deps.webhookSecret?.trim() ? deps.webhookSecret.trim() : null;
    this.environment = deps.environment ?? 'development';
    this.allowInsecureWebhooks = deps.allowInsecureWebhooks ?? false;
  }

  public resolveSource(source: string): IntegrationSource {
    return resolveSource(source);
  }

  public async handleInboundWebhook(input: {
    source: IntegrationSource;
    headers: Record<string, string | undefined>;
    payload: Record<string, unknown>;
    rawBody?: Buffer;
    workspaceId?: string;
  }): Promise<{ workItemId: string; duplicate: boolean; idempotencyKey: string }> {
    this.assertWebhookAuthorization(input.headers, input.rawBody);

    const nestedCommercialPayload =
      (isRecord(input.payload['signal']) && input.payload['signal']) ||
      (isRecord(input.payload['contact']) && input.payload['contact']) ||
      (isRecord(input.payload['commercial']) && input.payload['commercial']) ||
      (isRecord(input.payload['commercialWorkItem']) && input.payload['commercialWorkItem']);
    const commercialPayload = nestedCommercialPayload
      ? (nestedCommercialPayload as Record<string, unknown>)
      : input.payload;

    const workspaceId = normalizeText(
      input.workspaceId ?? (input.payload['workspaceId'] as string | undefined) ?? (commercialPayload['workspaceId'] as string | undefined)
    );

    if (!workspaceId) {
      throw new AppError('workspaceId is required for commercial intake', 422);
    }

    const ownerMembership = await this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, role: 'OWNER' },
      select: { userId: true }
    });

    if (!ownerMembership) {
      throw new AppError('Workspace not found or has no owner', 404);
    }

    const contactName = resolveContactName(commercialPayload);
    const contactEmail = normalizeText(commercialPayload['email'] as string | undefined);
    const contactPhone = normalizeText((commercialPayload['phone'] as string | undefined));
    const companyName = normalizeText((commercialPayload['companyName'] as string | undefined) ?? (commercialPayload['company'] as string | undefined));
    const interest = normalizeText((commercialPayload['interest'] as string | undefined) ?? (commercialPayload['productInterest'] as string | undefined));
    const estimatedValue = normalizeText(commercialPayload['estimatedValue'] as string | undefined);
    const notes = normalizeText((commercialPayload['notes'] as string | undefined) ?? (commercialPayload['message'] as string | undefined));
    const sourceLabel = normalizeText((commercialPayload['source'] as string | undefined) ?? (commercialPayload['origin'] as string | undefined)) ?? input.source;
    const typeIntent = normalizeText((commercialPayload['workItemType'] as string | undefined) ?? (commercialPayload['type'] as string | undefined) ?? (commercialPayload['kind'] as string | undefined));
    const isSignal = typeIntent ? ['signal', 'sinal', 'prospect', 'prospecting'].includes(typeIntent.toLowerCase()) : false;
    const typeSlug = await this.resolveCommercialTypeSlug(workspaceId, isSignal ? ['signal', 'prospect'] : ['commercial']);
    const stateSlug = await this.resolveCommercialStateSlug(workspaceId, isSignal ? ['prospect', 'commercial_intake'] : ['commercial_intake', 'prospect']);

    const idempotencyKey = buildIdempotencyKey({
      workspaceId,
      source: input.source,
      payload: input.payload,
      commercialPayload
    });

    const commercialFields = compactRecord({
      contactName,
      contactEmail: contactEmail ?? undefined,
      contactPhone: contactPhone ?? undefined,
      companyName: companyName ?? undefined,
      clientName: companyName ?? contactName,
      source: sourceLabel,
      interest: interest ?? undefined,
      estimatedValue: parseEstimatedValue(estimatedValue)
    });
    const customFieldValues = await this.buildCustomFieldValuesBySlug(workspaceId, commercialFields);
    const receivedAt = new Date().toISOString();
    const technicalMetadata = {
      source: input.source,
      inboundSource: 'webhook',
      provider: input.source,
      eventId: normalizeText((input.payload['eventId'] as string | undefined) ?? (input.payload['id'] as string | undefined)),
      externalId: normalizeText((commercialPayload['externalId'] as string | undefined) ?? (commercialPayload['id'] as string | undefined)),
      idempotencyKey,
      normalizedFieldKeys: Object.keys(commercialFields).sort(),
      payloadSummary: safePayloadSummary(input.payload, commercialPayload)
    };

    const existing = await this.prisma.item.findFirst({
      where: {
        workspaceId,
        metadata: {
          path: ['commercialIntake', 'idempotencyKey'],
          equals: idempotencyKey
        }
      },
      select: { id: true, fields: true, metadata: true }
    });

    if (existing) {
      const currentFields = isRecord(existing.fields) ? existing.fields : {};
      const currentMetadata = sanitizeCommercialIntakeMetadata(existing.metadata);
      const currentIntakeMetadata = isRecord(currentMetadata.commercialIntake) ? currentMetadata.commercialIntake : {};

      await this.workspaceWorkItemsService.updateWorkItem({
        workspaceId,
        itemId: existing.id,
        userId: ownerMembership.userId,
        payload: {
          title: contactName,
          typeSlug,
          stateSlug,
          description: notes ?? undefined,
          fields: {
            ...currentFields,
            ...commercialFields
          },
          customFieldValues,
          metadata: {
            ...currentMetadata,
            commercialIntake: {
              ...currentIntakeMetadata,
              ...technicalMetadata,
              lastReceivedAt: receivedAt,
              updateCount: Number(currentIntakeMetadata.updateCount ?? 0) + 1
            }
          }
        }
      });

      return { workItemId: existing.id, duplicate: true, idempotencyKey };
    }

    // Entrada comercial oficial no Dask = WorkItem. Metadata abaixo guarda apenas origem tecnica/idempotencia.
    const workItem = await this.workspaceWorkItemsService.createWorkItem({
      workspaceId,
      userId: ownerMembership.userId,
      payload: {
        title: contactName,
        typeSlug,
        stateSlug,
        description: notes ?? undefined,
        fields: commercialFields,
        customFieldValues,
        metadata: {
          commercialIntake: {
            ...technicalMetadata,
            receivedAt
          }
        }
      }
    });

    return { workItemId: workItem.id, duplicate: false, idempotencyKey };
  }

  private async resolveCommercialTypeSlug(workspaceId: string, preferredSlugs: string[]): Promise<string> {
    const itemType = await this.prisma.workItemType.findFirst({
      where: {
        workspaceId,
        isActive: true,
        slug: { in: preferredSlugs }
      },
      orderBy: { position: 'asc' },
      select: { slug: true }
    });

    if (itemType) {
      return itemType.slug;
    }

    const fallback = await this.prisma.workItemType.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { position: 'asc' },
      select: { slug: true }
    });

    if (!fallback) {
      throw new AppError('Workspace has no active work item type for commercial intake', 422);
    }

    return fallback.slug;
  }

  private async resolveCommercialStateSlug(workspaceId: string, preferredSlugs: string[]): Promise<string> {
    const state = await this.prisma.workflowState.findFirst({
      where: {
        workspaceId,
        isActive: true,
        slug: { in: preferredSlugs }
      },
      orderBy: { position: 'asc' },
      select: { slug: true }
    });

    if (state) {
      return state.slug;
    }

    const fallback = await this.prisma.workflowState.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { position: 'asc' },
      select: { slug: true }
    });

    if (!fallback) {
      throw new AppError('Workspace has no active workflow state for commercial intake', 422);
    }

    return fallback.slug;
  }

  private async buildCustomFieldValuesBySlug(workspaceId: string, fields: Record<string, unknown>) {
    const slugs = Object.keys(fields).filter((slug) => fields[slug] !== undefined);
    if (slugs.length === 0) {
      return {};
    }

    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: {
        workspaceId,
        slug: { in: slugs },
        isActive: true
      },
      select: { id: true, slug: true }
    });

    return definitions.reduce<Record<string, unknown>>((acc, definition) => {
      acc[definition.id] = fields[definition.slug];
      return acc;
    }, {});
  }

  private assertWebhookAuthorization(headers: Record<string, string | undefined>, rawBody?: Buffer): void {
    const expected = stripBearer(this.webhookSecret);

    if (!expected) {
      if (this.environment === 'production' || !this.allowInsecureWebhooks) {
        throw new AppError('Commercial intake webhook secret is required', 401);
      }

      return;
    }

    const signature = getHeader(headers, SIGNATURE_HEADER_NAMES);
    if (signature) {
      if (!verifyWebhookSignature({ rawBody, secret: expected, signature })) {
        throw new AppError('Webhook signature is not authorized', 401);
      }

      return;
    }

    const provided = stripBearer(getHeader(headers, SECRET_HEADER_NAMES));
    if (!provided || !timingSafeEqualString(provided, expected)) {
      throw new AppError('Webhook is not authorized', 401);
    }
  }
}
