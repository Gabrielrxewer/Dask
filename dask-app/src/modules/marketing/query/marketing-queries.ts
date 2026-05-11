import { useQuery } from "@tanstack/react-query";
import { marketingService } from "@/modules/marketing/api";
import type {
  MarketingAutomationFlow,
  MarketingCampaignAnalytics,
  MarketingCampaignListItem
} from "@/modules/marketing/model";
import {
  marketingQueryKeys,
  normalizeMarketingAnalyticsFilters,
  normalizeMarketingAudienceFilters,
  normalizeMarketingCampaignFilters,
  normalizeMarketingJourneyFilters,
  normalizeMarketingSignalsFilters,
  normalizeMarketingTemplateFilters,
  type MarketingAnalyticsFilters,
  type MarketingAudienceFilters,
  type MarketingCampaignFilters,
  type MarketingJourneyFilters,
  type MarketingSignalsFilters,
  type MarketingTemplateFilters
} from "@/modules/marketing/query/marketing-query-keys";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }

  return workspaceId;
}

function filterTemplates<TTemplate extends { category: string | null; objective: string | null; funnelStage: string | null; name: string; subject: string; isArchived: boolean }>(
  templates: TTemplate[],
  filters?: MarketingTemplateFilters
): TTemplate[] {
  const normalized = normalizeMarketingTemplateFilters(filters);
  const query = typeof normalized.search === "string" ? normalized.search.toLowerCase() : "";

  return templates.filter((template) => {
    if (!normalized.includeArchived && template.isArchived) return false;
    if (normalized.category && template.category !== normalized.category) return false;
    if (normalized.objective && template.objective !== normalized.objective) return false;
    if (normalized.funnelStage && template.funnelStage !== normalized.funnelStage) return false;
    if (!query) return true;

    return [template.name, template.subject, template.category, template.objective, template.funnelStage]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function filterJourneys(flows: MarketingAutomationFlow[], filters?: MarketingJourneyFilters): MarketingAutomationFlow[] {
  const normalized = normalizeMarketingJourneyFilters(filters);
  const query = typeof normalized.search === "string" ? normalized.search.toLowerCase() : "";

  return flows.filter((flow) => {
    if (normalized.status && flow.status !== normalized.status) return false;
    if (!query) return true;
    return [flow.name, flow.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });
}

export function useMarketingDashboardQuery(workspaceId: string | null | undefined) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: marketingQueryKeys.dashboard(resolvedWorkspaceId),
    queryFn: () => marketingService.getDashboard(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useMarketingCampaignsQuery(
  workspaceId: string | null | undefined,
  filters?: MarketingCampaignFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const normalizedFilters = normalizeMarketingCampaignFilters(filters);

  return useQuery({
    queryKey: marketingQueryKeys.campaigns(resolvedWorkspaceId, filters),
    queryFn: () =>
      marketingService.listCampaigns(requireWorkspace(workspaceId), {
        status: typeof normalizedFilters.status === "string" ? normalizedFilters.status : undefined,
        objective: typeof normalizedFilters.objective === "string" ? normalizedFilters.objective : undefined,
        search: typeof normalizedFilters.search === "string" ? normalizedFilters.search : undefined,
        limit: typeof normalizedFilters.limit === "number" ? normalizedFilters.limit : undefined
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useMarketingCampaignDetailsQuery(
  workspaceId: string | null | undefined,
  campaignId: string | null | undefined
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const resolvedCampaignId = campaignId ?? "__missing_campaign__";

  return useQuery({
    queryKey: marketingQueryKeys.campaignDetails(resolvedWorkspaceId, resolvedCampaignId),
    queryFn: () => marketingService.getCampaignDetails(requireWorkspace(workspaceId), resolvedCampaignId),
    enabled: isWorkspaceReady(workspaceId) && Boolean(campaignId)
  });
}

export function useMarketingAudienceQuery(
  workspaceId: string | null | undefined,
  filters?: MarketingAudienceFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const normalizedFilters = normalizeMarketingAudienceFilters(filters);

  return useQuery({
    queryKey: marketingQueryKeys.audience(resolvedWorkspaceId, filters),
    queryFn: () =>
      marketingService.listAudienceContacts(requireWorkspace(workspaceId), {
        search: typeof normalizedFilters.search === "string" ? normalizedFilters.search : undefined,
        stage: typeof normalizedFilters.stage === "string" ? normalizedFilters.stage : undefined,
        consentStatus: typeof normalizedFilters.consentStatus === "string" ? normalizedFilters.consentStatus : undefined,
        limit: typeof normalizedFilters.limit === "number" ? normalizedFilters.limit : undefined
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useMarketingSegmentsQuery(workspaceId: string | null | undefined) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: marketingQueryKeys.segments(resolvedWorkspaceId),
    queryFn: () => marketingService.listSegments(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useMarketingSignalsQuery(
  workspaceId: string | null | undefined,
  filters?: MarketingSignalsFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const normalizedFilters = normalizeMarketingSignalsFilters(filters);

  return useQuery({
    queryKey: marketingQueryKeys.signals(resolvedWorkspaceId, filters),
    queryFn: () =>
      marketingService.listSignalsInbox(requireWorkspace(workspaceId), {
        types: normalizedFilters.types,
        includeDismissed: filters?.includeDismissed,
        limit: filters?.limit
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useMarketingAnalyticsQuery(
  workspaceId: string | null | undefined,
  filters?: MarketingAnalyticsFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const normalizedFilters = normalizeMarketingAnalyticsFilters(filters);
  const campaignIds = normalizedFilters.campaignIds ?? [];

  return useQuery<Record<string, MarketingCampaignAnalytics>>({
    queryKey: marketingQueryKeys.analytics(resolvedWorkspaceId, filters),
    queryFn: async () => {
      const entries = await Promise.all(
        campaignIds.map(async (campaignId) => {
          try {
            const analytics = await marketingService.getAnalytics(requireWorkspace(workspaceId), campaignId);
            return [campaignId, analytics] as const;
          } catch {
            return [campaignId, { byType: [], byStatus: [] } satisfies MarketingCampaignAnalytics] as const;
          }
        })
      );

      return Object.fromEntries(entries);
    },
    enabled: isWorkspaceReady(workspaceId) && campaignIds.length > 0
  });
}

export function useMarketingTemplatesQuery(
  workspaceId: string | null | undefined,
  filters?: MarketingTemplateFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: marketingQueryKeys.templates(resolvedWorkspaceId, filters),
    queryFn: async () => {
      const result = await marketingService.listTemplates(requireWorkspace(workspaceId), filters);
      return { items: filterTemplates(result.items, filters) };
    },
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useMarketingJourneysQuery(
  workspaceId: string | null | undefined,
  filters?: MarketingJourneyFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: marketingQueryKeys.journeys(resolvedWorkspaceId, filters),
    queryFn: async () => {
      const result = await marketingService.listAutomationFlows(requireWorkspace(workspaceId), filters);
      return { items: filterJourneys(result.items, filters) };
    },
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useMarketingJourneyQuery(
  workspaceId: string | null | undefined,
  journeyId: string | null | undefined
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const resolvedJourneyId = journeyId ?? "__missing_journey__";

  return useQuery<MarketingAutomationFlow | null>({
    queryKey: marketingQueryKeys.journey(resolvedWorkspaceId, resolvedJourneyId),
    queryFn: async () => {
      const result = await marketingService.listAutomationFlows(requireWorkspace(workspaceId));
      return result.items.find((journey) => journey.id === resolvedJourneyId) ?? null;
    },
    enabled: isWorkspaceReady(workspaceId) && Boolean(journeyId)
  });
}

export function getFirstCampaignId(campaigns: MarketingCampaignListItem[]): string | null {
  return campaigns[0]?.id ?? null;
}
