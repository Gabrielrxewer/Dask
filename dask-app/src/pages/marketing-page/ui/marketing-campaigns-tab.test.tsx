import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type {
  MarketingCampaignListItem,
  MarketingDashboard
} from "@/modules/marketing";
import { MarketingCampaignsTab } from "./marketing-campaigns-tab";
import type { AiFormState, CampaignFormState } from "./marketing-page.model";

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
  sendsQueuedToday: 0
};

const campaign: MarketingCampaignListItem = {
  id: "campaign-1",
  workspaceId: "workspace-1",
  name: "Pipeline Demo",
  objective: "COMMERCIAL_NURTURE",
  status: "ACTIVE",
  channel: "EMAIL",
  scheduledAt: "2026-05-13T12:00:00.000Z",
  launchedAt: null,
  createdAt: "2026-05-01T12:00:00.000Z",
  updatedAt: "2026-05-10T12:00:00.000Z",
  segmentId: null,
  templateId: null,
  senderProfileId: null
};

function MarketingCampaignsTabFixture({
  campaigns = [campaign],
  isLoading = false,
  error
}: {
  campaigns?: MarketingCampaignListItem[];
  isLoading?: boolean;
  error?: unknown;
}) {
  const [, setAiForm] = useState<AiFormState>({
    objective: "Nutrir leads",
    tone: "",
    targetStage: "",
    segmentHint: ""
  });
  const aiForm = useForm<AiFormState>({
    defaultValues: {
      objective: "Nutrir leads",
      tone: "",
      targetStage: "",
      segmentHint: ""
    }
  });
  const campaignForm = useForm<CampaignFormState>({
    defaultValues: {
      name: "",
      description: "",
      objective: "COMMERCIAL_NURTURE",
      segmentId: "",
      templateId: "",
      subject: "",
      bodyMarkdown: ""
    }
  });

  return (
    <MarketingCampaignsTab
      dashboard={dashboard}
      campaigns={campaigns}
      scheduledCampaigns={[]}
      activeCampaigns={campaigns.filter((item) => item.status === "ACTIVE")}
      audience={[]}
      segments={[]}
      templates={[]}
      isAiAssistantOpen={false}
      setIsAiAssistantOpen={() => undefined}
      setAiForm={setAiForm}
      aiFormControl={aiForm.control}
      aiFormErrors={aiForm.formState.errors}
      campaignFormControl={campaignForm.control}
      campaignFormErrors={campaignForm.formState.errors}
      campaignSearch=""
      setCampaignSearch={() => undefined}
      campaignStatusFilter="ALL"
      setCampaignStatusFilter={() => undefined}
      selectedCampaignId="campaign-1"
      campaignDetails={null}
      testEmail=""
      setTestEmail={() => undefined}
      scheduleAt=""
      setScheduleAt={() => undefined}
      selectedVariantId=""
      setSelectedVariantId={() => undefined}
      isLoading={isLoading}
      error={error}
      isSubmitting={false}
      createCampaign={async () => undefined}
      loadCampaignDetails={async () => undefined}
      generateWithAI={async () => undefined}
      submitForReview={async () => undefined}
      approveCampaign={async () => undefined}
      scheduleCampaign={async () => undefined}
      sendTest={async () => undefined}
      improveVariantWithAI={async () => undefined}
      launchCampaign={async () => undefined}
    />
  );
}

describe("MarketingCampaignsTab", () => {
  it("renderiza Pipeline de envio em secao propria com DataTable compartilhada", () => {
    const html = renderToStaticMarkup(<MarketingCampaignsTabFixture />);

    expect(html).toContain("mkt-table-section--pipeline");
    expect(html).toContain("Pipeline de envio");
    expect(html).toContain("shared-data-table");
    expect(html).toContain("Pipeline Demo");
    expect(html).toContain("Campanha");
    expect(html).toContain("Status");
    expect(html).toContain("Agenda");
    expect(html).toContain("Acoes");
    expect(html).toContain("Abrir");
    expect(html).toContain("mkt-perf-table__row--active");
  });

  it("preserva loading, empty e error states do Pipeline de envio", () => {
    const loading = renderToStaticMarkup(<MarketingCampaignsTabFixture campaigns={[]} isLoading />);
    const empty = renderToStaticMarkup(<MarketingCampaignsTabFixture campaigns={[]} />);
    const error = renderToStaticMarkup(
      <MarketingCampaignsTabFixture campaigns={[]} error={new Error("Falha no pipeline")} />
    );

    expect(loading).toContain("Carregando campanhas...");
    expect(loading).toContain("shared-loading-state");
    expect(empty).toContain("Nenhuma campanha no workspace.");
    expect(empty).toContain("shared-data-table__row--empty");
    expect(error).toContain("Falha no pipeline");
    expect(error).toContain("shared-empty-state--error");
  });
});
