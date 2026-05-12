import { afterEach, describe, expect, it, vi } from "vitest";
import { publicCommercialDocumentService } from "@/pages/proposal-public-page/api/public-commercial-document-service";
import { apiClient } from "@/shared/api/http-client";

vi.mock("@/shared/api/http-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("publicCommercialDocumentService", () => {
  it("loads public proposal links with optional auth and encoded tokens", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ title: "Proposta" } as never);

    await publicCommercialDocumentService.getByToken("token/with space");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/documents/public/token%2Fwith%20space",
      {
        authMode: "optional",
        retryOnUnauthorized: false,
        globalLoading: false
      }
    );
  });

  it("posts accept and reject decisions through the authenticated public decision endpoint", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined as never);

    await publicCommercialDocumentService.decide("public-token", "accept");
    await publicCommercialDocumentService.decide("public-token", "reject");

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/documents/public/public-token/decision",
      { decision: "accept" },
      {
        authMode: "required",
        retryOnUnauthorized: true,
        globalLoading: false
      }
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/documents/public/public-token/decision",
      { decision: "reject" },
      {
        authMode: "required",
        retryOnUnauthorized: true,
        globalLoading: false
      }
    );
  });
});
