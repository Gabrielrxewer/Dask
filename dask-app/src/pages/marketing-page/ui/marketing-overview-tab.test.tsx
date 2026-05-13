import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarketingCampaignListItem, MarketingDashboard } from "@/modules/marketing";
import { MarketingOverviewTab } from "./marketing-overview-tab";

const dashboard: MarketingDashboard = {
  activeCampaigns: 1,
  scheduledCampaigns: 1,
  openRate: 0.32,
  clickRate: 0.08,
  conversionRate: 0.03,
  influencedWorkItems: 4,
  influencedCustomers: 2,
  influencedRevenue: 12000,
  automationsRunning: 1,
  sendsQueuedToday: 3
};

const campaign: MarketingCampaignListItem = {
  id: "campaign-1",
  workspaceId: "workspace-1",
  name: "Campanha Demo",
  objective: "NEWSLETTER",
  status: "ACTIVE",
  channel: "EMAIL",
  scheduledAt: "2026-05-12T12:00:00.000Z",
  launchedAt: null,
  createdAt: "2026-05-01T12:00:00.000Z",
  updatedAt: "2026-05-10T12:00:00.000Z",
  segmentId: "segment-1",
  templateId: null,
  senderProfileId: null
};

describe("MarketingOverviewTab", () => {
  it("renderiza Campanhas em movimento com a DataTable compartilhada", () => {
    const html = renderToStaticMarkup(
      <MarketingOverviewTab
        dashboard={dashboard}
        signalUnreadCount={0}
        campaigns={[campaign]}
        audience={[]}
        flows={[]}
        reviewCampaigns={[]}
        scheduledCampaigns={[]}
        signals={[]}
        analyticsInsights={[]}
        setTab={() => undefined}
        loadCampaignDetails={async () => undefined}
      />
    );

    expect(html).toContain("Campanhas em movimento");
    expect(html).toContain("shared-data-table");
    expect(html).toContain("Campanha Demo");
    expect(html).toContain("Status");
    expect(html).toContain("Agenda");
    expect(html).toContain("Canal");
    expect(html).toContain("Segmento");
    expect(html).toContain("Abrir");
  });

  it("mantem o empty state da tabela compartilhada", () => {
    const html = renderToStaticMarkup(
      <MarketingOverviewTab
        dashboard={dashboard}
        signalUnreadCount={0}
        campaigns={[]}
        audience={[]}
        flows={[]}
        reviewCampaigns={[]}
        scheduledCampaigns={[]}
        signals={[]}
        analyticsInsights={[]}
        setTab={() => undefined}
        loadCampaignDetails={async () => undefined}
      />
    );

    expect(html).toContain("Nenhuma campanha criada.");
    expect(html).toContain("shared-data-table__row--empty");
  });
});
