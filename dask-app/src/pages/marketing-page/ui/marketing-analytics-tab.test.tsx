import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarketingCampaignListItem, MarketingDashboard } from "@/modules/marketing";
import { MarketingAnalyticsTab } from "./marketing-analytics-tab";

const dashboard: MarketingDashboard = {
  activeCampaigns: 1,
  scheduledCampaigns: 0,
  openRate: 0.28,
  clickRate: 0.06,
  conversionRate: 0.03,
  influencedWorkItems: 2,
  influencedCustomers: 1,
  influencedRevenue: 5000,
  automationsRunning: 1,
  sendsQueuedToday: 4
};

const campaign: MarketingCampaignListItem & {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number | null;
  clickRate: number | null;
} = {
  id: "campaign-1",
  workspaceId: "workspace-1",
  name: "Performance Demo",
  objective: "COMMERCIAL_NURTURE",
  status: "ACTIVE",
  channel: "EMAIL",
  scheduledAt: null,
  launchedAt: "2026-05-10T12:00:00.000Z",
  createdAt: "2026-05-01T12:00:00.000Z",
  updatedAt: "2026-05-12T12:00:00.000Z",
  segmentId: null,
  templateId: null,
  senderProfileId: null,
  sent: 120,
  opened: 36,
  clicked: 9,
  bounced: 1,
  openRate: 0.3,
  clickRate: 0.075
};

function MarketingAnalyticsTabFixture({
  enrichedCampaigns = [campaign],
  isLoadingAnalytics = false,
  analyticsError
}: {
  enrichedCampaigns?: typeof campaign[];
  isLoadingAnalytics?: boolean;
  analyticsError?: unknown;
}) {
  return (
    <MarketingAnalyticsTab
      dashboard={dashboard}
      campaigns={enrichedCampaigns}
      enrichedCampaigns={enrichedCampaigns}
      analyticsInsights={["Abertura acima da meta."]}
      analyticsObjectiveFilter="ALL"
      isLoadingAnalytics={isLoadingAnalytics}
      analyticsError={analyticsError}
      hasEnoughAnalyticsData
      setAnalyticsObjectiveFilter={() => undefined}
      setTab={() => undefined}
      loadCampaignDetails={async () => undefined}
      onRefreshAnalytics={async () => undefined}
    />
  );
}

describe("MarketingAnalyticsTab", () => {
  it("renderiza Performance por campanha em seção própria com DataTable compartilhada", () => {
    const html = renderToStaticMarkup(<MarketingAnalyticsTabFixture />);

    expect(html).toContain("mkt-table-section--performance");
    expect(html).toContain("Performance por campanha");
    expect(html).toContain("shared-data-table");
    expect(html).toContain("Performance Demo");
    expect(html).toContain("Campanha");
    expect(html).toContain("Status");
    expect(html).toContain("Enviados");
    expect(html).toContain("Abertura");
    expect(html).toContain("Clique");
    expect(html).toContain("Acoes");
    expect(html).toContain("120");
    expect(html).toContain("30.0%");
    expect(html).toContain("7.5%");
    expect(html).toContain("Abrir");
  });

  it("preserva loading, empty e error states da Performance por campanha", () => {
    const loading = renderToStaticMarkup(<MarketingAnalyticsTabFixture enrichedCampaigns={[]} isLoadingAnalytics />);
    const empty = renderToStaticMarkup(<MarketingAnalyticsTabFixture enrichedCampaigns={[]} />);
    const error = renderToStaticMarkup(
      <MarketingAnalyticsTabFixture enrichedCampaigns={[]} analyticsError={new Error("Falha nas metricas")} />
    );

    expect(loading).toContain("Carregando metricas...");
    expect(loading).toContain("shared-loading-state");
    expect(empty).toContain("Nenhuma campanha encontrada.");
    expect(empty).toContain("shared-data-table__row--empty");
    expect(error).toContain("Falha nas metricas");
    expect(error).toContain("shared-empty-state--error");
  });
});
