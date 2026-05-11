import { describe, expect, it } from "vitest";
import { compileJourneyGraphToAutomationDefinition } from "./marketing-journey.compiler";

const campaignId = "550e8400-e29b-41d4-a716-446655440000";

function node(id: string, kind: "TRIGGER" | "DELAY" | "ACTION" | "EXIT", config: Record<string, unknown>) {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: {
      kind,
      label: id,
      validation: "valid",
      config
    }
  };
}

describe("compileJourneyGraphToAutomationDefinition", () => {
  it("compiles a marketing journey into an automation runtime definition", () => {
    const result = compileJourneyGraphToAutomationDefinition(
      [
        node("trigger", "TRIGGER", { event: "manual" }),
        node("delay", "DELAY", { duration: 1, unit: "days" }),
        node("send", "ACTION", { type: "send_campaign", campaignId }),
        node("exit", "EXIT", { reason: "done" })
      ],
      [
        { id: "e1", source: "trigger", target: "delay" },
        { id: "e2", source: "delay", target: "send" },
        { id: "e3", source: "send", target: "exit" }
      ],
      {
        flowId: "journey-1",
        workspaceId: "workspace-1",
        name: "Jornada de nutricao",
        now: "2026-05-11T12:00:00.000Z"
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.runtimeGraph.nodes.map((entry) => entry.type)).toEqual([
      "trigger",
      "delay",
      "communication_send",
      "end"
    ]);
    expect(result.runtimeGraph.nodes[2]?.config).toMatchObject({
      channel: "email",
      templateKey: campaignId,
      metadata: {
        source: "marketing_journey",
        marketingCampaignId: campaignId
      }
    });
    expect(result.automationDefinition.definitionType).toBe("automation_workflow");
    expect(result.automationDefinition.source).toMatchObject({
      kind: "marketing_journey",
      refId: "journey-1",
      name: "Jornada de nutricao"
    });
    expect(result.automationDefinition.executionPlan).toMatchObject({
      entryNodeIds: ["trigger"],
      terminalNodeIds: ["exit"]
    });
  });
});
