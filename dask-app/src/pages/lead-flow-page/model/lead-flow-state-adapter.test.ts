import { describe, expect, it } from "vitest";
import type { Task } from "@/entities/task";
import { createLeadFlowMoveCommand, isLeadFlowReadonly } from "./lead-flow-state-adapter";

const lead = {
  id: "lead-1",
  title: "Lead ACME",
  status: "new",
  customFields: {}
} as Task;

describe("lead flow state adapter", () => {
  it("builds a move command only when the target status changes", () => {
    expect(createLeadFlowMoveCommand(lead, "proposal")).toEqual({
      workItemId: "lead-1",
      stateSlug: "proposal"
    });

    expect(createLeadFlowMoveCommand(lead, "new")).toBeNull();
    expect(createLeadFlowMoveCommand(lead, "")).toBeNull();
  });

  it("keeps client and viewer access read-only", () => {
    expect(isLeadFlowReadonly({ isClient: true })).toBe(true);
    expect(isLeadFlowReadonly({ role: "VIEWER" })).toBe(true);
    expect(isLeadFlowReadonly({ role: "OWNER" })).toBe(false);
  });
});
