import { afterEach, describe, expect, it, vi } from "vitest";
import { commercialService } from "@/modules/commercial/api";
import type { CreateCommercialWorkItemInput } from "@/modules/commercial/model";
import {
  createCommercialWorkItemMutationRequest,
  moveCommercialWorkItemInFlowMutationRequest
} from "@/modules/commercial/query/commercial-mutations";

vi.mock("@/modules/commercial/api", () => ({
  commercialService: {
    createCommercialWorkItem: vi.fn(),
    moveCommercialWorkItem: vi.fn()
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

describe("workItem mutations", () => {
  it("creates workItem and signal work items through the commercial service", async () => {
    vi.mocked(commercialService.createCommercialWorkItem).mockResolvedValue({ id: "item-1" } as never);

    const workItemInput: CreateCommercialWorkItemInput = {
      typeSlug: "workItem",
      stateSlug: "new",
      title: "WorkItem ACME",
      fields: { source: "Inbound" },
      customFieldValues: { source: "Inbound" }
    };
    const signalInput: CreateCommercialWorkItemInput = {
      ...workItemInput,
      typeSlug: "signal",
      title: "Signal ACME"
    };

    await createCommercialWorkItemMutationRequest("workspace-1", workItemInput);
    await createCommercialWorkItemMutationRequest("workspace-1", signalInput);

    expect(commercialService.createCommercialWorkItem).toHaveBeenNthCalledWith(1, "workspace-1", workItemInput);
    expect(commercialService.createCommercialWorkItem).toHaveBeenNthCalledWith(2, "workspace-1", signalInput);
  });

  it("moves a workItem in the flow through the flow mutation request", async () => {
    vi.mocked(commercialService.moveCommercialWorkItem).mockResolvedValue({ id: "workItem-1" } as never);

    await moveCommercialWorkItemInFlowMutationRequest("workspace-1", {
      workItemId: "workItem-1",
      stateSlug: "proposal"
    });

    expect(commercialService.moveCommercialWorkItem).toHaveBeenCalledWith("workspace-1", {
      workItemId: "workItem-1",
      stateSlug: "proposal"
    });
  });
});
