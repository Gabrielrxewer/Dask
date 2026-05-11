import { afterEach, describe, expect, it, vi } from "vitest";
import { publicCommercialDocumentService } from "@/pages/proposal-public-page/api/public-commercial-document-service";
import { decidePublicCommercialDocumentMutationRequest } from "@/modules/documentation/query/documentation-mutations";

vi.mock("@/pages/proposal-public-page/api/public-commercial-document-service", () => ({
  publicCommercialDocumentService: {
    decide: vi.fn()
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

describe("documentation proposal decision mutation", () => {
  it("sends public proposal decisions through the public commercial document service", async () => {
    vi.mocked(publicCommercialDocumentService.decide).mockResolvedValue(undefined);

    await decidePublicCommercialDocumentMutationRequest({
      publicAccessId: "public-token",
      decision: "approve"
    });

    expect(publicCommercialDocumentService.decide).toHaveBeenCalledWith("public-token", "approve");
  });
});
