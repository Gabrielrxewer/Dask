import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { workspaceService } from "@/modules/workspace/api";
import { workspaceQueryKeys } from "@/modules/workspace/query";
import {
  automationsQueryKeys,
  invalidateAutomationWorkspaceQueries,
  publishAutomationVersionMutationRequest,
  setAutomationWorkflowStatusMutationRequest
} from "@/modules/automation/query";

vi.mock("@/modules/workspace/api", () => ({
  workspaceService: {
    activateAutomationWorkflow: vi.fn(),
    pauseAutomationWorkflow: vi.fn(),
    archiveAutomationWorkflow: vi.fn(),
    publishAutomationWorkflowVersion: vi.fn()
  }
}));

vi.mock("@/shared/ui/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

describe("automation mutations", () => {
  it("publishes a workflow version through the automation runtime service", async () => {
    vi.mocked(workspaceService.publishAutomationWorkflowVersion).mockResolvedValue({ id: "version-1" } as never);

    await publishAutomationVersionMutationRequest("workspace-a", {
      workflowId: "workflow-1",
      versionId: "version-1",
      activateWorkflow: true
    });

    expect(workspaceService.publishAutomationWorkflowVersion).toHaveBeenCalledWith(
      "workspace-a",
      "workflow-1",
      "version-1",
      { activateWorkflow: true }
    );
  });

  it("routes activate status changes to the workflow activation endpoint", async () => {
    vi.mocked(workspaceService.activateAutomationWorkflow).mockResolvedValue({ id: "workflow-1" } as never);

    await setAutomationWorkflowStatusMutationRequest("workspace-a", {
      workflowId: "workflow-1",
      status: "active"
    });

    expect(workspaceService.activateAutomationWorkflow).toHaveBeenCalledWith("workspace-a", "workflow-1");
    expect(workspaceService.pauseAutomationWorkflow).not.toHaveBeenCalled();
    expect(workspaceService.archiveAutomationWorkflow).not.toHaveBeenCalled();
  });

  it("invalidates automation and workspace cache scopes together", () => {
    const queryClient = {
      invalidateQueries: vi.fn()
    } as unknown as QueryClient;

    invalidateAutomationWorkspaceQueries(queryClient, "workspace-a");

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: automationsQueryKeys.workspace("workspace-a")
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.workspace("workspace-a")
    });
  });
});
