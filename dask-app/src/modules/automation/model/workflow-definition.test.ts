import { describe, expect, it } from "vitest";
import {
  automationGraphToWorkflowDefinition,
  buildAutomationExecutionPlan,
  maskAutomationDebugValue
} from "./workflow-definition";
import type { AutomationWorkflowGraph } from "@/modules/workspace/model";

const graph: AutomationWorkflowGraph = {
  version: 1,
  nodes: [
    { id: "trigger", type: "trigger", label: "Manual", config: { triggerType: "manual" }, position: { x: 0, y: 0 } },
    { id: "a", type: "communication_send", label: "A", config: { channel: "email", body: "A" }, position: { x: 200, y: 0 } },
    { id: "b", type: "communication_send", label: "B", config: { channel: "email", body: "B" }, position: { x: 200, y: 120 } },
    { id: "end", type: "end", label: "Fim", config: {}, position: { x: 400, y: 0 } }
  ],
  edges: [
    { id: "e1", source: "trigger", target: "a" },
    { id: "e2", source: "trigger", target: "b" },
    { id: "e3", source: "a", target: "end" },
    { id: "e4", source: "b", target: "end" }
  ],
  metadata: { viewport: { x: 1, y: 2, zoom: 1 } }
};

describe("automation workflow definition", () => {
  it("builds a versioned executable definition without dropping visual metadata", () => {
    const definition = automationGraphToWorkflowDefinition({
      graph,
      source: { kind: "marketing_journey", refId: "journey-1", name: "Boas-vindas" },
      trigger: { type: "manual" }
    });

    expect(definition.schemaVersion).toBe(1);
    expect(definition.definitionType).toBe("automation_workflow");
    expect(definition.source).toMatchObject({ kind: "marketing_journey", refId: "journey-1" });
    expect(definition.graph.nodes).toHaveLength(4);
    expect(definition.metadata?.visual).toEqual(graph.metadata);
    expect(definition.executionPlan.parallelGroups).toEqual([
      { sourceNodeId: "trigger", targetNodeIds: ["a", "b"] }
    ]);
  });

  it("detects entries, terminals and parallel fan-out", () => {
    expect(buildAutomationExecutionPlan(graph)).toMatchObject({
      schemaVersion: 1,
      entryNodeIds: ["trigger"],
      terminalNodeIds: ["end"],
      parallelGroups: [{ sourceNodeId: "trigger", targetNodeIds: ["a", "b"] }]
    });
  });

  it("masks sensitive debug traces recursively", () => {
    expect(maskAutomationDebugValue({
      token: "abc",
      nested: {
        prompt: "private instruction",
        safe: "ok"
      },
      events: [{ output: "private response", status: "failed" }]
    })).toEqual({
      token: "[masked]",
      nested: {
        prompt: "[masked]",
        safe: "ok"
      },
      events: [{ output: "[masked]", status: "failed" }]
    });
  });
});
