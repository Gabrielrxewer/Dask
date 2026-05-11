import { afterEach, describe, expect, it, vi } from "vitest";
import { leadsService } from "@/modules/leads/api";
import type { CreateCommercialWorkItemInput } from "@/modules/leads/model";
import {
  createCommercialWorkItemMutationRequest,
  moveLeadInFlowMutationRequest
} from "@/modules/leads/query/leads-mutations";

vi.mock("@/modules/leads/api", () => ({
  leadsService: {
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

describe("lead mutations", () => {
  it("creates lead and signal work items through the commercial service", async () => {
    vi.mocked(leadsService.createCommercialWorkItem).mockResolvedValue({ id: "item-1" } as never);

    const leadInput: CreateCommercialWorkItemInput = {
      typeSlug: "lead",
      stateSlug: "new",
      title: "Lead ACME",
      fields: { source: "Inbound" },
      customFieldValues: { source: "Inbound" }
    };
    const signalInput: CreateCommercialWorkItemInput = {
      ...leadInput,
      typeSlug: "signal",
      title: "Signal ACME"
    };

    await createCommercialWorkItemMutationRequest("workspace-1", leadInput);
    await createCommercialWorkItemMutationRequest("workspace-1", signalInput);

    expect(leadsService.createCommercialWorkItem).toHaveBeenNthCalledWith(1, "workspace-1", leadInput);
    expect(leadsService.createCommercialWorkItem).toHaveBeenNthCalledWith(2, "workspace-1", signalInput);
  });

  it("moves a lead in the flow through the flow mutation request", async () => {
    vi.mocked(leadsService.moveCommercialWorkItem).mockResolvedValue({ id: "lead-1" } as never);

    await moveLeadInFlowMutationRequest("workspace-1", {
      workItemId: "lead-1",
      stateSlug: "proposal"
    });

    expect(leadsService.moveCommercialWorkItem).toHaveBeenCalledWith("workspace-1", {
      workItemId: "lead-1",
      stateSlug: "proposal"
    });
  });
});
