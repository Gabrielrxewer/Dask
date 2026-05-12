import { describe, expect, it } from "vitest";
import {
  marketingQueryKeys,
  normalizeMarketingAudienceFilters,
  normalizeMarketingCampaignFilters,
  normalizeMarketingJourneyFilters,
  normalizeMarketingSignalsFilters
} from "@/modules/marketing/query/marketing-query-keys";

describe("marketingQueryKeys", () => {
  it("normalizes campaign and audience wide-list filters", () => {
    expect(normalizeMarketingCampaignFilters({
      status: "ALL",
      objective: "COMMERCIAL_NURTURE",
      search: "  onboarding  ",
      limit: 200
    })).toEqual({
      objective: "COMMERCIAL_NURTURE",
      search: "onboarding",
      limit: 200
    });

    expect(normalizeMarketingAudienceFilters({
      search: "  acme  ",
      stage: "  SQL  ",
      consentStatus: "ALL",
      limit: 400
    })).toEqual({
      search: "acme",
      stage: "SQL",
      limit: 400
    });
  });

  it("sorts signal type filters so query keys are deterministic", () => {
    expect(normalizeMarketingSignalsFilters({
      types: ["FORM_SUBMIT", "  EMAIL_REPLY  ", ""],
      includeDismissed: false,
      limit: 200
    })).toEqual({
      includeDismissed: false,
      limit: 200,
      types: ["EMAIL_REPLY", "FORM_SUBMIT"]
    });

    expect(marketingQueryKeys.signals("workspace-1", {
      types: ["FORM_SUBMIT", "EMAIL_REPLY"],
      limit: 200
    })).toEqual(marketingQueryKeys.signals("workspace-1", {
      types: ["EMAIL_REPLY", "FORM_SUBMIT"],
      limit: 200
    }));
  });

  it("keeps journey pages segmented by status and search", () => {
    expect(normalizeMarketingJourneyFilters({
      status: "ALL",
      search: "  ativacao  ",
      limit: 200
    })).toEqual({
      search: "ativacao",
      limit: 200
    });

    expect(marketingQueryKeys.journeys("workspace-1", { status: "ACTIVE", limit: 200 }))
      .not.toEqual(marketingQueryKeys.journeys("workspace-1", { status: "PAUSED", limit: 200 }));
  });
});
