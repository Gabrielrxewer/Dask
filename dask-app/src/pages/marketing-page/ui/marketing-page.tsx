import { LoadingState, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { MarketingAnalyticsTab } from "./marketing-analytics-tab";
import { MarketingAudienceTab } from "./marketing-audience-tab";
import { MarketingCampaignsTab } from "./marketing-campaigns-tab";
import { MarketingJourneysTab } from "./marketing-journeys-tab";
import { MarketingOverviewTab } from "./marketing-overview-tab";
import { MarketingSignalsTab } from "./marketing-signals-tab";
import { MarketingTemplatesTab } from "./marketing-templates-tab";
import { MarketingTabs } from "./marketing-tabs";
import { useMarketingPageModel } from "./use-marketing-page-model";
import "./marketing-page.css";

export function MarketingPage() {
  const marketing = useMarketingPageModel();
  const topNavigation = <MarketingTabs {...marketing.tabsProps} />;

  return (
    <AppShell metrics={marketing.metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="marketing-page" variant="dashboard" scroll="none">
        <LoadingState
          text="Carregando marketing..."
          animation="marketing"
          variant="frame"
          visible={marketing.isLoading && !marketing.dashboard}
        />

        <div className="marketing-page__content">
          <div className="marketing-page__stack">
            {marketing.message ? (
              <div className="marketing-page__feedback marketing-page__feedback--ok">{marketing.message}</div>
            ) : null}
            {marketing.error ? (
              <div className="marketing-page__feedback marketing-page__feedback--error">{marketing.error}</div>
            ) : null}

            {marketing.tab === "inbox" ? <MarketingSignalsTab {...marketing.signalsTabProps} /> : null}
            {marketing.tab === "analytics" ? <MarketingAnalyticsTab {...marketing.analyticsTabProps} /> : null}
            {marketing.tab === "overview" ? <MarketingOverviewTab {...marketing.overviewTabProps} /> : null}
            {marketing.tab === "campaigns" ? <MarketingCampaignsTab {...marketing.campaignsTabProps} /> : null}
            {marketing.tab === "audience" ? <MarketingAudienceTab {...marketing.audienceTabProps} /> : null}
            {marketing.tab === "journeys" ? <MarketingJourneysTab {...marketing.journeysTabProps} /> : null}
            {marketing.tab === "templates" ? <MarketingTemplatesTab {...marketing.templatesTabProps} /> : null}
          </div>
        </div>
      </WorkspaceFrame>
    </AppShell>
  );
}
