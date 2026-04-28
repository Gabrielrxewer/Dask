import type { PrismaClient } from '@prisma/client';
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
  }): Promise<{ workItemId: string }> {
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

    const contactName = resolveContactName(leadPayload);
    const contactEmail = normalizeText(leadPayload['email'] as string | undefined);
    const contactPhone = normalizeText((leadPayload['phone'] as string | undefined));
    const companyName = normalizeText((leadPayload['companyName'] as string | undefined) ?? (leadPayload['company'] as string | undefined));
    const interest = normalizeText((leadPayload['interest'] as string | undefined) ?? (leadPayload['productInterest'] as string | undefined));
    const estimatedValue = normalizeText(leadPayload['estimatedValue'] as string | undefined);
    const notes = normalizeText((leadPayload['notes'] as string | undefined) ?? (leadPayload['message'] as string | undefined));

    const workItem = await this.workspaceWorkItemsService.createWorkItem({
      workspaceId,
      userId: ownerMembership.userId,
      payload: {
        title: contactName,
        typeSlug: 'commercial',
        stateSlug: 'lead_new',
        description: notes ?? undefined,
        metadata: {
          contactName,
          contactEmail,
          contactPhone,
          companyName,
          interest,
          estimatedValue,
          source: input.source,
          inboundSource: 'webhook',
          rawPayload: leadPayload
        }
      }
    });

    return { workItemId: workItem.id };
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
