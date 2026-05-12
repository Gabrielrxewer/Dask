import type { Prisma } from '@prisma/client';
import type { MarketingCommercialContact, SegmentFilter } from '@/modules/marketing/domain/types';

export type MarketingDashboard = {
  activeCampaigns: number;
  scheduledCampaigns: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  influencedWorkItems: number;
  influencedCustomers: number;
  influencedRevenue: number;
  automationsRunning: number;
  sendsQueuedToday: number;
};

export type MarketingCampaignListItem = {
  id: string;
  workspaceId: string;
  name: string;
  objective: string;
  status: string;
  channel: string;
  scheduledAt: Date | null;
  launchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  segmentId: string | null;
  templateId: string | null;
  senderProfileId: string | null;
};

export type MarketingCampaignDetails = {
  campaign: Record<string, unknown>;
  variants: Record<string, unknown>[];
  segment: Record<string, unknown> | null;
  template: Record<string, unknown> | null;
  senderProfile: Record<string, unknown> | null;
  recentEvents: Record<string, unknown>[];
  sends: Record<string, unknown>[];
};

export interface MarketingRepository {
  getDashboard(workspaceId: string): Promise<MarketingDashboard>;
  listCampaigns(input: {
    workspaceId: string;
    status?: string;
    objective?: string;
    search?: string;
    limit: number;
  }): Promise<MarketingCampaignListItem[]>;
  findCampaignById(workspaceId: string, campaignId: string): Promise<MarketingCampaignDetails | null>;
  createCampaign(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  updateCampaign(workspaceId: string, campaignId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  createCampaignVariant(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  updateCampaignVariant(variantId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  listSegments(workspaceId: string): Promise<Record<string, unknown>[]>;
  findSegmentById(workspaceId: string, segmentId: string): Promise<Record<string, unknown> | null>;
  createSegment(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  updateSegment(workspaceId: string, segmentId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  listTemplates(workspaceId: string): Promise<Record<string, unknown>[]>;
  findTemplateById(workspaceId: string, templateId: string): Promise<Record<string, unknown> | null>;
  findTemplateBySlug(workspaceId: string, slug: string): Promise<Record<string, unknown> | null>;
  createTemplate(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  updateTemplate(workspaceId: string, templateId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  listSenderProfiles(workspaceId: string): Promise<Record<string, unknown>[]>;
  findDefaultSenderProfile(workspaceId: string): Promise<Record<string, unknown> | null>;
  createSenderProfile(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  listAudienceContacts(input: {
    workspaceId: string;
    search?: string;
    status?: string;
    consentStatus?: string;
    limit: number;
  }): Promise<Array<{ contact: MarketingCommercialContact; preference: Record<string, unknown> | null; lastEventAt: Date | null }>>;
  listContactsForSegment(input: {
    workspaceId: string;
    filter: SegmentFilter;
    limit: number;
  }): Promise<MarketingCommercialContact[]>;
  upsertContactPreference(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  createCampaignSend(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  listCampaignSends(campaignId: string): Promise<Record<string, unknown>[]>;
  findCampaignSendById(sendId: string): Promise<Record<string, unknown> | null>;
  updateCampaignSend(sendId: string, data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  findCampaignSendByProviderMessageId(workspaceId: string, providerMessageId: string): Promise<Record<string, unknown> | null>;
  createMarketingEvent(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  findMarketingEventById(workspaceId: string, eventId: string): Promise<Record<string, unknown> | null>;
  listCampaignAnalytics(campaignId: string): Promise<{
    byType: Array<{ type: string; total: number }>;
    byStatus: Array<{ status: string; total: number }>;
  }>;
  createWorkItemActivity(input: {
    workspaceId: string;
    workItemId: string;
    actorUserId?: string | null;
    type: string;
    title: string;
    description?: string | null;
    payload?: Record<string, unknown> | null;
    occurredAt?: Date;
  }): Promise<{ id: string; title: string; description: string | null; occurredAt: Date }>;
  updateWorkItemFollowUp(input: {
    workspaceId: string;
    workItemId: string;
    nextFollowUpAt?: Date | null;
    note?: string | null;
    actorUserId?: string | null;
  }): Promise<{ id: string; lastContactAt: Date | null; nextFollowUpAt: Date | null; status: string } | null>;
  updateWorkItemScore(workspaceId: string, workItemId: string, nextScore: number): Promise<MarketingCommercialContact>;
  listWorkspaceDocuments(workspaceId: string, limit: number): Promise<Array<{ id: string; title: string; content: string }>>;
  listAutomationFlows(workspaceId: string): Promise<Record<string, unknown>[]>;
  findAutomationFlowById(workspaceId: string, flowId: string): Promise<Record<string, unknown> | null>;
  createAutomationFlow(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  updateAutomationFlow(id: string, workspaceId: string, patch: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  createAutomationStep(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  createAutomationEnrollment(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
  listSignalsInbox(input: {
    workspaceId: string;
    types?: string[];
    onlyWithWorkItem?: boolean;
    includeDismissed?: boolean;
    limit: number;
  }): Promise<SignalInboxItem[]>;
  markSignal(workspaceId: string, eventId: string, action: 'seen' | 'dismissed'): Promise<void>;
}

export type SignalInboxItem = {
  id: string;
  type: string;
  headline: string | null;
  description: string | null;
  payload: Record<string, unknown> | null;
  occurredAt: Date;
  seenAt: Date | null;
  dismissedAt: Date | null;
  workItemId: string | null;
  campaignId: string | null;
  workItem: {
    id: string;
    title: string | null;
    contactName: string | null;
    email: string | null;
    companyName: string | null;
    customerId: string | null;
    score: number;
    status: string;
  } | null;
  campaign: {
    id: string;
    name: string;
    objective: string;
  } | null;
};
