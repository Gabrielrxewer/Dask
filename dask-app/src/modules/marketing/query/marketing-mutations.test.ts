import { afterEach, describe, expect, it, vi } from "vitest";
import { marketingService } from "@/modules/marketing/api";
import type {
  CreateMarketingCampaignInput,
  MarketingCampaignDetails
} from "@/modules/marketing/model";
import { createMarketingCampaignMutationRequest } from "./marketing-mutations";

vi.mock("@/modules/marketing/api", () => ({
  marketingService: {
    createCampaign: vi.fn()
  }
}));

vi.mock("@/shared/ui/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("marketing mutations", () => {
  it("creates campaigns through the marketing service with the resolved workspace", async () => {
    const details: MarketingCampaignDetails = {
      campaign: { id: "campaign-1", name: "Nurture" },
      variants: [],
      segment: null,
      template: null,
      senderProfile: null,
      recentEvents: [],
      sends: []
    };
    const input: CreateMarketingCampaignInput = {
      name: "Nurture",
      objective: "COMMERCIAL_NURTURE",
      variants: [
        {
          name: "Controle",
          subject: "Proximo passo",
          bodyMarkdown: "Mensagem",
          isControl: true,
          weight: 100
        }
      ]
    };
    vi.mocked(marketingService.createCampaign).mockResolvedValue(details);

    await expect(createMarketingCampaignMutationRequest("workspace-1", input)).resolves.toBe(details);

    expect(marketingService.createCampaign).toHaveBeenCalledWith("workspace-1", input);
  });

  it("fails before calling the service when workspace is missing", async () => {
    const input: CreateMarketingCampaignInput = {
      name: "Nurture",
      objective: "COMMERCIAL_NURTURE"
    };

    await expect(createMarketingCampaignMutationRequest("", input)).rejects.toThrow("Nenhum workspace selecionado.");
    expect(marketingService.createCampaign).not.toHaveBeenCalled();
  });
});
