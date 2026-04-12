import { describe, expect, it } from "vitest";
import { createInitialWorkspaceSnapshot } from "@/modules/workspace/model/mock-workspace";
import {
  createTaskInWorkspaceSnapshot,
  setCardFieldVisibilityInWorkspaceSnapshot,
  toggleTaskChecklistItemInWorkspaceSnapshot,
  updateTaskCustomFieldInWorkspaceSnapshot
} from "@/modules/workspace/model/snapshot-mutations";

describe("workspace snapshot mutations", () => {
  it("creates a task at the top of the snapshot without mutating existing tasks", () => {
    const snapshot = createInitialWorkspaceSnapshot();
    const originalFirstTaskId = snapshot.tasks[0]?.id;

    const nextSnapshot = createTaskInWorkspaceSnapshot(snapshot, {
      type: "Bug",
      title: "  Corrigir pipeline de importacao  ",
      description: "  Garantir reprocessamento seguro  ",
      priority: 1
    });

    expect(nextSnapshot.tasks).toHaveLength(snapshot.tasks.length + 1);
    expect(nextSnapshot.tasks[0]?.title).toBe("Corrigir pipeline de importacao");
    expect(nextSnapshot.tasks[0]?.type).toBe("bug");
    expect(nextSnapshot.tasks[1]?.id).toBe(originalFirstTaskId);
    expect(snapshot.tasks[0]?.id).toBe(originalFirstTaskId);
  });

  it("keeps board config and preferences in sync when card field visibility changes", () => {
    const snapshot = createInitialWorkspaceSnapshot();

    const nextSnapshot = setCardFieldVisibilityInWorkspaceSnapshot(snapshot, "severity", false);

    expect(nextSnapshot.boardConfig.cardLayout.visibleFieldIds).not.toContain("severity");
    expect(nextSnapshot.preferences.visibleCardFieldIds).not.toContain("severity");
    expect(snapshot.boardConfig.cardLayout.visibleFieldIds).toContain("severity");
  });

  it("updates only the targeted task custom field and checklist item", () => {
    const snapshot = createInitialWorkspaceSnapshot();
    const task = snapshot.tasks[0];
    const checklistItem = task.checklist.items[0];

    const taskFieldSnapshot = updateTaskCustomFieldInWorkspaceSnapshot(snapshot, task.id, "environment", "Production");
    const checklistSnapshot = toggleTaskChecklistItemInWorkspaceSnapshot(snapshot, task.id, checklistItem.id);

    expect(taskFieldSnapshot.tasks[0]?.customFields.environment).toBe("Production");
    expect(taskFieldSnapshot.tasks[0]?.checklist.items[0]?.done).toBe(checklistItem.done);
    expect(checklistSnapshot.tasks[0]?.checklist.items[0]?.done).toBe(!checklistItem.done);
    expect(snapshot.tasks[0]?.customFields.environment).toBe(task.customFields.environment);
    expect(snapshot.tasks[0]?.checklist.items[0]?.done).toBe(checklistItem.done);
  });
});
