export {
  marketingQueryKeys,
  normalizeMarketingAnalyticsFilters,
  normalizeMarketingAudienceFilters,
  normalizeMarketingCampaignFilters,
  normalizeMarketingJourneyFilters,
  normalizeMarketingSignalsFilters,
  normalizeMarketingTemplateFilters
} from "@/modules/marketing/query/marketing-query-keys";
export type {
  MarketingAnalyticsFilters,
  MarketingAudienceFilters,
  MarketingCampaignFilters,
  MarketingJourneyFilters,
  MarketingSignalsFilters,
  MarketingTemplateFilters
} from "@/modules/marketing/query/marketing-query-keys";

export {
  getFirstCampaignId,
  useMarketingAnalyticsQuery,
  useMarketingAudienceQuery,
  useMarketingCampaignDetailsQuery,
  useMarketingCampaignsQuery,
  useMarketingDashboardQuery,
  useMarketingJourneyQuery,
  useMarketingJourneysQuery,
  useMarketingSegmentsQuery,
  useMarketingSignalsQuery,
  useMarketingTemplatesQuery
} from "@/modules/marketing/query/marketing-queries";

export {
  useActivateJourneyMutation,
  useApproveCampaignMutation,
  useArchiveTemplateMutation,
  useCreateCampaignMutation,
  useCreateFollowUpMutation,
  useCreateSegmentMutation,
  useCreateTemplateMutation,
  useDuplicateTemplateMutation,
  useGenerateCampaignWithAiMutation,
  useImproveCampaignVariantWithAiMutation,
  useLaunchCampaignMutation,
  useMarkSignalMutation,
  usePauseJourneyMutation,
  usePreviewSegmentMutation,
  useSaveJourneyMutation,
  useScheduleCampaignMutation,
  useSendTemplateTestEmailMutation,
  useSendTestEmailMutation,
  useSubmitCampaignForReviewMutation,
  useUpdateCampaignMutation,
  useUpdateSegmentMutation,
  useUpdateTemplateMutation
} from "@/modules/marketing/query/marketing-mutations";
