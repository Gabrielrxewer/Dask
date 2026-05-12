import { Prisma, type PrismaClient } from '@prisma/client';
import type { MarketingCommercialContact, SegmentFilter, SegmentRule } from '@/modules/marketing/domain/types';
import type {
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingDashboard,
  MarketingRepository,
  SignalInboxItem
} from '@/modules/marketing/repositories/marketing-repository';

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function textField(fields: unknown, ...keys: string[]): string | null {
  if (!isRecord(fields)) {
    return null;
  }

  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function numberField(fields: unknown, key: string): number {
  if (!isRecord(fields)) {
    return 0;
  }
  const value = fields[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateField(fields: unknown, key: string): Date | null {
  if (!isRecord(fields)) {
    return null;
  }

  const value = fields[key];
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stringArrayField(fields: unknown, key: string): string[] {
  if (!isRecord(fields)) {
    return [];
  }

  const value = fields[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function mapCommercialWorkItemToContact(item: {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: string;
  fields: unknown;
  metadata: unknown;
  assigneeId: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MarketingCommercialContact {
  const fields = isRecord(item.fields) ? item.fields : {};
  const metadata = isRecord(item.metadata) ? item.metadata : {};
  const source = textField(fields, 'source', 'origin') ?? 'WORK_ITEM';
  const converted = fields.converted === true || typeof fields.customerId === 'string';
  const fullName = textField(fields, 'contactName', 'clientName') ?? item.title;

  return {
    id: item.id,
    workspaceId: item.workspaceId,
    workItemId: item.id,
    customerId: textField(fields, 'customerId'),
    captureSource: source,
    status: converted ? 'CONVERTED' : item.status,
    score: numberField(fields, 'score'),
    temperature: textField(fields, 'temperature'),
    firstName: textField(fields, 'firstName') ?? fullName.split(' ')[0] ?? null,
    fullName,
    email: textField(fields, 'contactEmail', 'email'),
    phone: textField(fields, 'contactPhone', 'phone'),
    companyName: textField(fields, 'companyName', 'clientName'),
    jobTitle: textField(fields, 'jobTitle'),
    website: textField(fields, 'website'),
    city: textField(fields, 'city'),
    state: textField(fields, 'state'),
    country: textField(fields, 'country'),
    interest: textField(fields, 'interest'),
    notes: item.description,
    tags: stringArrayField(fields, 'tags'),
    ownerUserId: item.assigneeId,
    lastContactAt: dateField(fields, 'lastContactAt'),
    nextFollowUpAt: dateField(fields, 'nextFollowUpAt'),
    metadata: {
      ...metadata,
      sourceEntityType: 'work_item',
      sourceWorkItemId: item.id,
      workItemStatus: item.status
    },
    createdByUserId: item.createdBy,
    updatedByUserId: item.updatedBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function asContactTags(contact: MarketingCommercialContact): string[] {
  return contact.tags.map((entry) => entry.toLowerCase());
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

function evaluateRule(contact: MarketingCommercialContact, rule: SegmentRule, billingStatusByEmail: Map<string, string>): boolean {
  const operator = rule.operator;
  const value = rule.value;

  if (rule.field === 'origin') {
    const current = String(contact.captureSource ?? '').toLowerCase();
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
    const current = String(contact.status ?? '').toLowerCase();
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
      return contact.score >= numeric;
    }
    if (operator === 'lte') {
      return contact.score <= numeric;
    }
    if (operator === 'neq') {
      return contact.score !== numeric;
    }
    return contact.score === numeric;
  }

  if (rule.field === 'tags') {
    const tags = asContactTags(contact);
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
    if (!contact.lastContactAt) {
      return true;
    }

    const diffMs = Date.now() - contact.lastContactAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (operator === 'lte') {
      return diffDays <= days;
    }
    return diffDays >= days;
  }

  if (rule.field === 'billing_status') {
    const emailKey = contact.email?.toLowerCase() ?? '';
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
    const converted = contact.status === 'CONVERTED';
    if (operator === 'is_false') {
      return !converted;
    }
    return converted;
  }

  return true;
}

function evaluateFilter(contact: MarketingCommercialContact, filter: SegmentFilter, billingStatusByEmail: Map<string, string>): boolean {
  if (!filter.rules || filter.rules.length === 0) {
    return true;
  }

  if (filter.logic === 'OR') {
    return filter.rules.some((rule) => evaluateRule(contact, rule, billingStatusByEmail));
  }

  return filter.rules.every((rule) => evaluateRule(contact, rule, billingStatusByEmail));
}

type DbRecord = Record<string, unknown>;
type GroupByCountRow = {
  type?: string | null;
  status?: string | null;
  itemId?: string | null;
  _count: {
    _all?: number | null;
  };
  _max: {
    occurredAt?: Date | null;
  };
};
type AggregateRevenueResult = {
  _sum: {
    revenueInfluenced?: number | null;
  };
};
type MarketingCampaignDetailsRecord = DbRecord & {
  variants: DbRecord[];
  segment: DbRecord | null;
  template: DbRecord | null;
  senderProfile: DbRecord | null;
  events: DbRecord[];
  sends: DbRecord[];
};
type MarketingRepositoryDb = PrismaClient & {
  marketingCampaign: {
    count(args: DbRecord): Promise<number>;
    findMany(args: DbRecord): Promise<MarketingCampaignListItem[]>;
    findFirst(args: DbRecord): Promise<MarketingCampaignDetailsRecord | null>;
    create(args: DbRecord): Promise<DbRecord>;
    updateMany(args: DbRecord): Promise<{ count: number }>;
    findUnique(args: DbRecord): Promise<DbRecord | null>;
  };
  marketingAutomationFlow: {
    count(args: DbRecord): Promise<number>;
    findMany(args: DbRecord): Promise<DbRecord[]>;
    create(args: DbRecord): Promise<DbRecord>;
    update(args: DbRecord): Promise<DbRecord>;
    findUnique(args: DbRecord): Promise<DbRecord | null>;
  };
  marketingCampaignSend: {
    count(args: DbRecord): Promise<number>;
    create(args: DbRecord): Promise<DbRecord>;
    findMany(args: DbRecord): Promise<DbRecord[]>;
    findUnique(args: DbRecord): Promise<DbRecord | null>;
    update(args: DbRecord): Promise<DbRecord>;
    findFirst(args: DbRecord): Promise<DbRecord | null>;
    groupBy(args: DbRecord): Promise<GroupByCountRow[]>;
  };
  marketingEvent: {
    groupBy(args: DbRecord): Promise<GroupByCountRow[]>;
    create(args: DbRecord): Promise<DbRecord>;
  };
  marketingAttribution: {
    count(args: DbRecord): Promise<number>;
    aggregate(args: DbRecord): Promise<AggregateRevenueResult>;
  };
  marketingCampaignVariant: {
    create(args: DbRecord): Promise<DbRecord>;
    update(args: DbRecord): Promise<DbRecord>;
  };
  marketingAudienceSegment: {
    findMany(args: DbRecord): Promise<DbRecord[]>;
    findFirst(args: DbRecord): Promise<DbRecord | null>;
    create(args: DbRecord): Promise<DbRecord>;
    updateMany(args: DbRecord): Promise<{ count: number }>;
    findUnique(args: DbRecord): Promise<DbRecord | null>;
  };
  marketingEmailTemplate: {
    findMany(args: DbRecord): Promise<DbRecord[]>;
    findFirst(args: DbRecord): Promise<DbRecord | null>;
    create(args: DbRecord): Promise<DbRecord>;
    updateMany(args: DbRecord): Promise<{ count: number }>;
    findUnique(args: DbRecord): Promise<DbRecord | null>;
  };
  marketingSenderProfile: {
    findMany(args: DbRecord): Promise<DbRecord[]>;
    findFirst(args: DbRecord): Promise<DbRecord | null>;
    create(args: DbRecord): Promise<DbRecord>;
  };
  marketingContactPreference: {
    findMany(args: DbRecord): Promise<DbRecord[]>;
    findFirst(args: DbRecord): Promise<DbRecord | null>;
    update(args: DbRecord): Promise<DbRecord>;
    create(args: DbRecord): Promise<DbRecord>;
  };
  marketingAutomationStep: {
    create(args: DbRecord): Promise<DbRecord>;
  };
  marketingAutomationEnrollment: {
    create(args: DbRecord): Promise<DbRecord>;
  };
};

export class PrismaMarketingRepository implements MarketingRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  private get db(): MarketingRepositoryDb {
    return this.prisma as unknown as MarketingRepositoryDb;
  }

  public async getDashboard(workspaceId: string): Promise<MarketingDashboard> {
    const db = this.db;

    const [
      activeCampaigns,
      scheduledCampaigns,
      automationsRunning,
      sendsQueuedToday,
      eventsByType,
      influencedWorkItems,
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
      db.marketingAttribution.count({ where: { workspaceId, entityType: 'WORK_ITEM' } }),
      db.marketingAttribution.count({ where: { workspaceId, entityType: 'CUSTOMER' } }),
      db.marketingAttribution.aggregate({
        where: { workspaceId },
        _sum: { revenueInfluenced: true }
      })
    ]);

    const sent = eventsByType.find((entry) => entry.type === 'EMAIL_SENT')?._count?._all ?? 0;
    const opened = eventsByType.find((entry) => entry.type === 'EMAIL_OPENED')?._count?._all ?? 0;
    const clicked = eventsByType.find((entry) => entry.type === 'EMAIL_CLICKED')?._count?._all ?? 0;
    const converted =
      eventsByType.find((entry) => entry.type === 'CUSTOMER_CONVERTED')?._count?._all ??
      eventsByType.find((entry) => entry.type === 'OPPORTUNITY_INFLUENCED')?._count?._all ??
      0;

    return {
      activeCampaigns,
      scheduledCampaigns,
      openRate: sent > 0 ? Number((opened / sent).toFixed(4)) : 0,
      clickRate: opened > 0 ? Number((clicked / opened).toFixed(4)) : 0,
      conversionRate: clicked > 0 ? Number((converted / clicked).toFixed(4)) : 0,
      influencedWorkItems,
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
    const db = this.db;

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
    const db = this.db;

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
    const db = this.db;
    return db.marketingCampaign.create({ data: asRecord(data) });
  }

  public async updateCampaign(workspaceId: string, campaignId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;

    await db.marketingCampaign.updateMany({
      where: {
        id: campaignId,
        workspaceId
      },
      data: asRecord(data)
    });

    const campaign = await db.marketingCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      throw new Error('Campaign not found after update');
    }

    return campaign;
  }

  public async createCampaignVariant(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingCampaignVariant.create({ data: asRecord(data) });
  }

  public async updateCampaignVariant(variantId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingCampaignVariant.update({ where: { id: variantId }, data: asRecord(data) });
  }

  public async listSegments(workspaceId: string): Promise<Record<string, unknown>[]> {
    const db = this.db;
    return db.marketingAudienceSegment.findMany({
      where: { workspaceId },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  public async findSegmentById(workspaceId: string, segmentId: string): Promise<Record<string, unknown> | null> {
    const db = this.db;
    return db.marketingAudienceSegment.findFirst({ where: { id: segmentId, workspaceId } });
  }

  public async createSegment(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingAudienceSegment.create({ data: asRecord(data) });
  }

  public async updateSegment(workspaceId: string, segmentId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    await db.marketingAudienceSegment.updateMany({
      where: { id: segmentId, workspaceId },
      data: asRecord(data)
    });

    const segment = await db.marketingAudienceSegment.findUnique({ where: { id: segmentId } });
    if (!segment) {
      throw new Error('Segment not found after update');
    }

    return segment;
  }

  public async listTemplates(workspaceId: string): Promise<Record<string, unknown>[]> {
    const db = this.db;
    return db.marketingEmailTemplate.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: [{ isSystem: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  public async findTemplateById(workspaceId: string, templateId: string): Promise<Record<string, unknown> | null> {
    const db = this.db;
    return db.marketingEmailTemplate.findFirst({ where: { id: templateId, workspaceId } });
  }

  public async findTemplateBySlug(workspaceId: string, slug: string): Promise<Record<string, unknown> | null> {
    const db = this.db;
    return db.marketingEmailTemplate.findFirst({ where: { workspaceId, slug } });
  }

  public async createTemplate(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingEmailTemplate.create({ data: asRecord(data) });
  }

  public async updateTemplate(workspaceId: string, templateId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;

    await db.marketingEmailTemplate.updateMany({
      where: { id: templateId, workspaceId },
      data: asRecord(data)
    });

    const template = await db.marketingEmailTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      throw new Error('Template not found after update');
    }

    return template;
  }

  public async listSenderProfiles(workspaceId: string): Promise<Record<string, unknown>[]> {
    const db = this.db;

    return db.marketingSenderProfile.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: 'desc' }, { fromEmail: 'asc' }]
    });
  }

  public async findDefaultSenderProfile(workspaceId: string): Promise<Record<string, unknown> | null> {
    const db = this.db;

    return db.marketingSenderProfile.findFirst({
      where: { workspaceId, isDefault: true },
      orderBy: { updatedAt: 'desc' }
    });
  }

  public async createSenderProfile(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingSenderProfile.create({ data: asRecord(data) });
  }

  public async listAudienceContacts(input: {
    workspaceId: string;
    search?: string;
    status?: string;
    consentStatus?: string;
    limit: number;
  }): Promise<Array<{ contact: MarketingCommercialContact; preference: Record<string, unknown> | null; lastEventAt: Date | null }>> {
    const db = this.db;

    const workItemWhere: Prisma.ItemWhereInput = {
      workspaceId: input.workspaceId,
      type: { in: ['commercial', 'signal', 'prospect'] },
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { id: input.search },
              { title: { contains: input.search, mode: 'insensitive' } },
              { description: { contains: input.search, mode: 'insensitive' } },
              { fields: { path: ['contactEmail'], string_contains: input.search } },
              { fields: { path: ['companyName'], string_contains: input.search } },
              { fields: { path: ['interest'], string_contains: input.search } }
            ]
          }
        : {})
    };

    const workItems = await db.item.findMany({
      where: workItemWhere,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: input.limit
    });
    const contacts = workItems.map(mapCommercialWorkItemToContact);

    const itemIds = contacts.map((contact) => contact.id);
    const emails = contacts.map((contact) => contact.email).filter((entry): entry is string => Boolean(entry));

    const [preferences, latestEvents] = await Promise.all([
      db.marketingContactPreference.findMany({
        where: {
          workspaceId: input.workspaceId,
          messageKind: 'MARKETING',
          ...(input.consentStatus ? { consentStatus: input.consentStatus } : {}),
          email: { in: emails }
        }
      }),
      db.marketingEvent.groupBy({
        by: ['itemId'],
        where: {
          workspaceId: input.workspaceId,
          itemId: { in: itemIds }
        },
        _max: {
          occurredAt: true
        }
      })
    ]);

    const preferenceByEmail = new Map<string, Record<string, unknown>>();
    for (const preference of preferences) {
      if (typeof preference.email === 'string') {
        preferenceByEmail.set(preference.email.toLowerCase(), preference);
      }
    }

    const eventByItem = new Map<string, Date>();
    for (const entry of latestEvents) {
      if (entry.itemId && entry._max.occurredAt) {
        eventByItem.set(entry.itemId, entry._max.occurredAt);
      }
    }

    return contacts.map((contact) => ({
      contact,
      preference: contact.email ? preferenceByEmail.get(contact.email.toLowerCase()) ?? null : null,
      lastEventAt: eventByItem.get(contact.id) ?? null
    }));
  }

  public async listContactsForSegment(input: {
    workspaceId: string;
    filter: SegmentFilter;
    limit: number;
  }): Promise<MarketingCommercialContact[]> {
    const db = this.db;

    const seedWhere: Prisma.ItemWhereInput = {
      workspaceId: input.workspaceId,
      type: { in: ['commercial', 'signal', 'prospect'] }
    };

    for (const rule of input.filter.rules ?? []) {
      if (rule.field === 'stage' && (rule.operator === 'eq' || rule.operator === 'neq')) {
        if (rule.operator === 'eq') {
          seedWhere.status = String(rule.value);
        }
      }
    }

    const preselectedItems = await db.item.findMany({
      where: seedWhere,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(200, input.limit * 4)
    });
    const preselected = preselectedItems.map(mapCommercialWorkItemToContact);

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

    const filtered = preselected.filter((contact) => evaluateFilter(contact, input.filter, billingStatusByEmail));

    return filtered.slice(0, input.limit);
  }

  public async upsertContactPreference(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    const payload = asRecord(data);

    const workspaceId = String(payload.workspaceId);
    const messageKind = String(payload.messageKind ?? 'MARKETING');
    const email = String(payload.email);

    const existing = await db.marketingContactPreference.findFirst({
      where: {
        workspaceId,
        messageKind,
        email
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
    const db = this.db;
    return db.marketingCampaignSend.create({ data: asRecord(data) });
  }

  public async listCampaignSends(campaignId: string): Promise<Record<string, unknown>[]> {
    const db = this.db;
    return db.marketingCampaignSend.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' }
    });
  }

  public async findCampaignSendById(sendId: string): Promise<Record<string, unknown> | null> {
    const db = this.db;

    return db.marketingCampaignSend.findUnique({
      where: { id: sendId },
      include: {
        campaign: true,
        variant: true,
        senderProfile: true
      }
    });
  }

  public async updateCampaignSend(sendId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingCampaignSend.update({ where: { id: sendId }, data: asRecord(data) });
  }

  public async findCampaignSendByProviderMessageId(
    workspaceId: string,
    providerMessageId: string
  ): Promise<Record<string, unknown> | null> {
    const db = this.db;

    return db.marketingCampaignSend.findFirst({
      where: {
        workspaceId,
        providerMessageId
      }
    });
  }

  public async createMarketingEvent(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingEvent.create({ data: asRecord(data) });
  }

  public async findMarketingEventById(workspaceId: string, eventId: string): Promise<Record<string, unknown> | null> {
    return this.db.marketingEvent.findFirst({
      where: {
        id: eventId,
        workspaceId
      }
    });
  }

  public async listCampaignAnalytics(campaignId: string): Promise<{
    byType: Array<{ type: string; total: number }>;
    byStatus: Array<{ status: string; total: number }>;
  }> {
    const db = this.db;

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
      byType: eventsByType.map((entry) => ({ type: String(entry.type), total: Number(entry._count._all ?? 0) })),
      byStatus: sendsByStatus.map((entry) => ({
        status: String(entry.status),
        total: Number(entry._count._all ?? 0)
      }))
    };
  }

  public async createWorkItemActivity(input: {
    workspaceId: string;
    workItemId: string;
    actorUserId?: string | null;
    type: string;
    title: string;
    description?: string | null;
    payload?: Record<string, unknown> | null;
    occurredAt?: Date;
  }): Promise<{ id: string; title: string; description: string | null; occurredAt: Date }> {
    const item = await this.prisma.item.findFirst({
      where: {
        id: input.workItemId,
        workspaceId: input.workspaceId
      },
      select: { id: true }
    });

    if (!item) {
      throw new Error('Work item not found for marketing activity');
    }

    const occurredAt = input.occurredAt ?? new Date();
    const history = await this.prisma.itemHistory.create({
      data: {
        itemId: input.workItemId,
        eventName: `marketing.${input.type.toLowerCase()}`,
        payload: {
          title: input.title,
          description: input.description ?? null,
          actorUserId: input.actorUserId ?? null,
          occurredAt: occurredAt.toISOString(),
          ...(input.payload ?? {})
        } as Prisma.InputJsonValue
      }
    });

    return {
      id: history.id,
      title: input.title,
      description: input.description ?? null,
      occurredAt
    };
  }

  public async updateWorkItemFollowUp(input: {
    workspaceId: string;
    workItemId: string;
    nextFollowUpAt?: Date | null;
    note?: string | null;
    actorUserId?: string | null;
  }): Promise<{ id: string; lastContactAt: Date | null; nextFollowUpAt: Date | null; status: string } | null> {
    const item = await this.prisma.item.findFirst({
      where: {
        id: input.workItemId,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        status: true,
        fields: true
      }
    });

    if (!item) {
      return null;
    }

    const lastContactAt = new Date();
    const nextFollowUpAt = input.nextFollowUpAt ?? null;
    const fields = isRecord(item.fields) ? item.fields : {};

    await this.prisma.item.update({
      where: { id: item.id },
      data: {
        fields: {
          ...fields,
          lastContactAt: lastContactAt.toISOString(),
          nextFollowUpAt: nextFollowUpAt ? nextFollowUpAt.toISOString() : null,
          marketingFollowUpNote: input.note ?? fields.marketingFollowUpNote ?? null
        } as Prisma.InputJsonValue,
        updatedBy: input.actorUserId ?? undefined
      }
    });

    return {
      id: item.id,
      lastContactAt,
      nextFollowUpAt,
      status: item.status
    };
  }

  public async updateWorkItemScore(workspaceId: string, workItemId: string, nextScore: number): Promise<MarketingCommercialContact> {
    const current = await this.prisma.item.findFirst({
      where: {
        id: workItemId,
        workspaceId
      }
    });

    if (!current) {
      throw new Error('Work item not found after score update');
    }

    const fields = isRecord(current.fields) ? current.fields : {};
    const updated = await this.prisma.item.update({
      where: { id: current.id },
      data: {
        fields: {
          ...fields,
          score: nextScore
        } as Prisma.InputJsonValue
      }
    });

    return mapCommercialWorkItemToContact(updated);
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
    const db = this.db;

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

  public async findAutomationFlowById(workspaceId: string, flowId: string): Promise<Record<string, unknown> | null> {
    const db = this.db;

    return db.marketingAutomationFlow.findFirst({
      where: { id: flowId, workspaceId },
      include: {
        steps: {
          orderBy: { position: 'asc' }
        },
        enrollments: {
          orderBy: { startedAt: 'desc' },
          take: 30
        }
      }
    });
  }

  public async createAutomationFlow(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingAutomationFlow.create({ data: asRecord(data) });
  }

  public async updateAutomationFlow(id: string, workspaceId: string, patch: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingAutomationFlow.update({
      where: { id, workspaceId } as DbRecord,
      data: asRecord(patch as Record<string, unknown>)
    });
  }

  public async createAutomationStep(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingAutomationStep.create({ data: asRecord(data) });
  }

  public async createAutomationEnrollment(data: Prisma.InputJsonValue): Promise<Record<string, unknown>> {
    const db = this.db;
    return db.marketingAutomationEnrollment.create({ data: asRecord(data) });
  }

  public async listSignalsInbox(input: {
    workspaceId: string;
    types?: string[];
    onlyWithWorkItem?: boolean;
    includeDismissed?: boolean;
    limit: number;
  }): Promise<SignalInboxItem[]> {
    const db = this.db;

    const INBOX_TYPES = input.types && input.types.length > 0 ? input.types : [
      'EMAIL_CLICKED',
      'EMAIL_OPENED',
      'EMAIL_BOUNCED',
      'EMAIL_COMPLAINT',
      'EMAIL_UNSUBSCRIBED',
      'COMMERCIAL_SCORE_CHANGED'
    ];

    const onlyWithWorkItem = input.onlyWithWorkItem ? Prisma.sql`AND e."itemId" IS NOT NULL` : Prisma.empty;
    const includeDismissed = input.includeDismissed ? Prisma.empty : Prisma.sql`AND e."dismissedAt" IS NULL`;

    type RawSignalInboxItem = {
      id: string;
      type: string;
      headline: string | null;
      description: string | null;
      payload: Record<string, unknown> | null;
      occurredAt: Date;
      seenAt: Date | null;
      dismissedAt: Date | null;
      itemId: string | null;
      campaignId: string | null;
      item_id: string | null;
      item_title: string | null;
      item_status: string | null;
      item_fields: Record<string, unknown> | null;
      campaign_id: string | null;
      campaign_name: string | null;
      campaign_objective: string | null;
    };

    const events = await db.$queryRaw<RawSignalInboxItem[]>(Prisma.sql`
      SELECT
        e."id",
        e."type"::text AS "type",
        e."headline",
        e."description",
        e."payload",
        e."occurredAt",
        e."seenAt",
        e."dismissedAt",
        e."itemId",
        e."campaignId",
        i."id" AS "item_id",
        i."title" AS "item_title",
        i."status" AS "item_status",
        i."fields" AS "item_fields",
        c."id" AS "campaign_id",
        c."name" AS "campaign_name",
        c."objective"::text AS "campaign_objective"
      FROM "MarketingEvent" e
      LEFT JOIN "Item" i ON i."id" = e."itemId"
      LEFT JOIN "MarketingCampaign" c ON c."id" = e."campaignId"
      WHERE e."workspaceId" = ${input.workspaceId}
        AND e."type"::text IN (${Prisma.join(INBOX_TYPES)})
        ${onlyWithWorkItem}
        ${includeDismissed}
      ORDER BY e."occurredAt" DESC
      LIMIT ${input.limit}
    `);

    return events.map((event) => ({
      id: event.id,
      type: event.type,
      headline: event.headline,
      description: event.description,
      payload: event.payload,
      occurredAt: event.occurredAt,
      seenAt: event.seenAt,
      dismissedAt: event.dismissedAt,
      workItemId: event.itemId,
      campaignId: event.campaignId,
      workItem: event.item_id
        ? {
            id: event.item_id,
            title: event.item_title,
            contactName: textField(event.item_fields, 'contactName', 'clientName') ?? event.item_title,
            email: textField(event.item_fields, 'contactEmail', 'email'),
            companyName: textField(event.item_fields, 'companyName', 'clientName'),
            customerId: textField(event.item_fields, 'customerId'),
            score: numberField(event.item_fields, 'score'),
            status: String(event.item_status)
          }
        : null,
      campaign: event.campaign_id
        ? {
            id: event.campaign_id,
            name: String(event.campaign_name),
            objective: String(event.campaign_objective)
          }
        : null
    }));
  }

  public async markSignal(workspaceId: string, eventId: string, action: 'seen' | 'dismissed'): Promise<void> {
    const column = action === 'seen' ? Prisma.sql`"seenAt"` : Prisma.sql`"dismissedAt"`;
    await this.db.$executeRaw(Prisma.sql`
      UPDATE "MarketingEvent"
      SET ${column} = ${new Date()}
      WHERE "id" = ${eventId}
        AND "workspaceId" = ${workspaceId}
    `);
  }

}


