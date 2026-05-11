import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateTaskInput, WorkspaceSnapshot } from "@/modules/workspace/model";
import { workspaceService } from "@/modules/workspace/api";
import { applyOptimisticMove, createWorkItemMutationRequest } from "@/modules/workspace/query/workspace-queries";

vi.mock("@/modules/workspace/api", () => ({
  workspaceService: {
    createTask: vi.fn()
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

describe("workspace work item mutations", () => {
  it("delegates work item creation to the workspace service with the resolved workspace", async () => {
    const snapshot = { id: "workspace-1", tasks: [] } as unknown as WorkspaceSnapshot;
    vi.mocked(workspaceService.createTask).mockResolvedValue(snapshot);

    const input = {
      title: "Novo item",
      type: "task",
      statusId: "todo"
    } as CreateTaskInput;

    await expect(createWorkItemMutationRequest("workspace-1", input)).resolves.toBe(snapshot);

    expect(workspaceService.createTask).toHaveBeenCalledWith("workspace-1", input);
  });

  it("applies an optimistic move by workflow state id and preserves other items", () => {
    const snapshot = {
      tasks: [
        { id: "item-1", status: "todo", title: "Mover", position: 0 },
        { id: "item-2", status: "todo", title: "Parado", position: 1 }
      ],
      workflowStates: [
        { id: "state-done", slug: "done" }
      ]
    } as unknown as WorkspaceSnapshot;

    const next = applyOptimisticMove(snapshot, {
      taskId: "item-1",
      columnId: "column-done",
      stateId: "state-done",
      position: 3
    });

    expect(next.tasks).toEqual([
      expect.objectContaining({ id: "item-1", status: "done", position: 3 }),
      expect.objectContaining({ id: "item-2", status: "todo", position: 1 })
    ]);
  });
});
