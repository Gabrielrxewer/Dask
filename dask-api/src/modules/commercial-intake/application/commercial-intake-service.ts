import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { AppError } from '@/core/errors/app-error';
import type { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';

interface CommercialIntakeServiceDeps {
  prisma: PrismaClient;
  workspaceWorkItemsService: WorkspaceWorkItemsService;
  webhookSecret?: string;
}

type IntegrationSource = 'ZAPIER' | 'MAKE' | 'N8N' | 'HUBSPOT' | 'RD_STATION' | 'GENERIC_WEBHOOK';

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
  leadPayload: Record<string, unknown>;
}): string {
  const explicitId =
    normalizeText(input.payload['eventId'] as string | undefined) ??
    normalizeText(input.payload['id'] as string | undefined) ??
    normalizeText(input.leadPayload['externalId'] as string | undefined) ??
    normalizeText(input.leadPayload['id'] as string | undefined);

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

export class CommercialIntakeService {
  private readonly prisma: PrismaClient;
  private readonly workspaceWorkItemsService: WorkspaceWorkItemsService;
  private readonly webhookSecret: string | null;

  public constructor(deps: CommercialIntakeServiceDeps) {
    this.prisma = deps.prisma;
    this.workspaceWorkItemsService = deps.workspaceWorkItemsService;
    this.webhookSecret = deps.webhookSecret?.trim() ? deps.webhookSecret.trim() : null;
  }

  public resolveSource(source: string): IntegrationSource {
    return resolveSource(source);
  }

  public async handleInboundWebhook(input: {
    source: IntegrationSource;
    headers: Record<string, string | undefined>;
    payload: Record<string, unknown>;
    workspaceId?: string;
  }): Promise<{ workItemId: string; duplicate: boolean; idempotencyKey: string }> {
    this.assertWebhookAuthorization(input.headers);

    const leadPayload = (input.payload['lead'] && typeof input.payload['lead'] === 'object' && !Array.isArray(input.payload['lead']))
      ? (input.payload['lead'] as Record<string, unknown>)
      : input.payload;

    const workspaceId = normalizeText(
      input.workspaceId ?? (input.payload['workspaceId'] as string | undefined) ?? (leadPayload['workspaceId'] as string | undefined)
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

    const idempotencyKey = buildIdempotencyKey({
      workspaceId,
      source: input.source,
      payload: input.payload,
      leadPayload
    });

    const existing = await this.prisma.item.findFirst({
      where: {
        workspaceId,
        metadata: {
          path: ['commercialIntake', 'idempotencyKey'],
          equals: idempotencyKey
        }
      },
      select: { id: true }
    });

    if (existing) {
      return { workItemId: existing.id, duplicate: true, idempotencyKey };
    }

    const contactName = resolveContactName(leadPayload);
    const contactEmail = normalizeText(leadPayload['email'] as string | undefined);
    const contactPhone = normalizeText((leadPayload['phone'] as string | undefined));
    const companyName = normalizeText((leadPayload['companyName'] as string | undefined) ?? (leadPayload['company'] as string | undefined));
    const interest = normalizeText((leadPayload['interest'] as string | undefined) ?? (leadPayload['productInterest'] as string | undefined));
    const estimatedValue = normalizeText(leadPayload['estimatedValue'] as string | undefined);
    const notes = normalizeText((leadPayload['notes'] as string | undefined) ?? (leadPayload['message'] as string | undefined));
    const sourceLabel = normalizeText((leadPayload['source'] as string | undefined) ?? (leadPayload['origin'] as string | undefined)) ?? input.source;
    const typeIntent = normalizeText((leadPayload['workItemType'] as string | undefined) ?? (leadPayload['type'] as string | undefined) ?? (leadPayload['kind'] as string | undefined));
    const isSignal = typeIntent ? ['signal', 'sinal', 'prospect', 'prospecting'].includes(typeIntent.toLowerCase()) : false;
    const typeSlug = await this.resolveCommercialTypeSlug(workspaceId, isSignal ? ['signal', 'prospect'] : ['lead', 'commercial']);
    const stateSlug = await this.resolveCommercialStateSlug(workspaceId, isSignal ? ['prospect', 'lead_new'] : ['lead_new', 'prospect']);

    const commercialFields = {
      contactName,
      contactEmail: contactEmail ?? undefined,
      contactPhone: contactPhone ?? undefined,
      companyName: companyName ?? undefined,
      clientName: companyName ?? contactName,
      source: sourceLabel,
      interest: interest ?? undefined,
      estimatedValue: estimatedValue ? Number(estimatedValue.replace(',', '.')) : undefined
    };
    const customFieldValues = await this.buildCustomFieldValuesBySlug(workspaceId, commercialFields);

    // Lead oficial no Dask = WorkItem comercial. Metadata abaixo e usada somente para origem tecnica/idempotencia.
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
            source: input.source,
            inboundSource: 'webhook',
            provider: input.source,
            eventId: normalizeText((input.payload['eventId'] as string | undefined) ?? (input.payload['id'] as string | undefined)),
            externalId: normalizeText((leadPayload['externalId'] as string | undefined) ?? (leadPayload['id'] as string | undefined)),
            idempotencyKey,
            receivedAt: new Date().toISOString(),
            rawPayload: leadPayload
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

  private assertWebhookAuthorization(headers: Record<string, string | undefined>): void {
    if (!this.webhookSecret) return;

    const provided =
      stripBearer(headers['x-leads-webhook-secret']) ??
      stripBearer(headers.authorization) ??
      stripBearer(headers['x-webhook-secret']);

    const expected = stripBearer(this.webhookSecret);
    if (!provided || !expected || provided !== expected) {
      throw new AppError('Webhook is not authorized', 401);
    }
  }
}
