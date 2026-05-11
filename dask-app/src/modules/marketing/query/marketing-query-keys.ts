import type {
  MarketingCampaignObjective,
  MarketingCampaignStatus,
  MarketingSignalType
} from "@/modules/marketing/model";

export interface MarketingCampaignFilters {
  status?: MarketingCampaignStatus | "ALL";
  objective?: MarketingCampaignObjective | "ALL";
  search?: string;
  limit?: number;
}

export interface MarketingAudienceFilters {
  search?: string;
  stage?: string;
  consentStatus?: "OPT_IN" | "OPT_OUT" | "UNSUBSCRIBED" | "UNKNOWN" | "ALL";
  limit?: number;
}

export interface MarketingSignalsFilters {
  types?: Array<MarketingSignalType | string>;
  includeDismissed?: boolean;
  limit?: number;
}

export interface MarketingAnalyticsFilters {
  campaignIds?: string[];
  objective?: MarketingCampaignObjective | "ALL";
}

export interface MarketingTemplateFilters {
  category?: string;
  objective?: string;
  funnelStage?: string;
  search?: string;
  includeArchived?: boolean;
}

export interface MarketingJourneyFilters {
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED" | "ALL";
  search?: string;
  limit?: number;
}

function cleanRecord<TValue>(
  record: Record<string, TValue | undefined | null | "" | "ALL"> | undefined
): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "ALL")
  ) as Record<string, TValue>;
}

function cleanStringArray(values: string[] | undefined): string[] | undefined {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean).sort();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function normalizeMarketingCampaignFilters(filters?: MarketingCampaignFilters) {
  return cleanRecord<string | number>({
    status: filters?.status,
    objective: filters?.objective,
    search: filters?.search?.trim(),
    limit: filters?.limit
  });
}

export function normalizeMarketingAudienceFilters(filters?: MarketingAudienceFilters) {
  return cleanRecord<string | number>({
    search: filters?.search?.trim(),
    stage: filters?.stage?.trim(),
    consentStatus: filters?.consentStatus,
    limit: filters?.limit
  });
}

export function normalizeMarketingSignalsFilters(filters?: MarketingSignalsFilters) {
  return {
    ...cleanRecord<boolean | number>({
      includeDismissed: filters?.includeDismissed,
      limit: filters?.limit
    }),
    types: cleanStringArray(filters?.types)
  };
}

export function normalizeMarketingAnalyticsFilters(filters?: MarketingAnalyticsFilters) {
  return {
    ...cleanRecord<string>({
      objective: filters?.objective
    }),
    campaignIds: cleanStringArray(filters?.campaignIds)
  };
}

export function normalizeMarketingTemplateFilters(filters?: MarketingTemplateFilters) {
  return cleanRecord<string | boolean>({
    category: filters?.category?.trim(),
    objective: filters?.objective?.trim(),
    funnelStage: filters?.funnelStage?.trim(),
    search: filters?.search?.trim(),
    includeArchived: filters?.includeArchived
  });
}

export function normalizeMarketingJourneyFilters(filters?: MarketingJourneyFilters) {
  return cleanRecord<string | number>({
    status: filters?.status,
    search: filters?.search?.trim(),
    limit: filters?.limit
  });
}

export const marketingQueryKeys = {
  all: ["marketing"] as const,
  workspace: (workspaceId: string) => [...marketingQueryKeys.all, workspaceId] as const,
  dashboard: (workspaceId: string) => [...marketingQueryKeys.workspace(workspaceId), "dashboard"] as const,
  campaigns: (workspaceId: string, filters?: MarketingCampaignFilters) =>
    [...marketingQueryKeys.workspace(workspaceId), "campaigns", normalizeMarketingCampaignFilters(filters)] as const,
  campaignDetails: (workspaceId: string, campaignId: string) =>
    [...marketingQueryKeys.workspace(workspaceId), "campaigns", campaignId] as const,
  audience: (workspaceId: string, filters?: MarketingAudienceFilters) =>
    [...marketingQueryKeys.workspace(workspaceId), "audience", normalizeMarketingAudienceFilters(filters)] as const,
  segments: (workspaceId: string) => [...marketingQueryKeys.workspace(workspaceId), "segments"] as const,
  signals: (workspaceId: string, filters?: MarketingSignalsFilters) =>
    [...marketingQueryKeys.workspace(workspaceId), "signals", normalizeMarketingSignalsFilters(filters)] as const,
  analytics: (workspaceId: string, filters?: MarketingAnalyticsFilters) =>
    [...marketingQueryKeys.workspace(workspaceId), "analytics", normalizeMarketingAnalyticsFilters(filters)] as const,
  templates: (workspaceId: string, filters?: MarketingTemplateFilters) =>
    [...marketingQueryKeys.workspace(workspaceId), "templates", normalizeMarketingTemplateFilters(filters)] as const,
  journeys: (workspaceId: string, filters?: MarketingJourneyFilters) =>
    [...marketingQueryKeys.workspace(workspaceId), "journeys", normalizeMarketingJourneyFilters(filters)] as const,
  journey: (workspaceId: string, journeyId: string) =>
    [...marketingQueryKeys.workspace(workspaceId), "journeys", journeyId] as const
};
