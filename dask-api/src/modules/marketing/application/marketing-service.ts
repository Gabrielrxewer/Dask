import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { JobQueue } from '@/core/jobs/job-queue';
import type { AIProvider } from '@/modules/ai/domain/providers';
import type { AutomationWorkflowService } from '@/modules/automation/application/workflow-service';
import type { AutomationWorkflowVersionService } from '@/modules/automation/application/workflow-version-service';
import type { AutomationWorkflowStatus } from '@/modules/automation/application/workflow-execution-types';
import { compileMarketingJourneyRuntime } from '@/modules/marketing/application/marketing-runtime-compiler';
import {
  chooseWeightedVariant,
  htmlToText,
  type MarketingCommercialContact,
  normalizeSlug,
  normalizeText,
  renderCommercialContactVariables,
  toSegmentFilter,
  type SegmentFilter
} from '@/modules/marketing/domain/types';
import type { MarketingEmailProvider } from '@/modules/marketing/providers/marketing-email-provider';
import type {
  MarketingCampaignDetails,
  MarketingDashboard,
  MarketingRepository,
  SignalInboxItem
} from '@/modules/marketing/repositories/marketing-repository';
import type { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';

type AutomationWorkflowServiceLike = Pick<
  AutomationWorkflowService,
  'createWorkflow' | 'updateWorkflow' | 'setWorkflowStatus'
>;
type AutomationWorkflowVersionServiceLike = Pick<
  AutomationWorkflowVersionService,
  'createDraftVersion' | 'publishVersion'
>;
type EventPublisherLike = Pick<EventPublisher, 'publish'>;
type WorkspaceWorkItemsServiceLike = Pick<WorkspaceWorkItemsService, 'createWorkItem'>;

interface MarketingServiceDeps {
  repo: MarketingRepository;
  eventPublisher: EventPublisherLike;
  jobQueue: JobQueue;
  aiProvider: AIProvider;
  emailProvider: MarketingEmailProvider;
  automationWorkflowService?: AutomationWorkflowServiceLike;
  automationWorkflowVersionService?: AutomationWorkflowVersionServiceLike;
  workspaceWorkItemsService?: WorkspaceWorkItemsServiceLike;
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function parseInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  return Math.trunc(numeric);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getContactWorkItemId(contact: MarketingCommercialContact): string {
  return contact.workItemId;
}

function getSendWorkItemId(send: Record<string, unknown>): string | null {
  const metadata = isRecord(send.metadata) ? send.metadata : {};
  return typeof metadata.sourceWorkItemId === 'string' ? metadata.sourceWorkItemId : null;
}

function mapEventToSendStatus(
  type: string
):
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'CLICKED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'UNSUBSCRIBED'
  | 'FAILED'
  | null {
  if (type === 'EMAIL_SENT') {
    return 'SENT';
  }
  if (type === 'EMAIL_DELIVERED') {
    return 'DELIVERED';
  }
  if (type === 'EMAIL_OPENED') {
    return 'OPENED';
  }
  if (type === 'EMAIL_CLICKED') {
    return 'CLICKED';
  }
  if (type === 'EMAIL_BOUNCED') {
    return 'BOUNCED';
  }
  if (type === 'EMAIL_COMPLAINT') {
    return 'COMPLAINED';
  }
  if (type === 'EMAIL_UNSUBSCRIBED') {
    return 'UNSUBSCRIBED';
  }
  if (type === 'FAILED') {
    return 'FAILED';
  }

  return null;
}

function computeScoreDelta(eventType: string): number {
  if (eventType === 'EMAIL_OPENED') {
    return 2;
  }
  if (eventType === 'EMAIL_CLICKED') {
    return 6;
  }
  if (eventType === 'EMAIL_BOUNCED') {
    return -8;
  }
  if (eventType === 'EMAIL_COMPLAINT') {
    return -10;
  }
  if (eventType === 'EMAIL_UNSUBSCRIBED') {
    return -12;
  }

  return 0;
}

function ensureObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRecordText(source: Record<string, unknown>, key: string): string | null {
  return readStringValue(source[key]);
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  if (Object.prototype.hasOwnProperty.call(source, path)) {
    return source[path];
  }

  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (!isRecord(current)) {
        return undefined;
      }

      return current[segment];
    }, source);
}

function renderTemplateVariables(value: string, variables: Record<string, unknown>): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const resolved = readPath(variables, path);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
}

function readRuntimeMetadata(triggerDefinition: Record<string, unknown>): Record<string, unknown> {
  return ensureObject(ensureObject(triggerDefinition.metadata).runtime);
}

function withRuntimeMetadata(
  triggerDefinition: Record<string, unknown>,
  metadataPatch: Record<string, unknown>
): Record<string, unknown> {
  const metadata = ensureObject(triggerDefinition.metadata);
  const runtime = readRuntimeMetadata(triggerDefinition);
  return {
    ...triggerDefinition,
    metadata: {
      ...metadata,
      runtime: {
        ...runtime,
        ...metadataPatch
      }
    }
  };
}

function mapMarketingFlowStatusToAutomationStatus(status: string | undefined): AutomationWorkflowStatus {
  if (status === 'ACTIVE') {
    return 'active';
  }
  if (status === 'PAUSED') {
    return 'paused';
  }
  if (status === 'ARCHIVED') {
    return 'archived';
  }

  return 'draft';
}

export class MarketingService {
  private readonly repo: MarketingRepository;
  private readonly eventPublisher: EventPublisherLike;
  private readonly jobQueue: JobQueue;
  private readonly aiProvider: AIProvider;
  private readonly emailProvider: MarketingEmailProvider;
  private readonly automationWorkflowService?: AutomationWorkflowServiceLike;
  private readonly automationWorkflowVersionService?: AutomationWorkflowVersionServiceLike;
  private readonly workspaceWorkItemsService?: WorkspaceWorkItemsServiceLike;

  public constructor(deps: MarketingServiceDeps) {
    this.repo = deps.repo;
    this.eventPublisher = deps.eventPublisher;
    this.jobQueue = deps.jobQueue;
    this.aiProvider = deps.aiProvider;
    this.emailProvider = deps.emailProvider;
    this.automationWorkflowService = deps.automationWorkflowService;
    this.automationWorkflowVersionService = deps.automationWorkflowVersionService;
    this.workspaceWorkItemsService = deps.workspaceWorkItemsService;
  }

  public async getDashboard(workspaceId: string): Promise<MarketingDashboard> {
    return this.repo.getDashboard(workspaceId);
  }

  public async listCampaigns(input: {
    workspaceId: string;
    status?: string;
    objective?: string;
    search?: string;
    limit?: number;
  }) {
    return this.repo.listCampaigns({
      ...input,
      limit: Math.max(1, Math.min(input.limit ?? 100, 200))
    });
  }

  public async getCampaignDetails(workspaceId: string, campaignId: string): Promise<MarketingCampaignDetails> {
    const details = await this.repo.findCampaignById(workspaceId, campaignId);
    if (!details) {
      throw new AppError('Campaign not found', 404);
    }

    return details;
  }

  public async createCampaign(input: {
    workspaceId: string;
    name: string;
    description?: string;
    objective: string;
    channel: string;
    hypothesis?: string;
    persona?: string;
    icp?: string;
    offer?: string;
    productRef?: string;
    billingContext?: string;
    segmentId?: string;
    templateId?: string;
    senderProfileId?: string;
    abTestEnabled?: boolean;
    variants?: Array<{
      name: string;
      subject: string;
      preheader?: string;
      bodyMarkdown: string;
      bodyHtml?: string;
      weight?: number;
      isControl?: boolean;
    }>;
    actorUserId?: string | null;
  }) {
    const normalizedName = normalizeText(input.name);
    if (!normalizedName) {
      throw new AppError('Campaign name is required', 422);
    }

    const senderProfile = await this.resolveSenderProfile(input.workspaceId, input.senderProfileId);

    const created = await this.repo.createCampaign({
      workspaceId: input.workspaceId,
      name: normalizedName,
      description: normalizeText(input.description),
      objective: input.objective,
      channel: input.channel,
      status: 'DRAFT',
      hypothesis: normalizeText(input.hypothesis),
      persona: normalizeText(input.persona),
      icp: normalizeText(input.icp),
      offer: normalizeText(input.offer),
      productRef: normalizeText(input.productRef),
      billingContext: normalizeText(input.billingContext),
      segmentId: input.segmentId ?? null,
      templateId: input.templateId ?? null,
      senderProfileId: (senderProfile?.id as string | undefined) ?? null,
      abTestEnabled: input.abTestEnabled ?? false,
      createdByUserId: input.actorUserId ?? null,
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);

    const campaignId = String(created.id);
    const variants =
      input.variants && input.variants.length > 0
        ? input.variants
        : [
            {
              name: 'Controle',
              subject: normalizedName,
              bodyMarkdown: normalizeText(input.description) ?? 'Conteudo inicial da campanha.',
              weight: 100,
              isControl: true
            }
          ];

    for (const [index, variant] of variants.entries()) {
      await this.repo.createCampaignVariant({
        workspaceId: input.workspaceId,
        campaignId,
        name: normalizeText(variant.name) ?? `Variante ${index + 1}`,
        subject: normalizeText(variant.subject) ?? normalizedName,
        preheader: normalizeText(variant.preheader),
        bodyMarkdown: normalizeText(variant.bodyMarkdown) ?? '',
        bodyHtml: normalizeText(variant.bodyHtml),
        weight: parseInteger(variant.weight, 100),
        isControl: variant.isControl ?? index === 0,
        createdByUserId: input.actorUserId ?? null,
        updatedByUserId: input.actorUserId ?? null
      } as unknown as Prisma.InputJsonValue);
    }

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId,
      type: 'CAMPAIGN_CREATED',
      headline: 'Campanha criada',
      description: `Campanha ${normalizedName} criada em rascunho.`,
      payload: {
        objective: input.objective,
        channel: input.channel,
        createdByUserId: input.actorUserId ?? null
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.MarketingCampaignCreated,
      aggregateType: 'marketing-campaign',
      aggregateId: campaignId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        campaignId,
        createdBy: input.actorUserId ?? null,
        objective: input.objective
      }
    });

    return this.getCampaignDetails(input.workspaceId, campaignId);
  }

  public async updateCampaign(input: {
    workspaceId: string;
    campaignId: string;
    patch: {
      name?: string;
      description?: string;
      objective?: string;
      status?: string;
      persona?: string;
      icp?: string;
      offer?: string;
      segmentId?: string | null;
      templateId?: string | null;
      senderProfileId?: string | null;
      abTestEnabled?: boolean;
      abTestConfig?: Record<string, unknown>;
    };
    actorUserId?: string | null;
  }) {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    const current = details.campaign;

    if (String(current.status) === 'ARCHIVED') {
      throw new AppError('Archived campaign cannot be edited', 422);
    }

    let senderProfileId = input.patch.senderProfileId;
    if (senderProfileId !== undefined) {
      if (senderProfileId === null) {
        const defaultSender = await this.resolveSenderProfile(input.workspaceId, undefined);
        senderProfileId = (defaultSender?.id as string | undefined) ?? null;
      } else {
        const sender = await this.resolveSenderProfile(input.workspaceId, senderProfileId);
        senderProfileId = (sender?.id as string | undefined) ?? null;
      }
    }

    await this.repo.updateCampaign(input.workspaceId, input.campaignId, {
      ...(input.patch.name !== undefined ? { name: normalizeText(input.patch.name) } : {}),
      ...(input.patch.description !== undefined ? { description: normalizeText(input.patch.description) } : {}),
      ...(input.patch.objective !== undefined ? { objective: input.patch.objective } : {}),
      ...(input.patch.status !== undefined ? { status: input.patch.status } : {}),
      ...(input.patch.persona !== undefined ? { persona: normalizeText(input.patch.persona) } : {}),
      ...(input.patch.icp !== undefined ? { icp: normalizeText(input.patch.icp) } : {}),
      ...(input.patch.offer !== undefined ? { offer: normalizeText(input.patch.offer) } : {}),
      ...(input.patch.segmentId !== undefined ? { segmentId: input.patch.segmentId } : {}),
      ...(input.patch.templateId !== undefined ? { templateId: input.patch.templateId } : {}),
      ...(senderProfileId !== undefined ? { senderProfileId } : {}),
      ...(input.patch.abTestEnabled !== undefined ? { abTestEnabled: input.patch.abTestEnabled } : {}),
      ...(input.patch.abTestConfig !== undefined ? { abTestConfig: input.patch.abTestConfig } : {}),
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      type: 'CAMPAIGN_UPDATED',
      headline: 'Campanha atualizada',
      description: 'Alteracoes salvas na campanha.',
      payload: {
        patchKeys: Object.keys(input.patch),
        updatedByUserId: input.actorUserId ?? null
      }
    });

    return this.getCampaignDetails(input.workspaceId, input.campaignId);
  }

  public async submitCampaignForReview(input: {
    workspaceId: string;
    campaignId: string;
    actorUserId?: string | null;
  }) {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    const campaign = details.campaign;

    if (String(campaign.status) !== 'DRAFT') {
      throw new AppError('Only draft campaigns can be submitted for review', 422);
    }

    this.assertCampaignCanBeSent(details);

    await this.repo.updateCampaign(input.workspaceId, input.campaignId, {
      status: 'IN_REVIEW',
      approvalRequestedAt: new Date(),
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      type: 'CAMPAIGN_REVIEW_REQUESTED',
      headline: 'Campanha em revisao',
      description: 'Campanha enviada para revisao e aprovacao.',
      payload: {
        requestedByUserId: input.actorUserId ?? null
      }
    });

    return this.getCampaignDetails(input.workspaceId, input.campaignId);
  }

  public async approveCampaign(input: {
    workspaceId: string;
    campaignId: string;
    actorUserId: string;
  }) {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    if (!['IN_REVIEW', 'DRAFT'].includes(String(details.campaign.status))) {
      throw new AppError('Campaign cannot be approved in current status', 422);
    }

    await this.repo.updateCampaign(input.workspaceId, input.campaignId, {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId
    } as unknown as Prisma.InputJsonValue);

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      type: 'CAMPAIGN_APPROVED',
      headline: 'Campanha aprovada',
      description: 'Campanha aprovada para agendamento ou envio.',
      payload: {
        approvedByUserId: input.actorUserId
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.MarketingCampaignApproved,
      aggregateType: 'marketing-campaign',
      aggregateId: input.campaignId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        approvedBy: input.actorUserId
      }
    });

    return this.getCampaignDetails(input.workspaceId, input.campaignId);
  }

  public async scheduleCampaign(input: {
    workspaceId: string;
    campaignId: string;
    scheduledAt: Date;
    actorUserId?: string | null;
  }) {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    this.assertCampaignCanBeSent(details);

    if (input.scheduledAt.getTime() <= Date.now()) {
      throw new AppError('Schedule must be in the future', 422);
    }

    await this.repo.updateCampaign(input.workspaceId, input.campaignId, {
      status: 'SCHEDULED',
      scheduledAt: input.scheduledAt,
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      type: 'CAMPAIGN_SCHEDULED',
      headline: 'Campanha agendada',
      description: `Envio agendado para ${input.scheduledAt.toISOString()}.`,
      payload: {
        scheduledAt: input.scheduledAt.toISOString(),
        scheduledByUserId: input.actorUserId ?? null
      }
    });

    return this.getCampaignDetails(input.workspaceId, input.campaignId);
  }

  public async launchCampaign(input: {
    workspaceId: string;
    campaignId: string;
    actorUserId?: string | null;
    dryRun?: boolean;
  }): Promise<{
    queued: number;
    skipped: number;
    skippedWithoutConsent: number;
    skippedWithoutEmail: number;
    contactsEvaluated: number;
  }> {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    const campaign = details.campaign;

    if (!['APPROVED', 'SCHEDULED', 'ACTIVE'].includes(String(campaign.status))) {
      throw new AppError('Campaign must be approved before launch', 422);
    }

    this.assertCampaignCanBeSent(details);

    const segment = details.segment;
    const filter = toSegmentFilter((segment?.filters as unknown) ?? { logic: 'AND', rules: [] });
    const targetContacts = await this.repo.listContactsForSegment({
      workspaceId: input.workspaceId,
      filter,
      limit: 5000
    });

    const variants = details.variants.map((entry) => ({
      id: String(entry.id),
      subject: String(entry.subject ?? ''),
      bodyMarkdown: String(entry.bodyMarkdown ?? ''),
      bodyHtml: normalizeText(String(entry.bodyHtml ?? '')),
      preheader: normalizeText(String(entry.preheader ?? '')),
      weight: parseInteger(entry.weight, 100),
      isControl: Boolean(entry.isControl)
    }));

    const senderProfile = details.senderProfile;
    const fromEmail = String(senderProfile?.fromEmail ?? '');
    const fromName = String(senderProfile?.fromName ?? 'Dask Marketing');
    const from = `${fromName} <${fromEmail}>`;
    const replyTo = normalizeText(String(senderProfile?.replyToEmail ?? ''));

    let queued = 0;
    let skipped = 0;
    let skippedWithoutConsent = 0;
    let skippedWithoutEmail = 0;

    for (const contact of targetContacts) {
      const sourceWorkItemId = getContactWorkItemId(contact);
      const contactEmail = normalizeText(contact.email);
      if (!contactEmail) {
        skipped += 1;
        skippedWithoutEmail += 1;
        continue;
      }

      const preference = await this.repo.upsertContactPreference({
        workspaceId: input.workspaceId,
        email: contactEmail,
        messageKind: 'MARKETING'
      } as unknown as Prisma.InputJsonValue);

      const consentStatus = String((preference as Record<string, unknown>).consentStatus ?? 'UNKNOWN');
      const allowEmail = (preference as Record<string, unknown>).allowEmail !== false;
      if (!allowEmail || ['OPT_OUT', 'UNSUBSCRIBED'].includes(consentStatus)) {
        skipped += 1;
        skippedWithoutConsent += 1;
        continue;
      }

      const variant = chooseWeightedVariant(variants);
      const renderedMarkdown = renderCommercialContactVariables(variant.bodyMarkdown, contact);
      const renderedHtml = variant.bodyHtml
        ? renderCommercialContactVariables(variant.bodyHtml, contact)
        : `<pre>${renderedMarkdown.replace(/[<>]/g, '')}</pre>`;
      const renderedSubject = renderCommercialContactVariables(variant.subject, contact);

      const idempotencyKey = `mkt:${input.workspaceId}:${input.campaignId}:${contact.id}:${variant.id}`;

      if (!input.dryRun) {
        const send = await this.repo.createCampaignSend({
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          variantId: variant.id,
          workItemId: sourceWorkItemId,
          senderProfileId: senderProfile?.id ?? null,
          contactEmail,
          status: 'QUEUED',
          idempotencyKey,
          scheduledAt: campaign.scheduledAt ? new Date(String(campaign.scheduledAt)) : new Date(),
          metadata: {
            from,
            replyTo,
            renderedSubject,
            renderedHtml,
            renderedText: htmlToText(renderedHtml),
            sourceWorkItemId,
            sourceEntityType: 'work_item'
          }
        } as unknown as Prisma.InputJsonValue);

        await this.registerEvent({
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          variantId: variant.id,
          itemId: sourceWorkItemId ?? undefined,
          sendId: String(send.id),
          type: 'SEND_QUEUED',
          headline: 'Envio enfileirado',
          description: `Envio preparado para ${contactEmail}.`,
          payload: {
            idempotencyKey,
            queuedByUserId: input.actorUserId ?? null
          }
        });

        await this.repo.createWorkItemActivity({
          workspaceId: input.workspaceId,
          workItemId: sourceWorkItemId,
          actorUserId: input.actorUserId ?? null,
          type: 'NOTE',
          title: 'Campanha de marketing enfileirada',
          description: `Campanha ${campaign.name as string} preparada para envio.`,
          payload: {
            campaignId: input.campaignId,
            variantId: variant.id,
            contactEmail
          },
          occurredAt: new Date()
        });

        await this.jobQueue.enqueue(
          'marketing.send-email',
          {
            sendId: String(send.id)
          },
          {
            jobId: idempotencyKey
          }
        );
      }

      queued += 1;
    }

    if (!input.dryRun) {
      await this.repo.updateCampaign(input.workspaceId, input.campaignId, {
        status: 'ACTIVE',
        launchedAt: new Date(),
        updatedByUserId: input.actorUserId ?? null
      } as unknown as Prisma.InputJsonValue);

      await this.registerEvent({
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        type: 'CAMPAIGN_LAUNCHED',
        headline: 'Campanha disparada',
        description: `Campanha enviada para ${queued} contatos elegiveis.`,
        payload: {
          queued,
          skipped,
          skippedWithoutConsent,
          skippedWithoutEmail,
          launchedByUserId: input.actorUserId ?? null
        }
      });

      await this.eventPublisher.publish({
        id: crypto.randomUUID(),
        name: DomainEventNames.MarketingCampaignLaunched,
        aggregateType: 'marketing-campaign',
        aggregateId: input.campaignId,
        occurredAt: new Date(),
        payload: {
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          queued,
          skipped,
          launchedBy: input.actorUserId ?? null
        }
      });
    }

    return {
      queued,
      skipped,
      skippedWithoutConsent,
      skippedWithoutEmail,
      contactsEvaluated: targetContacts.length
    };
  }

  public async sendTestEmail(input: {
    workspaceId: string;
    campaignId: string;
    to: string;
    subject?: string;
    content?: string;
    actorUserId?: string | null;
  }) {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    this.assertCampaignCanBeSent(details);

    const senderProfile = details.senderProfile;
    const from = `${String(senderProfile?.fromName ?? 'Dask Marketing')} <${String(senderProfile?.fromEmail ?? '')}>`;

    const variant = details.variants[0] as Record<string, unknown> | undefined;
    const subject = normalizeText(input.subject) ?? String(variant?.subject ?? details.campaign.name);
    const bodyMarkdown = normalizeText(input.content) ?? String(variant?.bodyMarkdown ?? details.campaign.description ?? '');
    const html = `<pre>${bodyMarkdown.replace(/[<>]/g, '')}</pre>`;

    const sent = await this.emailProvider.sendEmail({
      from,
      to: input.to,
      subject,
      html,
      text: bodyMarkdown,
      replyTo: normalizeText(String(senderProfile?.replyToEmail ?? '')) ?? undefined,
      metadata: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        mode: 'test'
      }
    });

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      type: 'EMAIL_SENT',
      headline: 'Teste enviado',
      description: `E-mail de teste enviado para ${input.to}.`,
      payload: {
        providerKey: sent.providerKey,
        providerMessageId: sent.messageId,
        sentByUserId: input.actorUserId ?? null,
        test: true
      }
    });

    return {
      providerKey: sent.providerKey,
      providerMessageId: sent.messageId
    };
  }

  public async processQueuedSend(sendId: string): Promise<void> {
    const send = await this.repo.findCampaignSendById(sendId);
    if (!send) {
      return;
    }

    const currentStatus = String(send.status);
    if (
      ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'].includes(
        currentStatus
      )
    ) {
      return;
    }

    const metadata = ensureObject(send.metadata);
    const html = String(metadata.renderedHtml ?? '');
    const text = normalizeText(String(metadata.renderedText ?? '')) ?? htmlToText(html);
    const subject = normalizeText(String(metadata.renderedSubject ?? '')) ?? 'Mensagem Dask Marketing';
    const from = normalizeText(String(metadata.from ?? ''));
    const sourceWorkItemId = getSendWorkItemId(send);

    if (!from) {
      throw new AppError('Sender profile is not configured for campaign send', 422);
    }

    try {
      const sent = await this.emailProvider.sendEmail({
        from,
        to: String(send.contactEmail),
        subject,
        html,
        text,
        replyTo: normalizeText(String(metadata.replyTo ?? '')) ?? undefined,
        metadata: {
          workspaceId: String(send.workspaceId),
          campaignId: String(send.campaignId),
          sendId
        }
      });

      await this.repo.updateCampaignSend(sendId, {
        status: 'SENT',
        sentAt: new Date(),
        providerKey: sent.providerKey,
        providerMessageId: sent.messageId
      } as unknown as Prisma.InputJsonValue);

      await this.registerEvent({
        workspaceId: String(send.workspaceId),
        campaignId: String(send.campaignId),
        variantId: String(send.variantId),
        itemId: sourceWorkItemId ?? undefined,
        sendId,
        type: 'EMAIL_SENT',
        headline: 'E-mail enviado',
        description: `E-mail enviado para ${String(send.contactEmail)}.`,
        payload: {
          providerKey: sent.providerKey,
          providerMessageId: sent.messageId
        }
      });

      if (sourceWorkItemId) {
        await this.repo.createWorkItemActivity({
          workspaceId: String(send.workspaceId),
          workItemId: sourceWorkItemId,
          type: 'EMAIL_MARKETING_SENT',
          title: 'E-mail de marketing enviado',
          description: `E-mail enviado para ${String(send.contactEmail)}.`,
          payload: {
            marketingCampaignId: String(send.campaignId),
            marketingSendId: sendId,
            providerMessageId: sent.messageId,
            subject
          },
          occurredAt: new Date()
        });
      }

      await this.eventPublisher.publish({
        id: crypto.randomUUID(),
        name: DomainEventNames.MarketingEmailSent,
        aggregateType: 'marketing-send',
        aggregateId: sendId,
        occurredAt: new Date(),
        payload: {
          workspaceId: String(send.workspaceId),
          campaignId: String(send.campaignId),
          sendId,
          itemId: sourceWorkItemId,
          providerMessageId: sent.messageId
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown marketing send failure';

      await this.repo.updateCampaignSend(sendId, {
        status: 'FAILED',
        failedAt: new Date(),
        errorMessage: message
      } as unknown as Prisma.InputJsonValue);

      await this.registerEvent({
        workspaceId: String(send.workspaceId),
        campaignId: String(send.campaignId),
        variantId: String(send.variantId),
        itemId: sourceWorkItemId ?? undefined,
        sendId,
        type: 'EMAIL_BOUNCED',
        headline: 'Falha de envio',
        description: `Falha ao enviar e-mail para ${String(send.contactEmail)}.`,
        payload: {
          error: message
        }
      });

      throw error;
    }
  }

  public async registerProviderEvent(input: {
    workspaceId: string;
    provider: string;
    providerMessageId: string;
    eventType:
      | 'EMAIL_DELIVERED'
      | 'EMAIL_OPENED'
      | 'EMAIL_CLICKED'
      | 'EMAIL_BOUNCED'
      | 'EMAIL_COMPLAINT'
      | 'EMAIL_UNSUBSCRIBED';
    occurredAt?: Date;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const send = await this.repo.findCampaignSendByProviderMessageId(input.workspaceId, input.providerMessageId);
    if (!send) {
      return;
    }

    const sourceWorkItemId = getSendWorkItemId(send);
    const status = mapEventToSendStatus(input.eventType);

    if (status) {
      const patch: Record<string, unknown> = {
        status,
        providerKey: input.provider
      };
      const occurredAt = input.occurredAt ?? new Date();
      if (status === 'DELIVERED') {
        patch.deliveredAt = occurredAt;
      }
      if (status === 'OPENED') {
        patch.openedAt = occurredAt;
      }
      if (status === 'CLICKED') {
        patch.clickedAt = occurredAt;
      }
      if (status === 'BOUNCED') {
        patch.bouncedAt = occurredAt;
      }
      if (status === 'COMPLAINED') {
        patch.complainedAt = occurredAt;
      }
      if (status === 'UNSUBSCRIBED') {
        patch.unsubscribedAt = occurredAt;
      }

      await this.repo.updateCampaignSend(String(send.id), patch as unknown as Prisma.InputJsonValue);
    }

    const event = await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: String(send.campaignId),
      variantId: String(send.variantId),
      itemId: sourceWorkItemId ?? undefined,
      sendId: String(send.id),
      type: input.eventType,
      headline: this.eventHeadline(input.eventType),
      description: `Evento ${input.eventType} recebido do provedor ${input.provider}.`,
      payload: {
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        ...(input.payload ?? {})
      },
      occurredAt: input.occurredAt
    });

    if (sourceWorkItemId) {
      await this.applyWorkItemScoreFromEvent({
        workspaceId: input.workspaceId,
        workItemId: sourceWorkItemId,
        campaignId: String(send.campaignId),
        eventId: String(event.id),
        eventType: input.eventType,
        actorUserId: null
      });

      if (input.eventType === 'EMAIL_UNSUBSCRIBED') {
        await this.repo.upsertContactPreference({
          workspaceId: input.workspaceId,
          email: String(send.contactEmail),
          messageKind: 'MARKETING',
          consentStatus: 'UNSUBSCRIBED',
          allowEmail: false,
          allowNewsletter: false,
          unsubscribeAt: input.occurredAt ?? new Date()
        } as unknown as Prisma.InputJsonValue);

        await this.repo.createWorkItemActivity({
          workspaceId: input.workspaceId,
          workItemId: sourceWorkItemId,
          actorUserId: null,
          type: 'NOTE',
          title: 'Contato realizou unsubscribe',
          description: 'Contato saiu das comunicacoes de marketing.',
          payload: {
            campaignId: String(send.campaignId),
            sendId: String(send.id),
            providerMessageId: input.providerMessageId
          },
          occurredAt: input.occurredAt ?? new Date()
        });
      }
    }
  }

  public async listAudienceContacts(input: {
    workspaceId: string;
    search?: string;
    stage?: string;
    consentStatus?: string;
    limit?: number;
  }) {
    return this.repo.listAudienceContacts({
      workspaceId: input.workspaceId,
      search: input.search,
      status: input.stage,
      consentStatus: input.consentStatus,
      limit: Math.max(1, Math.min(input.limit ?? 200, 400))
    });
  }

  public async listSegments(workspaceId: string) {
    return this.repo.listSegments(workspaceId);
  }

  public async createSegment(input: {
    workspaceId: string;
    name: string;
    description?: string;
    kind?: 'STATIC' | 'DYNAMIC';
    filters: SegmentFilter;
    actorUserId?: string | null;
  }) {
    const name = normalizeText(input.name);
    if (!name) {
      throw new AppError('Segment name is required', 422);
    }

    return this.repo.createSegment({
      workspaceId: input.workspaceId,
      name,
      description: normalizeText(input.description),
      kind: input.kind ?? 'DYNAMIC',
      filters: input.filters,
      createdByUserId: input.actorUserId ?? null,
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);
  }

  public async updateSegment(input: {
    workspaceId: string;
    segmentId: string;
    patch: {
      name?: string;
      description?: string;
      kind?: 'STATIC' | 'DYNAMIC';
      filters?: SegmentFilter;
      isActive?: boolean;
    };
    actorUserId?: string | null;
  }) {
    const current = await this.repo.findSegmentById(input.workspaceId, input.segmentId);
    if (!current) {
      throw new AppError('Segment not found', 404);
    }

    return this.repo.updateSegment(input.workspaceId, input.segmentId, {
      ...(input.patch.name !== undefined ? { name: normalizeText(input.patch.name) } : {}),
      ...(input.patch.description !== undefined ? { description: normalizeText(input.patch.description) } : {}),
      ...(input.patch.kind !== undefined ? { kind: input.patch.kind } : {}),
      ...(input.patch.filters !== undefined ? { filters: input.patch.filters } : {}),
      ...(input.patch.isActive !== undefined ? { isActive: input.patch.isActive } : {}),
      updatedByUserId: input.actorUserId ?? null,
      lastEvaluatedAt: new Date()
    } as unknown as Prisma.InputJsonValue);
  }

  public async previewSegment(input: {
    workspaceId: string;
    segmentId: string;
    limit?: number;
  }) {
    const segment = await this.repo.findSegmentById(input.workspaceId, input.segmentId);
    if (!segment) {
      throw new AppError('Segment not found', 404);
    }

    const filter = toSegmentFilter((segment.filters as unknown) ?? { logic: 'AND', rules: [] });
    const contacts = await this.repo.listContactsForSegment({
      workspaceId: input.workspaceId,
      filter,
      limit: Math.max(1, Math.min(input.limit ?? 200, 500))
    });

    await this.repo.updateSegment(input.workspaceId, input.segmentId, {
      estimatedContacts: contacts.length,
      lastEvaluatedAt: new Date()
    } as unknown as Prisma.InputJsonValue);

    return {
      segment,
      estimatedContacts: contacts.length,
      sample: contacts.slice(0, 30)
    };
  }

  public async listTemplates(workspaceId: string) {
    return this.repo.listTemplates(workspaceId);
  }

  public async createTemplate(input: {
    workspaceId: string;
    name: string;
    slug?: string;
    category?: string;
    objective?: string;
    funnelStage?: string;
    subject: string;
    bodyMarkdown: string;
    bodyHtml?: string;
    blocks?: Record<string, unknown>;
    actorUserId?: string | null;
  }) {
    const name = normalizeText(input.name);
    const subject = normalizeText(input.subject);
    const bodyMarkdown = normalizeText(input.bodyMarkdown);

    if (!name || !subject || !bodyMarkdown) {
      throw new AppError('Template name, subject and body are required', 422);
    }

    const slug = normalizeSlug(input.slug ?? name);
    const existing = await this.repo.findTemplateBySlug(input.workspaceId, slug);
    if (existing) {
      throw new AppError('Template slug already exists in this workspace', 409);
    }

    return this.repo.createTemplate({
      workspaceId: input.workspaceId,
      name,
      slug,
      category: normalizeText(input.category),
      objective: input.objective ?? null,
      funnelStage: normalizeText(input.funnelStage),
      subject,
      bodyMarkdown,
      bodyHtml: normalizeText(input.bodyHtml),
      blocks: input.blocks ?? null,
      createdByUserId: input.actorUserId ?? null,
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);
  }

  public async updateTemplate(input: {
    workspaceId: string;
    templateId: string;
    patch: {
      name?: string;
      category?: string;
      objective?: string | null;
      funnelStage?: string;
      subject?: string;
      bodyMarkdown?: string;
      bodyHtml?: string;
      blocks?: Record<string, unknown>;
      isArchived?: boolean;
    };
    actorUserId?: string | null;
  }) {
    const current = await this.repo.findTemplateById(input.workspaceId, input.templateId);
    if (!current) {
      throw new AppError('Template not found', 404);
    }

    return this.repo.updateTemplate(input.workspaceId, input.templateId, {
      ...(input.patch.name !== undefined ? { name: normalizeText(input.patch.name) } : {}),
      ...(input.patch.category !== undefined ? { category: normalizeText(input.patch.category) } : {}),
      ...(input.patch.objective !== undefined ? { objective: input.patch.objective } : {}),
      ...(input.patch.funnelStage !== undefined ? { funnelStage: normalizeText(input.patch.funnelStage) } : {}),
      ...(input.patch.subject !== undefined ? { subject: normalizeText(input.patch.subject) } : {}),
      ...(input.patch.bodyMarkdown !== undefined ? { bodyMarkdown: normalizeText(input.patch.bodyMarkdown) } : {}),
      ...(input.patch.bodyHtml !== undefined ? { bodyHtml: normalizeText(input.patch.bodyHtml) } : {}),
      ...(input.patch.blocks !== undefined ? { blocks: input.patch.blocks } : {}),
      ...(input.patch.isArchived !== undefined ? { isArchived: input.patch.isArchived } : {}),
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);
  }

  public async sendTemplateTestEmail(input: {
    workspaceId: string;
    templateId: string;
    to: string;
    variables?: Record<string, string | number | boolean | null>;
    actorUserId?: string | null;
  }) {
    const template = await this.repo.findTemplateById(input.workspaceId, input.templateId);
    if (!template) {
      throw new AppError('Template not found', 404);
    }
    if (template.isArchived === true) {
      throw new AppError('Archived templates cannot send test emails', 422);
    }

    const subject = readRecordText(template, 'subject');
    const bodyMarkdown = readRecordText(template, 'bodyMarkdown');
    if (!subject || !bodyMarkdown) {
      throw new AppError('Template subject and body are required before sending a test', 422);
    }

    const variables = input.variables ?? {};
    const senderProfile = await this.resolveSenderProfile(input.workspaceId, undefined);
    const fromEmail = readRecordText(senderProfile ?? {}, 'fromEmail');
    if (!fromEmail) {
      throw new AppError('Sender profile is required before sending a template test', 422);
    }

    const fromName = readRecordText(senderProfile ?? {}, 'fromName') ?? 'Dask Marketing';
    const renderedSubject = renderTemplateVariables(subject, variables);
    const renderedMarkdown = renderTemplateVariables(bodyMarkdown, variables);
    const bodyHtml = readRecordText(template, 'bodyHtml');
    const renderedHtml = bodyHtml
      ? renderTemplateVariables(bodyHtml, variables)
      : `<pre>${escapeHtml(renderedMarkdown)}</pre>`;

    const sent = await this.emailProvider.sendEmail({
      from: `${fromName} <${fromEmail}>`,
      to: input.to,
      subject: renderedSubject,
      html: renderedHtml,
      text: htmlToText(renderedHtml) || renderedMarkdown,
      replyTo: readRecordText(senderProfile ?? {}, 'replyToEmail') ?? undefined,
      metadata: {
        workspaceId: input.workspaceId,
        templateId: input.templateId,
        mode: 'template_test'
      }
    });

    await this.registerEvent({
      workspaceId: input.workspaceId,
      type: 'EMAIL_SENT',
      headline: 'Teste de template enviado',
      description: `Template enviado para ${input.to}.`,
      payload: {
        templateId: input.templateId,
        providerKey: sent.providerKey,
        providerMessageId: sent.messageId,
        sentByUserId: input.actorUserId ?? null,
        test: true
      }
    });

    return {
      providerKey: sent.providerKey,
      providerMessageId: sent.messageId
    };
  }

  public async listCampaignAnalytics(input: {
    workspaceId: string;
    campaignId: string;
  }) {
    await this.getCampaignDetails(input.workspaceId, input.campaignId);
    return this.repo.listCampaignAnalytics(input.campaignId);
  }

  public async listAutomationFlows(workspaceId: string) {
    return this.repo.listAutomationFlows(workspaceId);
  }

  private async syncAutomationRuntimeForFlow(input: {
    workspaceId: string;
    flowId: string;
    name: string;
    description?: string | null;
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    triggerDefinition: Record<string, unknown>;
    actorUserId?: string | null;
    publish: boolean;
  }): Promise<Record<string, unknown>> {
    const compiledRuntime = compileMarketingJourneyRuntime({
      flowId: input.flowId,
      name: input.name,
      description: input.description,
      status: input.status,
      triggerDefinition: input.triggerDefinition
    });
    if (!compiledRuntime) {
      if (input.publish) {
        throw new AppError('Journey runtime graph is required before activation', 422);
      }

      return input.triggerDefinition;
    }

    if (!this.automationWorkflowService || !this.automationWorkflowVersionService) {
      throw new AppError('Automation runtime is not configured for marketing journeys', 500);
    }

    const runtimeMetadata = readRuntimeMetadata(input.triggerDefinition);
    let workflowId = readStringValue(runtimeMetadata.workflowId);
    const workflowStatus = input.publish ? 'draft' : mapMarketingFlowStatusToAutomationStatus(input.status);

    if (workflowId) {
      await this.automationWorkflowService.updateWorkflow({
        workspaceId: input.workspaceId,
        workflowId,
        name: input.name,
        description: input.description ?? null,
        status: workflowStatus
      });
    } else {
      const workflow = await this.automationWorkflowService.createWorkflow({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description ?? null,
        status: 'draft',
        createdById: input.actorUserId ?? null
      });
      workflowId = String(workflow.id);
    }

    const draftVersion = await this.automationWorkflowVersionService.createDraftVersion({
      workspaceId: input.workspaceId,
      workflowId,
      definition: compiledRuntime.definition,
      graph: compiledRuntime.graph
    });

    if (!input.publish) {
      return withRuntimeMetadata(input.triggerDefinition, {
        workflowId,
        workflowVersionId: String(draftVersion.id),
        status: mapMarketingFlowStatusToAutomationStatus(input.status),
        syncedAt: new Date().toISOString()
      });
    }

    const published = await this.automationWorkflowVersionService.publishVersion({
      workspaceId: input.workspaceId,
      workflowId,
      versionId: String(draftVersion.id),
      publishedById: input.actorUserId ?? null,
      activateWorkflow: true
    });

    return withRuntimeMetadata(input.triggerDefinition, {
      workflowId,
      workflowVersionId: String(published.id),
      status: 'active',
      syncedAt: new Date().toISOString(),
      publishedAt: published.publishedAt instanceof Date
        ? published.publishedAt.toISOString()
        : new Date().toISOString()
    });
  }

  private async setMarketingRuntimeStatus(input: {
    workspaceId: string;
    triggerDefinition: Record<string, unknown>;
    status: AutomationWorkflowStatus;
  }): Promise<Record<string, unknown>> {
    const workflowId = readStringValue(readRuntimeMetadata(input.triggerDefinition).workflowId);
    if (workflowId && this.automationWorkflowService) {
      await this.automationWorkflowService.setWorkflowStatus({
        workspaceId: input.workspaceId,
        workflowId,
        status: input.status
      });
    }

    return withRuntimeMetadata(input.triggerDefinition, {
      status: input.status,
      syncedAt: new Date().toISOString()
    });
  }

  public async createAutomationFlow(input: {
    workspaceId: string;
    name: string;
    description?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    triggerDefinition: Record<string, unknown>;
    entryCriteria?: Record<string, unknown>;
    exitCriteria?: Record<string, unknown>;
    steps?: Array<{
      key: string;
      name: string;
      kind: 'TRIGGER' | 'CONDITION' | 'DELAY' | 'ACTION' | 'BRANCH' | 'EXIT';
      position?: number;
      config?: Record<string, unknown>;
      nextStepId?: string;
    }>;
    actorUserId?: string | null;
  }) {
    const name = normalizeText(input.name);
    if (!name) {
      throw new AppError('Flow name is required', 422);
    }

    const initialStatus = input.status ?? 'DRAFT';
    let triggerDefinition = input.triggerDefinition;

    const flow = await this.repo.createAutomationFlow({
      workspaceId: input.workspaceId,
      name,
      description: normalizeText(input.description),
      status: initialStatus === 'ACTIVE' ? 'DRAFT' : initialStatus,
      triggerDefinition,
      entryCriteria: input.entryCriteria ?? null,
      exitCriteria: input.exitCriteria ?? null,
      createdByUserId: input.actorUserId ?? null,
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);

    for (const [index, step] of (input.steps ?? []).entries()) {
      await this.repo.createAutomationStep({
        workspaceId: input.workspaceId,
        flowId: String(flow.id),
        key: normalizeSlug(step.key),
        name: normalizeText(step.name) ?? `Step ${index + 1}`,
        kind: step.kind,
        position: step.position ?? index,
        config: step.config ?? null,
        nextStepId: step.nextStepId ?? null
      } as unknown as Prisma.InputJsonValue);
    }

    const needsRuntimeSync = initialStatus === 'ACTIVE';
    if (!needsRuntimeSync) {
      return flow;
    }

    triggerDefinition = await this.syncAutomationRuntimeForFlow({
      workspaceId: input.workspaceId,
      flowId: String(flow.id),
      name,
      description: normalizeText(input.description),
      status: initialStatus,
      triggerDefinition,
      actorUserId: input.actorUserId ?? null,
      publish: initialStatus === 'ACTIVE'
    });

    return this.repo.updateAutomationFlow(String(flow.id), input.workspaceId, {
      status: initialStatus,
      triggerDefinition,
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);
  }

  public async updateAutomationFlow(input: {
    workspaceId: string;
    flowId: string;
    name?: string;
    description?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    triggerDefinition?: Record<string, unknown>;
    actorUserId: string | null;
  }) {
    const current = await this.repo.findAutomationFlowById(input.workspaceId, input.flowId);
    if (!current) {
      throw new AppError('Automation flow not found', 404);
    }

    const currentTriggerDefinition = isRecord(current.triggerDefinition) ? current.triggerDefinition : {};
    const currentStatus = readStringValue(current.status) as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | null;
    const nextStatus = input.status ?? currentStatus ?? 'DRAFT';
    const nextName = input.name !== undefined ? normalizeText(input.name) ?? '' : String(current.name ?? '');
    const nextDescription = input.description !== undefined
      ? normalizeText(input.description)
      : normalizeText(String(current.description ?? ''));
    let nextTriggerDefinition = input.triggerDefinition ?? currentTriggerDefinition;

    if (nextStatus === 'PAUSED' || nextStatus === 'ARCHIVED') {
      nextTriggerDefinition = await this.setMarketingRuntimeStatus({
        workspaceId: input.workspaceId,
        triggerDefinition: nextTriggerDefinition,
        status: mapMarketingFlowStatusToAutomationStatus(nextStatus)
      });
    } else if (nextStatus === 'ACTIVE') {
      nextTriggerDefinition = await this.syncAutomationRuntimeForFlow({
        workspaceId: input.workspaceId,
        flowId: input.flowId,
        name: nextName,
        description: nextDescription,
        status: nextStatus,
        triggerDefinition: nextTriggerDefinition,
        actorUserId: input.actorUserId ?? null,
        publish: nextStatus === 'ACTIVE'
      });
    }

    const patch: Record<string, unknown> = { updatedByUserId: input.actorUserId ?? null };
    if (input.name !== undefined) patch.name = nextName;
    if (input.description !== undefined) patch.description = nextDescription;
    if (input.status !== undefined) patch.status = nextStatus;
    if (input.triggerDefinition !== undefined || nextTriggerDefinition !== currentTriggerDefinition) {
      patch.triggerDefinition = nextTriggerDefinition;
    }
    return this.repo.updateAutomationFlow(input.flowId, input.workspaceId, patch as Prisma.InputJsonValue);
  }

  public async generateCampaignWithAI(input: {
    workspaceId: string;
    objective: string;
    tone?: string;
    targetStage?: string;
    segmentHint?: string;
    documentLimit?: number;
    actorUserId?: string | null;
  }) {
    const recentDocs = await this.repo.listWorkspaceDocuments(
      input.workspaceId,
      Math.max(1, Math.min(input.documentLimit ?? 6, 12))
    );

    const prompt = [
      `Objetivo da campanha: ${input.objective}`,
      `Tom desejado: ${input.tone ?? 'consultivo e premium'}`,
      `Estagio do funil: ${input.targetStage ?? 'MQL'}`,
      `Segmento sugerido: ${input.segmentHint ?? 'contatos comerciais com fit'}`,
      'Resumo de documentos do workspace:',
      ...recentDocs.map((doc, index) => `Documento ${index + 1}: ${doc.title}\n${doc.content.slice(0, 800)}`),
      'Retorne em JSON com os campos: campaignName, campaignDescription, hypothesis, persona, subjectA, subjectB, contentMarkdown, cta, segmentRules(array).'
    ].join('\n\n');

    const generated = await this.aiProvider.generateText({
      systemPrompt:
        'Voce e estrategista de marketing B2B para software houses. Gere campanhas conectadas ao ciclo sinal comercial -> WorkItem -> cliente -> faturamento. Responda em JSON valido.',
      userPrompt: prompt,
      temperature: 0.3,
      requireJsonOutput: true
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(generated.content) as Record<string, unknown>;
    } catch {
      parsed = {
        campaignName: 'Campanha orientada por contexto',
        campaignDescription: generated.content,
        hypothesis: 'Hipotese gerada pela IA',
        persona: 'Decisor tecnico/comercial',
        subjectA: 'Atualizacao relevante para o seu contexto',
        subjectB: 'Proximo passo recomendado para sua operacao',
        contentMarkdown: generated.content,
        cta: 'Responder este e-mail para avancarmos',
        segmentRules: []
      };
    }

    const created = await this.createCampaign({
      workspaceId: input.workspaceId,
      name: String(parsed.campaignName ?? 'Campanha orientada por contexto'),
      description: String(parsed.campaignDescription ?? ''),
      objective: this.normalizeObjective(input.objective),
      channel: 'EMAIL',
      hypothesis: String(parsed.hypothesis ?? ''),
      persona: String(parsed.persona ?? ''),
      variants: [
        {
          name: 'A',
          subject: String(parsed.subjectA ?? 'Atualizacao importante para sua operacao'),
          bodyMarkdown: String(parsed.contentMarkdown ?? ''),
          weight: 60,
          isControl: true
        },
        {
          name: 'B',
          subject: String(parsed.subjectB ?? 'Proximo passo sugerido para evoluir resultados'),
          bodyMarkdown: String(parsed.contentMarkdown ?? ''),
          weight: 40,
          isControl: false
        }
      ],
      actorUserId: input.actorUserId ?? null
    });

    await this.repo.updateCampaign(input.workspaceId, String(created.campaign.id), {
      aiGenerated: true,
      aiContext: {
        provider: generated.provider,
        model: generated.model,
        latencyMs: generated.latencyMs,
        usage: generated.usage,
        promptPreview: prompt.slice(0, 3000)
      }
    } as unknown as Prisma.InputJsonValue);

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: String(created.campaign.id),
      type: 'AI_GENERATED',
      headline: 'Campanha gerada com IA',
      description: 'A IA montou estrutura de campanha com base no contexto do workspace.',
      payload: {
        provider: generated.provider,
        model: generated.model,
        usage: generated.usage,
        requestedByUserId: input.actorUserId ?? null
      }
    });

    return this.getCampaignDetails(input.workspaceId, String(created.campaign.id));
  }

  public async improveVariantWithAI(input: {
    workspaceId: string;
    campaignId: string;
    variantId: string;
    objective?: string;
    tone?: string;
    actorUserId?: string | null;
  }) {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    const variant = details.variants.find((entry) => String(entry.id) === input.variantId);
    if (!variant) {
      throw new AppError('Variant not found', 404);
    }

    const originalSubject = String(variant.subject ?? '');
    const originalBody = String(variant.bodyMarkdown ?? '');

    const improved = await this.aiProvider.generateText({
      systemPrompt:
        'Voce e editor de marketing B2B premium. Melhore texto mantendo contexto operacional e clareza comercial. Retorne JSON com subject e bodyMarkdown.',
      userPrompt: [
        `Objetivo: ${input.objective ?? details.campaign.objective}`,
        `Tom: ${input.tone ?? 'consultivo'}`,
        `Assunto atual: ${originalSubject}`,
        `Conteudo atual:\n${originalBody}`
      ].join('\n\n'),
      temperature: 0.35,
      requireJsonOutput: true
    });

    let subject = originalSubject;
    let bodyMarkdown = originalBody;
    try {
      const parsed = JSON.parse(improved.content) as { subject?: string; bodyMarkdown?: string };
      subject = normalizeText(parsed.subject) ?? subject;
      bodyMarkdown = normalizeText(parsed.bodyMarkdown) ?? bodyMarkdown;
    } catch {
      bodyMarkdown = improved.content;
    }

    await this.repo.updateCampaignVariant(input.variantId, {
      subject,
      bodyMarkdown,
      aiGenerated: true,
      aiMetadata: {
        provider: improved.provider,
        model: improved.model,
        usage: improved.usage,
        latencyMs: improved.latencyMs,
        requestedByUserId: input.actorUserId ?? null
      },
      updatedByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      variantId: input.variantId,
      type: 'AI_IMPROVED',
      headline: 'Variante otimizada com IA',
      description: 'Conteudo ajustado para melhor performance no contexto atual.',
      payload: {
        provider: improved.provider,
        model: improved.model,
        usage: improved.usage,
        requestedByUserId: input.actorUserId ?? null
      }
    });

    return this.getCampaignDetails(input.workspaceId, input.campaignId);
  }

  private normalizeObjective(objective: string): string {
    const normalized = objective.trim().toUpperCase();

    if (
      [
        'COMMERCIAL_NURTURE',
        'ONBOARDING',
        'REACTIVATION',
        'BILLING_REMINDER',
        'RENEWAL',
        'EXPANSION',
        'PRODUCT_UPDATE',
        'NEWSLETTER',
        'CUSTOM'
      ].includes(normalized)
    ) {
      return normalized;
    }

    return 'CUSTOM';
  }

  private eventHeadline(eventType: string): string {
    if (eventType === 'EMAIL_DELIVERED') {
      return 'Entrega confirmada';
    }
    if (eventType === 'EMAIL_OPENED') {
      return 'E-mail aberto';
    }
    if (eventType === 'EMAIL_CLICKED') {
      return 'Clique registrado';
    }
    if (eventType === 'EMAIL_BOUNCED') {
      return 'Bounce identificado';
    }
    if (eventType === 'EMAIL_COMPLAINT') {
      return 'Complaint recebido';
    }
    if (eventType === 'EMAIL_UNSUBSCRIBED') {
      return 'Unsubscribe registrado';
    }

    return 'Evento de e-mail';
  }

  private assertCampaignCanBeSent(details: MarketingCampaignDetails): void {
    const variants = details.variants;
    const senderProfile = details.senderProfile;

    if (variants.length === 0) {
      throw new AppError('Campaign must have at least one variant', 422);
    }

    for (const variant of variants) {
      const subject = normalizeText(String(variant.subject ?? ''));
      const bodyMarkdown = normalizeText(String(variant.bodyMarkdown ?? ''));
      if (!subject || !bodyMarkdown) {
        throw new AppError('Every variant must define subject and content', 422);
      }
    }

    const fromEmail = normalizeText(String(senderProfile?.fromEmail ?? ''));
    if (!fromEmail) {
      throw new AppError('Sender profile is required before sending', 422);
    }
  }

  private async resolveSenderProfile(
    workspaceId: string,
    senderProfileId?: string | null
  ): Promise<Record<string, unknown> | null> {
    if (senderProfileId) {
      const profiles = await this.repo.listSenderProfiles(workspaceId);
      const selected = profiles.find((entry) => String(entry.id) === senderProfileId);
      if (!selected) {
        throw new AppError('Sender profile not found', 404);
      }
      return selected;
    }

    const currentDefault = await this.repo.findDefaultSenderProfile(workspaceId);
    if (currentDefault) {
      return currentDefault;
    }

    return this.repo.createSenderProfile({
      workspaceId,
      name: 'Sender padrao',
      fromName: 'Dask Marketing',
      fromEmail: 'noreply@dask.app',
      providerKey: this.emailProvider.key,
      isDefault: true,
      isVerified: false
    } as unknown as Prisma.InputJsonValue);
  }

  private async registerEvent(input: {
    workspaceId: string;
    campaignId?: string;
    variantId?: string;
    segmentId?: string;
    itemId?: string;
    sendId?: string;
    automationFlowId?: string;
    type: string;
    headline?: string;
    description?: string;
    payload?: Record<string, unknown>;
    occurredAt?: Date;
  }) {
    return this.repo.createMarketingEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId ?? null,
      variantId: input.variantId ?? null,
      segmentId: input.segmentId ?? null,
      itemId: input.itemId ?? null,
      sendId: input.sendId ?? null,
      automationFlowId: input.automationFlowId ?? null,
      type: input.type,
      headline: normalizeText(input.headline),
      description: normalizeText(input.description),
      payload: input.payload ?? null,
      occurredAt: input.occurredAt ?? new Date()
    } as unknown as Prisma.InputJsonValue);
  }

  private async applyWorkItemScoreFromEvent(input: {
    workspaceId: string;
    workItemId: string;
    campaignId: string;
    eventId: string;
    eventType: string;
    actorUserId?: string | null;
  }) {
    const delta = computeScoreDelta(input.eventType);
    if (delta === 0) {
      return;
    }

    const contacts = await this.repo.listAudienceContacts({
      workspaceId: input.workspaceId,
      limit: 1,
      search: input.workItemId
    });
    const currentContact = contacts.find((entry) => entry.contact.workItemId === input.workItemId)?.contact;

    let contact: MarketingCommercialContact | null = currentContact ?? null;
    if (!contact) {
      const segmentContacts = await this.repo.listContactsForSegment({
        workspaceId: input.workspaceId,
        filter: { logic: 'OR', rules: [{ field: 'score', operator: 'gte', value: 0 }] },
        limit: 5000
      });
      contact = segmentContacts.find((entry) => entry.workItemId === input.workItemId) ?? null;
    }

    if (!contact) {
      return;
    }

    const previousScore = contact.score;
    const nextScore = clampScore(previousScore + delta);
    await this.repo.updateWorkItemScore(input.workspaceId, input.workItemId, nextScore);

    await this.repo.createWorkItemActivity({
      workspaceId: input.workspaceId,
      workItemId: input.workItemId,
      actorUserId: input.actorUserId ?? null,
      type: 'NOTE',
      title: 'Score comercial atualizado',
      description: `Score alterado de ${previousScore} para ${nextScore} por ${input.eventType}.`,
      payload: {
        campaignId: input.campaignId,
        eventId: input.eventId,
        delta,
        previousScore,
        nextScore,
        eventType: input.eventType
      },
      occurredAt: new Date()
    });

    await this.registerEvent({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      itemId: input.workItemId,
      type: 'COMMERCIAL_SCORE_CHANGED',
      headline: 'Score comercial ajustado',
      description: `Score atualizado para ${nextScore}.`,
      payload: {
        previousScore,
        nextScore,
        delta,
        sourceEventType: input.eventType
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.MarketingCommercialWorkItemScoreChanged,
      aggregateType: 'item',
      aggregateId: input.workItemId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        itemId: input.workItemId,
        campaignId: input.campaignId,
        previousScore,
        nextScore,
        delta,
        sourceEventType: input.eventType
      }
    });
  }

  async listSignalsInbox(input: {
    workspaceId: string;
    types?: string[];
    includeDismissed?: boolean;
    limit?: number;
  }): Promise<{ items: SignalInboxItem[]; unreadCount: number }> {
    const items = await this.repo.listSignalsInbox({
      workspaceId: input.workspaceId,
      types: input.types,
      onlyWithWorkItem: true,
      includeDismissed: input.includeDismissed ?? false,
      limit: input.limit ?? 80
    });

    const unreadCount = items.filter((item) => item.seenAt === null).length;
    return { items, unreadCount };
  }

  async markSignal(input: { workspaceId: string; eventId: string; action: 'seen' | 'dismissed' }): Promise<void> {
    await this.repo.markSignal(input.workspaceId, input.eventId, input.action);
  }

  async createSignalFollowUp(input: {
    workspaceId: string;
    eventId: string;
    workItemId: string;
    title: string;
    description?: string;
    dueAt?: Date | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    createWorkItem?: boolean;
    boardId?: string;
    workflowStateId?: string;
    assigneeId?: string | null;
    actorUserId?: string | null;
  }): Promise<{
    signalId: string;
    activity: {
      id: string;
      title: string;
      description: string | null;
      occurredAt: Date;
    };
    workItem: {
      id: string;
      lastContactAt: Date | null;
      nextFollowUpAt: Date | null;
      status: string;
    } | null;
    sourceWorkItemId: string;
    createdFollowUpWorkItemId: string | null;
  }> {
    const signal = await this.repo.findMarketingEventById(input.workspaceId, input.eventId);
    if (!signal) {
      throw new AppError('Marketing signal not found', 404);
    }

    const signalWorkItemId = typeof signal.itemId === 'string' ? signal.itemId : null;
    if (!signalWorkItemId || signalWorkItemId !== input.workItemId) {
      throw new AppError('Signal is not linked to this commercial work item', 422);
    }

    const title = normalizeText(input.title);
    if (!title) {
      throw new AppError('Follow-up title is required', 422);
    }

    const description = normalizeText(input.description);
    const dueAt = input.dueAt ?? null;
    const occurredAt = new Date();
    const marketingEventType = typeof signal.type === 'string' ? signal.type : null;
    const priority = input.priority ?? 'medium';
    let createdFollowUpWorkItemId: string | null = null;

    if (input.createWorkItem) {
      if (!input.actorUserId) {
        throw new AppError('Authenticated user is required to create follow-up work item', 401);
      }
      if (!this.workspaceWorkItemsService) {
        throw new AppError('Work item service is not configured for marketing follow-ups', 500);
      }

      const workItem = await this.workspaceWorkItemsService.createWorkItem({
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        payload: {
          boardId: input.boardId,
          stateId: input.workflowStateId,
          title,
          description: description ?? undefined,
          assigneeId: input.assigneeId ?? null,
          dueDate: dueAt,
          fields: {
            source: 'marketing_signal',
            sourceWorkItemId: input.workItemId,
            marketingSignalId: input.eventId,
            priority
          },
          metadata: {
            source: 'marketing_signal',
            marketing: {
              signalId: input.eventId,
              sourceWorkItemId: input.workItemId,
              eventType: marketingEventType,
              priority,
              dueAt: dueAt?.toISOString() ?? null
            }
          }
        }
      });

      createdFollowUpWorkItemId = String(workItem.id);
    }

    const activity = await this.repo.createWorkItemActivity({
      workspaceId: input.workspaceId,
      workItemId: input.workItemId,
      actorUserId: input.actorUserId ?? null,
      type: 'FOLLOW_UP',
      title,
      description,
      payload: {
        origin: 'marketing_signal',
        signalId: input.eventId,
        createdFollowUpWorkItemId,
        marketingEventType,
        dueAt: dueAt?.toISOString() ?? null,
        priority
      },
      occurredAt
    });

    const updatedWorkItem = await this.repo.updateWorkItemFollowUp({
      workspaceId: input.workspaceId,
      workItemId: input.workItemId,
      nextFollowUpAt: dueAt,
      note: description,
      actorUserId: input.actorUserId ?? null
    });

    await this.repo.markSignal(input.workspaceId, input.eventId, 'seen');

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.CommercialWorkItemFollowUpRegistered,
      aggregateType: 'item',
      aggregateId: input.workItemId,
      occurredAt,
      payload: {
        workspaceId: input.workspaceId,
        itemId: input.workItemId,
        signalId: input.eventId,
        createdFollowUpWorkItemId,
        nextFollowUpAt: dueAt?.toISOString() ?? null,
        priority,
        requestedBy: input.actorUserId ?? null
      }
    });

    return {
      signalId: input.eventId,
      activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        occurredAt: activity.occurredAt
      },
      workItem: updatedWorkItem
        ? {
            id: updatedWorkItem.id,
            lastContactAt: updatedWorkItem.lastContactAt,
            nextFollowUpAt: updatedWorkItem.nextFollowUpAt,
            status: String(updatedWorkItem.status)
          }
        : null,
      sourceWorkItemId: input.workItemId,
      createdFollowUpWorkItemId
    };
  }
}
