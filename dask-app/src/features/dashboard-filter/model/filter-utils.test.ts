import { describe, expect, it } from "vitest";
import { currentUserId, membersById } from "@/entities/member/model/mock-members";
import { factoryBoardConfig } from "@/entities/task/model/board-config";
import { initialTasks } from "@/entities/task/model/mock-tasks";
import { applyDashboardFilter } from "@/features/dashboard-filter/model/filter-utils";

describe("applyDashboardFilter", () => {
  it("filters by current user when mineOnly is enabled", () => {
    const filtered = applyDashboardFilter(
      initialTasks,
      { query: "", mineOnly: true },
      factoryBoardConfig,
      membersById,
      currentUserId
    );

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((task) => task.assignee === currentUserId)).toBe(true);
  });

  it("filters by query across title and metadata", () => {
    const filtered = applyDashboardFilter(
      initialTasks,
      { query: "growth", mineOnly: false },
      factoryBoardConfig,
      membersById,
      currentUserId
    );

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((task) => task.id === "t-101")).toBe(true);
  });
});
