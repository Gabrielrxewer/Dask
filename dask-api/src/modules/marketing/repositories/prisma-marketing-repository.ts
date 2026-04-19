import type { Lead, LeadActivity, LeadNurtureTouch, Prisma, PrismaClient } from '@prisma/client';
import type { SegmentFilter, SegmentRule } from '@/modules/marketing/domain/types';
import type {
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingDashboard,
  MarketingRepository
} from '@/modules/marketing/repositories/marketing-repository';

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function asLeadTags(lead: Lead): string[] {
  if (!Array.isArray(lead.tags)) {
    return [];
  }

  return lead.tags.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.toLowerCase());
}

function toStringArray(value: SegmentRule['value']): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).toLowerCase());
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [String(value).toLowerCase()];
}

function evaluateRule(lead: Lead, rule: SegmentRule, billingStatusByEmail: Map<string, string>): boolean {
  const operator = rule.operator;
  const value = rule.value;

  if (rule.field === 'origin') {
    const current = String(lead.captureSource ?? '').toLowerCase();
    const list = toStringArray(value);
    if (operator === 'in') {
      return list.includes(current);
    }
    if (operator === 'neq') {
      return current !== String(value ?? '').toLowerCase();
    }
    return current === String(value ?? '').toLowerCase();
  }

  if (rule.field === 'stage') {
    const current = String(lead.status ?? '').toLowerCase();
    const list = toStringArray(value);
    if (operator === 'in') {
      return list.includes(current);
    }
    if (operator === 'neq') {
      return current !== String(value ?? '').toLowerCase();
    }
    return current === String(value ?? '').toLowerCase();
  }

  if (rule.field === 'score') {
    const numeric = Number(value ?? 0);
    if (operator === 'gte') {
      return lead.score >= numeric;
    }
    if (operator === 'lte') {
      return lead.score <= numeric;
    }
    if (operator === 'neq') {
      return lead.score !== numeric;
    }
    return lead.score === numeric;
  }

  if (rule.field === 'tags') {
    const tags = asLeadTags(lead);
    const list = toStringArray(value);
    if (operator === 'contains') {
      return list.every((entry) => tags.includes(entry));
    }
    if (operator === 'in') {
      return list.some((entry) => tags.includes(entry));
    }
    return list.length > 0 ? tags.includes(list[0]) : false;
  }

  if (rule.field === 'inactive_days') {
    const days = Number(value ?? 0);
    if (!lead.lastContactAt) {
      return true;
    }

    const diffMs = Date.now() - lead.lastContactAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (operator === 'lte') {
      return diffDays <= days;
    }
    return diffDays >= days;
  }

  if (rule.field === 'billing_status') {
    const emailKey = lead.email?.toLowerCase() ?? '';
    const status = billingStatusByEmail.get(emailKey)?.toLowerCase() ?? 'unknown';
    const list = toStringArray(value);
    if (operator === 'in') {
      return list.includes(status);
    }
    if (operator === 'neq') {
      return status !== String(value ?? '').toLowerCase();
    }
    return status === String(value ?? '').toLowerCase();
  }

  if (rule.field === 'converted') {
    const converted = lead.status === 'CONVERTED';
    if (operator === 'is_false') {
      return !converted;
    }
    return converted;
  }

  return true;
}

function evaluateFilter(lead: Lead, filter: SegmentFilter, billingStatusByEmail: Map<string, string>): boolean {
  if (!filter.rules || filter.rules.length === 0) {
    return true;
  }

  if (filter.logic === 'OR') {
    return filter.rules.some((rule) => evaluateRule(lead, rule, billingStatusByEmail));
  }

  return filter.rules.every((rule) => evaluateRule(lead, rule, billingStatusByEmail));
}

export class PrismaMarketingRepository implements MarketingRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getDashboard(workspaceId: string): Promise<MarketingDashboard> {
    const db = this.prisma as any;

    const [
      activeCampaigns,
      scheduledCampaigns,
      automationsRunning,
      sendsQueuedToday,
      eventsByType,
      influencedLeads,
      influencedCustomers,
      influencedRevenue
    ] = await Promise.all([
      db.marketingCampaign.count({ where: { workspaceId, status: 'ACTIVE' } }),
      db.marketingCampaign.count({ where: { workspaceId, status: 'SCHEDULED' } }),
      db.marketingAutomationFlow.count({ where: { workspaceId, status: 'ACTIVE' } }),
      db.marketingCampaignSend.count({
        where: {
          workspaceId,
          status: 'QUEUED',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      db.marketingEvent.groupBy({
        by: ['type'],
        where: { workspaceId },
        _count: { _all: true }
      }),
      db.marketingAttribution.count({ where: { workspaceId, entityType: 'LEAD' } }),
      db.marketingAttribution.count({ where: { workspaceId, entityType: 'CUSTOMER' } }),
      db.marketingAttribution.aggregate({
        where: { workspaceId },
        _sum: { revenueInfluenced: true }
      })
    ]);

    const sent = eventsByType.find((entry: any) => entry.type === 'EMAIL_SENT')?._count?._all ?? 0;
    const opened = eventsByType.find((entry: any) => entry.type === 'EMAIL_OPENED')?._count?._all ?? 0;
    const clicked = eventsByType.find((entry: any) => entry.type === 'EMAIL_CLICKED')?._count?._all ?? 0;
    const converted =
      eventsByType.find((entry: any) => entry.type === 'CUSTOMER_CONVERTED')?._count?._all ??
      eventsByType.find((entry: any) => entry.type === 'OPPORTUNITY_INFLUENCED')?._count?._all ??
      0;

    return {
      activeCampaigns,
      scheduledCampaigns,
      openRate: sent > 0 ? Number((opened / sent).toFixed(4)) : 0,
      clickRate: opened > 0 ? Number((clicked / opened).toFixed(4)) : 0,
      conversionRate: clicked > 0 ? Number((converted / clicked).toFixed(4)) : 0,
      influencedLeads,
      influencedCustomers,
      influencedRevenue: Number(influencedRevenue._sum.revenueInfluenced ?? 0),
      automationsRunning,
      sendsQueuedToday
    };
  }

  public async listCampaigns(input: {
    workspaceId: string;
    status?: string;
    objective?: string;
    search?: string;
    limit: number;
  }): Promise<MarketingCampaignListItem[]> {
    const db = this.prisma as any;

    return db.marketingCampaign.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.objective ? { objective: input.objective } : {}),
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: 'insensitive' } },
                { description: { contains: input.search, mode: 'insensitive' } },
                { persona: { contains: input.search, mode: 'insensitive' } },
                { hypothesis: { contains: input.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: input.limit
    });
  }

  public async findCampaignById(workspaceId: string, campaignId: string): Promise<MarketingCampaignDetails | null> {
    const db = this.prisma as any;

    const campaign = await db.marketingCampaign.findFirst({
      where: {
        id: campaignId,
        workspaceId
      },
      include: {
        segment: true,
        template: true,
        senderProfile: true,
        variants: {
          orderBy: [{ isControl: 'desc' }, { createdAt: 'asc' }]
        },
        events: {
          orderBy: { occurredAt: 'desc' },
          take: 50
        },
        sends: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!campaign) {
      return null;
    }

    return {
      campaign,
      variants: campaign.variants,
      segment: campaign.segment,
      template: campaign.template,
      senderProfile: campaign.senderProfile,
      recentEvents: campaign.events,
      sends: campaign.sends
    };
  }

  public async createCampaign(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingCampaign.create({ data: asRecord(data) });
  }

  public async updateCampaign(workspaceId: string, campaignId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;

    await db.marketingCampaign.updateMany({
      where: {
        id: campaignId,
        workspaceId
      },
      data: asRecord(data)
    });

    return db.marketingCampaign.findUnique({ where: { id: campaignId } });
  }

  public async createCampaignVariant(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingCampaignVariant.create({ data: asRecord(data) });
  }

  public async updateCampaignVariant(variantId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingCampaignVariant.update({ where: { id: variantId }, data: asRecord(data) });
  }

  public async listSegments(workspaceId: string): Promise<Record<string, unknown>[]> {
    const db = this.prisma as any;
    return db.marketingAudienceSegment.findMany({
      where: { workspaceId },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  public async findSegmentById(workspaceId: string, segmentId: string): Promise<Record<string, unknown> | null> {
    const db = this.prisma as any;
    return db.marketingAudienceSegment.findFirst({ where: { id: segmentId, workspaceId } });
  }

  public async createSegment(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingAudienceSegment.create({ data: asRecord(data) });
  }

  public async updateSegment(workspaceId: string, segmentId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    await db.marketingAudienceSegment.updateMany({
      where: { id: segmentId, workspaceId },
      data: asRecord(data)
    });

    return db.marketingAudienceSegment.findUnique({ where: { id: segmentId } });
  }

  public async listTemplates(workspaceId: string): Promise<Record<string, unknown>[]> {
    const db = this.prisma as any;
    return db.marketingEmailTemplate.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  public async findTemplateById(workspaceId: string, templateId: string): Promise<Record<string, unknown> | null> {
    const db = this.prisma as any;
    return db.marketingEmailTemplate.findFirst({ where: { id: templateId, workspaceId } });
  }

  public async findTemplateBySlug(workspaceId: string, slug: string): Promise<Record<string, unknown> | null> {
    const db = this.prisma as any;
    return db.marketingEmailTemplate.findFirst({ where: { workspaceId, slug } });
  }

  public async createTemplate(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingEmailTemplate.create({ data: asRecord(data) });
  }

  public async updateTemplate(workspaceId: string, templateId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;

    await db.marketingEmailTemplate.updateMany({
      where: { id: templateId, workspaceId },
      data: asRecord(data)
    });

    return db.marketingEmailTemplate.findUnique({ where: { id: templateId } });
  }

  public async listSenderProfiles(workspaceId: string): Promise<Record<string, unknown>[]> {
    const db = this.prisma as any;

    return db.marketingSenderProfile.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: 'desc' }, { fromEmail: 'asc' }]
    });
  }

  public async findDefaultSenderProfile(workspaceId: string): Promise<Record<string, unknown> | null> {
    const db = this.prisma as any;

    return db.marketingSenderProfile.findFirst({
      where: { workspaceId, isDefault: true },
      orderBy: { updatedAt: 'desc' }
    });
  }

  public async createSenderProfile(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingSenderProfile.create({ data: asRecord(data) });
  }

  public async listAudienceContacts(input: {
    workspaceId: string;
    search?: string;
    status?: string;
    consentStatus?: string;
    limit: number;
  }): Promise<Array<{ lead: Lead; preference: Record<string, unknown> | null; lastEventAt: Date | null }>> {
    const db = this.prisma as any;

    const leads: Lead[] = await db.lead.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { fullName: { contains: input.search, mode: 'insensitive' } },
                { email: { contains: input.search, mode: 'insensitive' } },
                { companyName: { contains: input.search, mode: 'insensitive' } },
                { interest: { contains: input.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: input.limit
    });

    const leadIds = leads.map((lead) => lead.id);
    const emails = leads.map((lead) => lead.email).filter((entry): entry is string => Boolean(entry));

    const [preferences, latestEvents] = await Promise.all([
      db.marketingContactPreference.findMany({
        where: {
          workspaceId: input.workspaceId,
          messageKind: 'MARKETING',
          ...(input.consentStatus ? { consentStatus: input.consentStatus } : {}),
          OR: [{ leadId: { in: leadIds } }, { email: { in: emails } }]
        }
      }),
      db.marketingEvent.groupBy({
        by: ['leadId'],
        where: {
          workspaceId: input.workspaceId,
          leadId: { in: leadIds }
        },
        _max: {
          occurredAt: true
        }
      })
    ]);

    const preferenceByLead = new Map<string, Record<string, unknown>>();
    for (const preference of preferences) {
      if (typeof preference.leadId === 'string') {
        preferenceByLead.set(preference.leadId, preference);
      }
    }

    const eventByLead = new Map<string, Date>();
    for (const entry of latestEvents) {
      if (entry.leadId && entry._max.occurredAt) {
        eventByLead.set(entry.leadId, entry._max.occurredAt);
      }
    }

    return leads.map((lead) => ({
      lead,
      preference: preferenceByLead.get(lead.id) ?? null,
      lastEventAt: eventByLead.get(lead.id) ?? null
    }));
  }

  public async listLeadsForSegment(input: {
    workspaceId: string;
    filter: SegmentFilter;
    limit: number;
  }): Promise<Lead[]> {
    const db = this.prisma as any;

    const seedWhere: Record<string, unknown> = {
      workspaceId: input.workspaceId
    };

    for (const rule of input.filter.rules ?? []) {
      if (rule.field === 'stage' && (rule.operator === 'eq' || rule.operator === 'neq')) {
        if (rule.operator === 'eq') {
          seedWhere.status = String(rule.value);
        }
      }
      if (rule.field === 'score' && (rule.operator === 'gte' || rule.operator === 'lte')) {
        const numeric = Number(rule.value ?? 0);
        const current = (seedWhere.score as Record<string, number> | undefined) ?? {};
        if (rule.operator === 'gte') {
          current.gte = numeric;
        }
        if (rule.operator === 'lte') {
          current.lte = numeric;
        }
        seedWhere.score = current;
      }
    }

    const preselected: Lead[] = await db.lead.findMany({
      where: seedWhere,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(200, input.limit * 4)
    });

    const emails = preselected.map((entry) => entry.email).filter((entry): entry is string => Boolean(entry));
    const billingUsers = emails.length
      ? await db.user.findMany({
          where: {
            email: {
              in: emails
            }
          },
          select: {
            email: true,
            subscriptionStatus: true
          }
        })
      : [];

    const billingStatusByEmail = new Map<string, string>();
    for (const user of billingUsers) {
      billingStatusByEmail.set(String(user.email).toLowerCase(), String(user.subscriptionStatus ?? 'UNKNOWN'));
    }

    const filtered = preselected.filter((lead) => evaluateFilter(lead, input.filter, billingStatusByEmail));

    return filtered.slice(0, input.limit);
  }

  public async upsertContactPreference(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    const payload = asRecord(data);

    const workspaceId = String(payload.workspaceId);
    const messageKind = String(payload.messageKind ?? 'MARKETING');
    const leadId = typeof payload.leadId === 'string' ? payload.leadId : null;
    const email = String(payload.email);

    const existing = await db.marketingContactPreference.findFirst({
      where: {
        workspaceId,
        messageKind,
        OR: [{ leadId: leadId ?? undefined }, { email }]
      }
    });

    if (existing) {
      return db.marketingContactPreference.update({
        where: { id: existing.id },
        data: payload
      });
    }

    return db.marketingContactPreference.create({ data: payload });
  }

  public async createCampaignSend(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingCampaignSend.create({ data: asRecord(data) });
  }

  public async listCampaignSends(campaignId: string): Promise<Record<string, unknown>[]> {
    const db = this.prisma as any;
    return db.marketingCampaignSend.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' }
    });
  }

  public async findCampaignSendById(sendId: string): Promise<Record<string, unknown> | null> {
    const db = this.prisma as any;

    return db.marketingCampaignSend.findUnique({
      where: { id: sendId },
      include: {
        campaign: true,
        variant: true,
        senderProfile: true,
        lead: true
      }
    });
  }

  public async updateCampaignSend(sendId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingCampaignSend.update({ where: { id: sendId }, data: asRecord(data) });
  }

  public async findCampaignSendByProviderMessageId(
    workspaceId: string,
    providerMessageId: string
  ): Promise<Record<string, unknown> | null> {
    const db = this.prisma as any;

    return db.marketingCampaignSend.findFirst({
      where: {
        workspaceId,
        providerMessageId
      }
    });
  }

  public async createMarketingEvent(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingEvent.create({ data: asRecord(data) });
  }

  public async listCampaignAnalytics(campaignId: string): Promise<{
    byType: Array<{ type: string; total: number }>;
    byStatus: Array<{ status: string; total: number }>;
  }> {
    const db = this.prisma as any;

    const [eventsByType, sendsByStatus] = await Promise.all([
      db.marketingEvent.groupBy({
        by: ['type'],
        where: { campaignId },
        _count: { _all: true }
      }),
      db.marketingCampaignSend.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: { _all: true }
      })
    ]);

    return {
      byType: eventsByType.map((entry: any) => ({ type: String(entry.type), total: Number(entry._count._all ?? 0) })),
      byStatus: sendsByStatus.map((entry: any) => ({
        status: String(entry.status),
        total: Number(entry._count._all ?? 0)
      }))
    };
  }

  public async createLeadActivity(data: Prisma.LeadActivityUncheckedCreateInput): Promise<LeadActivity> {
    return this.prisma.leadActivity.create({ data });
  }

  public async createLeadNurtureTouch(data: Prisma.LeadNurtureTouchUncheckedCreateInput): Promise<LeadNurtureTouch> {
    return this.prisma.leadNurtureTouch.create({ data });
  }

  public async updateLeadScore(workspaceId: string, leadId: string, nextScore: number): Promise<Lead> {
    await this.prisma.lead.updateMany({
      where: {
        id: leadId,
        workspaceId
      },
      data: {
        score: nextScore,
        updatedAt: new Date()
      }
    });

    const updated = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!updated) {
      throw new Error('Lead not found after score update');
    }

    return updated;
  }

  public async createLeadScoreEvent(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingLeadScoreEvent.create({ data: asRecord(data) });
  }

  public async listWorkspaceDocuments(workspaceId: string, limit: number): Promise<Array<{ id: string; title: string; content: string }>> {
    const documents = await this.prisma.workspaceDocument.findMany({
      where: { workspaceId },
      select: {
        id: true,
        title: true,
        content: true
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });

    return documents;
  }

  public async listAutomationFlows(workspaceId: string): Promise<Record<string, unknown>[]> {
    const db = this.prisma as any;

    return db.marketingAutomationFlow.findMany({
      where: { workspaceId },
      include: {
        steps: {
          orderBy: { position: 'asc' }
        },
        enrollments: {
          orderBy: { startedAt: 'desc' },
          take: 30
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  public async createAutomationFlow(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingAutomationFlow.create({ data: asRecord(data) });
  }

  public async createAutomationStep(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingAutomationStep.create({ data: asRecord(data) });
  }

  public async createAutomationEnrollment(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.prisma as any;
    return db.marketingAutomationEnrollment.create({ data: asRecord(data) });
  }
}
