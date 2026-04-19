import crypto from 'crypto';
import type { Lead, Prisma } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { JobQueue } from '@/core/jobs/job-queue';
import type { AIProvider } from '@/modules/ai/domain/providers';
import {
  chooseWeightedVariant,
  htmlToText,
  normalizeSlug,
  normalizeText,
  renderLeadVariables,
  toSegmentFilter,
  type SegmentFilter
} from '@/modules/marketing/domain/types';
import type { MarketingEmailProvider } from '@/modules/marketing/providers/marketing-email-provider';
import type {
  MarketingCampaignDetails,
  MarketingDashboard,
  MarketingRepository
} from '@/modules/marketing/repositories/marketing-repository';

interface MarketingServiceDeps {
  repo: MarketingRepository;
  eventPublisher: EventPublisher;
  jobQueue: JobQueue;
  aiProvider: AIProvider;
  emailProvider: MarketingEmailProvider;
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

export class MarketingService {
  private readonly repo: MarketingRepository;
  private readonly eventPublisher: EventPublisher;
  private readonly jobQueue: JobQueue;
  private readonly aiProvider: AIProvider;
  private readonly emailProvider: MarketingEmailProvider;

  public constructor(deps: MarketingServiceDeps) {
    this.repo = deps.repo;
    this.eventPublisher = deps.eventPublisher;
    this.jobQueue = deps.jobQueue;
    this.aiProvider = deps.aiProvider;
    this.emailProvider = deps.emailProvider;
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
    leadsEvaluated: number;
  }> {
    const details = await this.getCampaignDetails(input.workspaceId, input.campaignId);
    const campaign = details.campaign;

    if (!['APPROVED', 'SCHEDULED', 'ACTIVE'].includes(String(campaign.status))) {
      throw new AppError('Campaign must be approved before launch', 422);
    }

    this.assertCampaignCanBeSent(details);

    const segment = details.segment;
    const filter = toSegmentFilter((segment?.filters as unknown) ?? { logic: 'AND', rules: [] });
    const targetLeads = await this.repo.listLeadsForSegment({
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

    for (const lead of targetLeads) {
      const contactEmail = normalizeText(lead.email);
      if (!contactEmail) {
        skipped += 1;
        skippedWithoutEmail += 1;
        continue;
      }

      const preference = await this.repo.upsertContactPreference({
        workspaceId: input.workspaceId,
        leadId: lead.id,
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
      const renderedMarkdown = renderLeadVariables(variant.bodyMarkdown, lead);
      const renderedHtml = variant.bodyHtml
        ? renderLeadVariables(variant.bodyHtml, lead)
        : `<pre>${renderedMarkdown.replace(/[<>]/g, '')}</pre>`;
      const renderedSubject = renderLeadVariables(variant.subject, lead);

      const idempotencyKey = `mkt:${input.workspaceId}:${input.campaignId}:${lead.id}:${variant.id}`;

      if (!input.dryRun) {
        const send = await this.repo.createCampaignSend({
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          variantId: variant.id,
          leadId: lead.id,
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
            renderedText: htmlToText(renderedHtml)
          }
        } as unknown as Prisma.InputJsonValue);

        await this.registerEvent({
          workspaceId: input.workspaceId,
          campaignId: input.campaignId,
          variantId: variant.id,
          leadId: lead.id,
          sendId: String(send.id),
          type: 'SEND_QUEUED',
          headline: 'Envio enfileirado',
          description: `Envio preparado para ${contactEmail}.`,
          payload: {
            idempotencyKey,
            queuedByUserId: input.actorUserId ?? null
          }
        });

        await this.repo.createLeadActivity({
          workspaceId: input.workspaceId,
          leadId: lead.id,
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
      leadsEvaluated: targetLeads.length
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
        leadId: typeof send.leadId === 'string' ? send.leadId : undefined,
        sendId,
        type: 'EMAIL_SENT',
        headline: 'E-mail enviado',
        description: `E-mail enviado para ${String(send.contactEmail)}.`,
        payload: {
          providerKey: sent.providerKey,
          providerMessageId: sent.messageId
        }
      });

      if (typeof send.leadId === 'string') {
        await this.repo.createLeadNurtureTouch({
          workspaceId: String(send.workspaceId),
          leadId: send.leadId,
          status: 'SENT',
          channel: 'EMAIL_MARKETING',
          templateKey: typeof send.variantId === 'string' ? send.variantId : undefined,
          subject,
          message: text,
          sentAt: new Date(),
          metadata: {
            marketingCampaignId: String(send.campaignId),
            marketingSendId: sendId,
            providerMessageId: sent.messageId
          }
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
          leadId: typeof send.leadId === 'string' ? send.leadId : null,
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
        leadId: typeof send.leadId === 'string' ? send.leadId : undefined,
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
      leadId: typeof send.leadId === 'string' ? send.leadId : undefined,
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

    if (typeof send.leadId === 'string') {
      await this.applyLeadScoreFromEvent({
        workspaceId: input.workspaceId,
        leadId: send.leadId,
        campaignId: String(send.campaignId),
        eventId: String(event.id),
        eventType: input.eventType,
        actorUserId: null
      });

      if (input.eventType === 'EMAIL_UNSUBSCRIBED') {
        await this.repo.upsertContactPreference({
          workspaceId: input.workspaceId,
          leadId: send.leadId,
          email: String(send.contactEmail),
          messageKind: 'MARKETING',
          consentStatus: 'UNSUBSCRIBED',
          allowEmail: false,
          allowNewsletter: false,
          unsubscribeAt: input.occurredAt ?? new Date()
        } as unknown as Prisma.InputJsonValue);

        await this.repo.createLeadActivity({
          workspaceId: input.workspaceId,
          leadId: send.leadId,
          actorUserId: null,
          type: 'NOTE',
          title: 'Lead realizou unsubscribe',
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
    const leads = await this.repo.listLeadsForSegment({
      workspaceId: input.workspaceId,
      filter,
      limit: Math.max(1, Math.min(input.limit ?? 200, 500))
    });

    await this.repo.updateSegment(input.workspaceId, input.segmentId, {
      estimatedContacts: leads.length,
      lastEvaluatedAt: new Date()
    } as unknown as Prisma.InputJsonValue);

    return {
      segment,
      estimatedContacts: leads.length,
      sample: leads.slice(0, 30)
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

    const flow = await this.repo.createAutomationFlow({
      workspaceId: input.workspaceId,
      name,
      description: normalizeText(input.description),
      status: input.status ?? 'DRAFT',
      triggerDefinition: input.triggerDefinition,
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

    return flow;
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
      `Segmento sugerido: ${input.segmentHint ?? 'leads com fit'}`,
      'Resumo de documentos do workspace:',
      ...recentDocs.map((doc, index) => `Documento ${index + 1}: ${doc.title}\n${doc.content.slice(0, 800)}`),
      'Retorne em JSON com os campos: campaignName, campaignDescription, hypothesis, persona, subjectA, subjectB, contentMarkdown, cta, segmentRules(array).'
    ].join('\n\n');

    const generated = await this.aiProvider.generateText({
      systemPrompt:
        'Voce e estrategista de marketing B2B para software houses. Gere campanhas conectadas ao ciclo lead -> oportunidade -> cliente -> faturamento. Responda em JSON valido.',
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
        'LEAD_NURTURE',
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
    leadId?: string;
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
      leadId: input.leadId ?? null,
      sendId: input.sendId ?? null,
      automationFlowId: input.automationFlowId ?? null,
      type: input.type,
      headline: normalizeText(input.headline),
      description: normalizeText(input.description),
      payload: input.payload ?? null,
      occurredAt: input.occurredAt ?? new Date()
    } as unknown as Prisma.InputJsonValue);
  }

  private async applyLeadScoreFromEvent(input: {
    workspaceId: string;
    leadId: string;
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
      search: input.leadId
    });
    const currentLead = contacts.find((entry) => entry.lead.id === input.leadId)?.lead;

    let lead: Lead | null = currentLead ?? null;
    if (!lead) {
      const segmentLeads = await this.repo.listLeadsForSegment({
        workspaceId: input.workspaceId,
        filter: { logic: 'OR', rules: [{ field: 'score', operator: 'gte', value: 0 }] },
        limit: 5000
      });
      lead = segmentLeads.find((entry) => entry.id === input.leadId) ?? null;
    }

    if (!lead) {
      return;
    }

    const previousScore = lead.score;
    const nextScore = clampScore(previousScore + delta);
    await this.repo.updateLeadScore(input.workspaceId, input.leadId, nextScore);

    await this.repo.createLeadScoreEvent({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      campaignId: input.campaignId,
      eventId: input.eventId,
      delta,
      previousScore,
      nextScore,
      reason: `Score ajustado por evento ${input.eventType}.`,
      isAutomated: true,
      explanation: {
        eventType: input.eventType,
        rule: 'score_delta_by_event',
        formula: `${previousScore} ${delta >= 0 ? '+' : '-'} ${Math.abs(delta)} = ${nextScore}`
      },
      createdByUserId: input.actorUserId ?? null
    } as unknown as Prisma.InputJsonValue);

    await this.repo.createLeadActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.actorUserId ?? null,
      type: 'NOTE',
      title: 'Score de lead atualizado',
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
      leadId: input.leadId,
      type: 'LEAD_SCORE_CHANGED',
      headline: 'Lead score ajustado',
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
      name: DomainEventNames.MarketingLeadScoreChanged,
      aggregateType: 'lead',
      aggregateId: input.leadId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        campaignId: input.campaignId,
        previousScore,
        nextScore,
        delta,
        sourceEventType: input.eventType
      }
    });
  }
}
