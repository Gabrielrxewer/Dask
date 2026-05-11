import type { Lead, LeadActivity, LeadNurtureTouch, Prisma } from '@prisma/client';
import type { SegmentFilter } from '@/modules/marketing/domain/types';

export type MarketingDashboard = {
  activeCampaigns: number;
  scheduledCampaigns: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  influencedLeads: number;
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
  }): Promise<Array<{ lead: Lead; preference: Record<string, unknown> | null; lastEventAt: Date | null }>>;
  listLeadsForSegment(input: {
    workspaceId: string;
    filter: SegmentFilter;
    limit: number;
  }): Promise<Lead[]>;
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
  createLeadActivity(data: Prisma.LeadActivityUncheckedCreateInput): Promise<LeadActivity>;
  updateLeadFollowUp(input: {
    workspaceId: string;
    leadId: string;
    nextFollowUpAt?: Date | null;
    note?: string | null;
    actorUserId?: string | null;
  }): Promise<Lead | null>;
  createLeadNurtureTouch(data: Prisma.LeadNurtureTouchUncheckedCreateInput): Promise<LeadNurtureTouch>;
  updateLeadScore(workspaceId: string, leadId: string, nextScore: number): Promise<Lead>;
  createLeadScoreEvent(data: Prisma.InputJsonValue): Promise<Record<string, unknown>>;
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
    onlyWithLead?: boolean;
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
  leadId: string | null;
  campaignId: string | null;
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    companyName: string | null;
    score: number;
    status: string;
  } | null;
  campaign: {
    id: string;
    name: string;
    objective: string;
  } | null;
};
