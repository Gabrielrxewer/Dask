export type MarketingCampaignStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED';

export type MarketingCampaignObjective =
  | 'LEAD_NURTURE'
  | 'ONBOARDING'
  | 'REACTIVATION'
  | 'BILLING_REMINDER'
  | 'RENEWAL'
  | 'EXPANSION'
  | 'PRODUCT_UPDATE'
  | 'NEWSLETTER'
  | 'CUSTOM';

export type MarketingCampaignChannel = 'EMAIL' | 'NEWSLETTER';

export interface MarketingDashboard {
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
}

export interface MarketingCampaignListItem {
  id: string;
  workspaceId: string;
  name: string;
  objective: MarketingCampaignObjective;
  status: MarketingCampaignStatus;
  channel: MarketingCampaignChannel;
  scheduledAt: string | null;
  launchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  segmentId: string | null;
  templateId: string | null;
  senderProfileId: string | null;
}

export interface MarketingCampaignVariant {
  id: string;
  campaignId: string;
  name: string;
  subject: string;
  preheader: string | null;
  bodyMarkdown: string;
  bodyHtml: string | null;
  isControl: boolean;
  weight: number;
}

export interface MarketingSegment {
  id: string;
  name: string;
  description: string | null;
  kind: 'STATIC' | 'DYNAMIC';
  isActive: boolean;
  estimatedContacts: number | null;
  filters: {
    logic?: 'AND' | 'OR';
    rules: Array<{
      field: string;
      operator: string;
      value?: string | number | boolean | Array<string | number | boolean>;
    }>;
  };
}

export interface MarketingTemplate {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  objective: string | null;
  funnelStage: string | null;
  subject: string;
  bodyMarkdown: string;
  bodyHtml: string | null;
  isArchived: boolean;
}

export interface MarketingCampaignDetails {
  campaign: Record<string, unknown>;
  variants: MarketingCampaignVariant[];
  segment: MarketingSegment | null;
  template: MarketingTemplate | null;
  senderProfile: Record<string, unknown> | null;
  recentEvents: Array<Record<string, unknown>>;
  sends: Array<Record<string, unknown>>;
}

export interface MarketingAudienceContact {
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    companyName: string | null;
    status: string;
    score: number;
    captureSource: string;
    updatedAt: string;
  };
  preference: {
    consentStatus: string;
    allowEmail: boolean;
    allowNewsletter: boolean;
    allowBilling: boolean;
  } | null;
  lastEventAt: string | null;
}

export interface MarketingSegmentPreview {
  segment: MarketingSegment;
  estimatedContacts: number;
  sample: MarketingAudienceContact['lead'][];
}

export interface MarketingAutomationFlow {
  id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  triggerDefinition: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
  updatedAt: string;
}

export interface MarketingCampaignAnalytics {
  byType: Array<{ type: string; total: number }>;
  byStatus: Array<{ status: string; total: number }>;
}

export type MarketingSignalType =
  | 'EMAIL_CLICKED'
  | 'EMAIL_OPENED'
  | 'EMAIL_BOUNCED'
  | 'EMAIL_COMPLAINT'
  | 'EMAIL_UNSUBSCRIBED'
  | 'LEAD_SCORE_CHANGED';

export type MarketingSignalPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface MarketingSignal {
  id: string;
  type: MarketingSignalType | string;
  headline: string | null;
  description: string | null;
  payload: Record<string, unknown> | null;
  occurredAt: string;
  seenAt: string | null;
  dismissedAt: string | null;
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
}

export interface MarketingSignalsInbox {
  items: MarketingSignal[];
  unreadCount: number;
}

export interface CreateMarketingFollowUpInput {
  signalId: string;
  leadId: string;
  title: string;
  description?: string;
  dueAt?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createWorkItem?: boolean;
  boardId?: string;
  workflowStateId?: string;
  assigneeId?: string | null;
}

export interface SendMarketingTemplateTestInput {
  to: string;
  variables?: Record<string, string | number | boolean | null>;
}

export interface MarketingFollowUpResult {
  signalId: string;
  leadId: string;
  activity: {
    id: string;
    title: string;
    description: string | null;
    occurredAt: string;
  };
  lead: {
    id: string;
    lastContactAt: string | null;
    nextFollowUpAt: string | null;
    status: string;
  } | null;
  workItemId: string | null;
}

export interface CreateMarketingCampaignInput {
  name: string;
  description?: string;
  objective: MarketingCampaignObjective;
  channel?: MarketingCampaignChannel;
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
}
