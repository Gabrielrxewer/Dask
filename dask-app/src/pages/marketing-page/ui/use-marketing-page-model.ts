import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildBoardMetrics } from "@/entities/task";
import { marketingQueryKeys, useMarketingDashboardQuery } from "@/modules/marketing/query";
import { useCurrentWorkspace } from "@/modules/workspace";
import type { MarketingTab } from "./marketing-page.model";
import {
  useMarketingAnalyticsModel,
  useMarketingAudienceModel,
  useMarketingCampaignsModel,
  useMarketingJourneysModel,
  useMarketingPermissionsModel,
  useMarketingSignalsModel,
  useMarketingTemplatesModel
} from "./use-marketing-domain-models";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function firstError(...errors: unknown[]): string {
  for (const error of errors) {
    const message = errorMessage(error);
    if (message) {
      return message;
    }
  }

  return "";
}

export function useMarketingPageModel() {
  const { snapshot } = useCurrentWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const queryClient = useQueryClient();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [tab, setTab] = useState<MarketingTab>("overview");
  const [message, setMessage] = useState("");
  const [localError, setError] = useState("");
  const feedbackControls = useMemo(() => ({ setError, setMessage }), []);

  const permissions = useMarketingPermissionsModel(snapshot);
  const dashboardQuery = useMarketingDashboardQuery(workspaceId);
  const dashboard = dashboardQuery.data ?? null;

  const campaignsModel = useMarketingCampaignsModel(workspaceId, feedbackControls, setTab);
  const audienceModel = useMarketingAudienceModel(workspaceId, feedbackControls);
  const signalsModel = useMarketingSignalsModel(workspaceId, feedbackControls, setTab);
  const templatesModel = useMarketingTemplatesModel(workspaceId, feedbackControls);
  const journeysModel = useMarketingJourneysModel(workspaceId, feedbackControls);
  const analyticsModel = useMarketingAnalyticsModel(
    workspaceId,
    tab,
    dashboard,
    campaignsModel.campaigns,
    setTab,
    campaignsModel.loadCampaignDetails
  );

  const isSubmitting =
    campaignsModel.isSubmitting ||
    audienceModel.isSubmitting ||
    templatesModel.isSubmitting ||
    journeysModel.isSavingFlow;

  const isLoading =
    dashboardQuery.isLoading ||
    campaignsModel.isLoading ||
    audienceModel.isLoading ||
    templatesModel.isLoading ||
    journeysModel.isLoading;

  const error =
    localError ||
    firstError(
      dashboardQuery.error,
      campaignsModel.error,
      audienceModel.error,
      templatesModel.error,
      journeysModel.error,
      analyticsModel.error
    );

  const refreshMarketing = useCallback(async () => {
    setError("");
    if (!workspaceId) return;
    await queryClient.invalidateQueries({ queryKey: marketingQueryKeys.workspace(workspaceId) });
  }, [queryClient, workspaceId]);

  return {
    dashboard,
    error,
    isLoading,
    isSubmitting,
    message,
    metrics,
    permissions,
    signalUnreadCount: signalsModel.signalUnreadCount,
    tab,
    tabsProps: {
      tab,
      onTabChange: setTab,
      onRefresh: () => void refreshMarketing(),
      isRefreshDisabled: isLoading || isSubmitting,
      signalUnreadCount: signalsModel.signalUnreadCount
    },
    signalsTabProps: {
      signalUnreadCount: signalsModel.signalUnreadCount,
      signals: signalsModel.signals,
      isLoadingSignals: signalsModel.isLoadingSignals,
      signalsError: signalsModel.signalsError,
      isCreatingFollowUp: signalsModel.isCreatingFollowUp,
      signalTypeFilter: signalsModel.signalTypeFilter,
      signalShowDismissed: signalsModel.signalShowDismissed,
      signalGroupByWorkItem: signalsModel.signalGroupByWorkItem,
      setSignalTypeFilter: signalsModel.setSignalTypeFilter,
      setSignalShowDismissed: signalsModel.setSignalShowDismissed,
      setSignalGroupByWorkItem: signalsModel.setSignalGroupByWorkItem,
      setMessage,
      setTab,
      loadSignals: signalsModel.loadSignals,
      handleSignalAction: signalsModel.handleSignalAction,
      createFollowUp: signalsModel.createFollowUp
    },
    analyticsTabProps: {
      dashboard,
      campaigns: campaignsModel.campaigns,
      enrichedCampaigns: analyticsModel.enrichedCampaigns,
      analyticsInsights: analyticsModel.analyticsInsights,
      analyticsObjectiveFilter: analyticsModel.analyticsObjectiveFilter,
      isLoadingAnalytics: analyticsModel.isLoadingAnalytics,
      analyticsError: analyticsModel.error,
      hasEnoughAnalyticsData: analyticsModel.hasEnoughAnalyticsData,
      setAnalyticsObjectiveFilter: analyticsModel.setAnalyticsObjectiveFilter,
      setTab,
      loadCampaignDetails: campaignsModel.loadCampaignDetails,
      onRefreshAnalytics: analyticsModel.onRefreshAnalytics
    },
    overviewTabProps: {
      dashboard,
      signalUnreadCount: signalsModel.signalUnreadCount,
      campaigns: campaignsModel.campaigns,
      audience: audienceModel.audience,
      flows: journeysModel.flows,
      reviewCampaigns: campaignsModel.reviewCampaigns,
      scheduledCampaigns: campaignsModel.scheduledCampaigns,
      signals: signalsModel.signals,
      analyticsInsights: analyticsModel.analyticsInsights,
      setTab,
      loadCampaignDetails: campaignsModel.loadCampaignDetails
    },
    campaignsTabProps: {
      dashboard,
      campaigns: campaignsModel.campaigns,
      scheduledCampaigns: campaignsModel.scheduledCampaigns,
      activeCampaigns: campaignsModel.activeCampaigns,
      audience: audienceModel.audience,
      segments: audienceModel.segments,
      templates: templatesModel.templates,
      isAiAssistantOpen: campaignsModel.isAiAssistantOpen,
      setIsAiAssistantOpen: campaignsModel.setIsAiAssistantOpen,
      setAiForm: campaignsModel.setAiForm,
      aiFormControl: campaignsModel.aiFormControl,
      aiFormErrors: campaignsModel.aiFormErrors,
      campaignFormControl: campaignsModel.campaignFormControl,
      campaignFormErrors: campaignsModel.campaignFormErrors,
      campaignSearch: campaignsModel.campaignSearch,
      setCampaignSearch: campaignsModel.setCampaignSearch,
      campaignStatusFilter: campaignsModel.campaignStatusFilter,
      setCampaignStatusFilter: campaignsModel.setCampaignStatusFilter,
      selectedCampaignId: campaignsModel.selectedCampaignId,
      campaignDetails: campaignsModel.campaignDetails,
      testEmail: campaignsModel.testEmail,
      setTestEmail: campaignsModel.setTestEmail,
      scheduleAt: campaignsModel.scheduleAt,
      setScheduleAt: campaignsModel.setScheduleAt,
      selectedVariantId: campaignsModel.selectedVariantId,
      setSelectedVariantId: campaignsModel.setSelectedVariantId,
      isLoading: campaignsModel.isLoading,
      error: campaignsModel.error,
      isSubmitting,
      createCampaign: campaignsModel.createCampaign,
      loadCampaignDetails: campaignsModel.loadCampaignDetails,
      generateWithAI: campaignsModel.generateWithAI,
      submitForReview: campaignsModel.submitForReview,
      approveCampaign: campaignsModel.approveCampaign,
      scheduleCampaign: campaignsModel.scheduleCampaign,
      sendTest: campaignsModel.sendTest,
      improveVariantWithAI: campaignsModel.improveVariantWithAI,
      launchCampaign: campaignsModel.launchCampaign
    },
    audienceTabProps: {
      audience: audienceModel.audience,
      segments: audienceModel.segments,
      audienceSearch: audienceModel.audienceSearch,
      setAudienceSearch: audienceModel.setAudienceSearch,
      segmentFormControl: audienceModel.segmentFormControl,
      segmentFormErrors: audienceModel.segmentFormErrors,
      segmentPreview: audienceModel.segmentPreview,
      segmentFilterRule: audienceModel.segmentFilterRule,
      updateSegmentFilterRule: audienceModel.updateSegmentFilterRule,
      isLoading: audienceModel.isLoading,
      error: audienceModel.error,
      isSubmitting,
      loadData: audienceModel.loadData,
      createSegment: audienceModel.createSegment,
      previewSegment: audienceModel.previewSegment
    },
    journeysTabProps: {
      flows: journeysModel.flows,
      activeFlowId: journeysModel.activeFlowId,
      setActiveFlowId: journeysModel.setActiveFlowId,
      handleJourneySave: journeysModel.handleJourneySave,
      handleJourneyActivate: journeysModel.handleJourneyActivate,
      handleJourneyDeactivate: journeysModel.handleJourneyDeactivate,
      isSavingFlow: journeysModel.isSavingFlow
    },
    templatesTabProps: {
      templates: templatesModel.templates,
      filteredTemplates: templatesModel.filteredTemplates,
      templateGoalFilter: templatesModel.templateGoalFilter,
      setTemplateGoalFilter: templatesModel.setTemplateGoalFilter,
      isSubmitting,
      createTemplate: templatesModel.createTemplate,
      updateTemplate: templatesModel.updateTemplate,
      duplicateTemplate: templatesModel.duplicateTemplate,
      archiveTemplate: templatesModel.archiveTemplate,
      sendTemplateTest: templatesModel.sendTemplateTest
    }
  };
}
