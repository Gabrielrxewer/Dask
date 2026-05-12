import { describe, expect, it } from "vitest";
import { compileJourneyGraphToAutomationDefinition } from "./marketing-journey.compiler";

const campaignId = "550e8400-e29b-41d4-a716-446655440000";

type TestNodeKind = "TRIGGER" | "CONDITION" | "DELAY" | "ACTION" | "EXIT";

function node(id: string, kind: TestNodeKind, config: Record<string, unknown>) {
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
    expect(result.runtimeGraph).not.toBeNull();
    expect(result.automationDefinition).not.toBeNull();
    if (!result.runtimeGraph || !result.automationDefinition) {
      throw new Error("Expected runtime graph and automation definition.");
    }

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
      flowId: "journey-1",
      refId: "journey-1",
      name: "Jornada de nutricao"
    });
    expect(result.automationDefinition.executionPlan).toMatchObject({
      entryNodeIds: ["trigger"],
      terminalNodeIds: ["exit"]
    });
  });

  it("compiles condition branches with explicit runtime edge conditions", () => {
    const result = compileJourneyGraphToAutomationDefinition(
      [
        node("trigger", "TRIGGER", { event: "commercial_work_item.score_updated" }),
        node("branch", "CONDITION", {
          logic: "AND",
          rules: [{ field: "contact.score", operator: "gte", value: 80 }]
        }),
        node("send", "ACTION", { type: "send_campaign", campaignId }),
        node("low", "EXIT", { reason: "low score" }),
        node("done", "EXIT", { reason: "done" })
      ],
      [
        { id: "e1", source: "trigger", target: "branch" },
        { id: "e2", source: "branch", target: "send", sourceHandle: "yes", data: { branchType: "yes" } },
        { id: "e3", source: "branch", target: "low", sourceHandle: "no", data: { branchType: "no" } },
        { id: "e4", source: "send", target: "done" }
      ],
      {
        flowId: "journey-branch",
        workspaceId: "workspace-1",
        name: "Jornada com branch",
        now: "2026-05-11T12:00:00.000Z"
      }
    );

    expect(result.errors).toEqual([]);
    expect(result.runtimeGraph?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "branch",
        type: "condition",
        config: expect.objectContaining({
          metadata: { source: "marketing_journey" }
        })
      })
    ]));
    expect(result.runtimeGraph?.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "e2", condition: { branchType: "yes" } }),
      expect.objectContaining({ id: "e3", condition: { branchType: "no" } })
    ]));
  });

  it("blocks runtime generation when there is no trigger", () => {
    const result = compileJourneyGraphToAutomationDefinition(
      [
        node("send", "ACTION", { type: "send_campaign", campaignId }),
        node("exit", "EXIT", { reason: "done" })
      ],
      [{ id: "e1", source: "send", target: "exit" }],
      { name: "Sem gatilho" }
    );

    expect(result.runtimeGraph).toBeNull();
    expect(result.errors.map((entry) => entry.code)).toContain("trigger_required");
  });

  it("blocks runtime generation when an edge points to a missing node", () => {
    const result = compileJourneyGraphToAutomationDefinition(
      [
        node("trigger", "TRIGGER", { event: "manual" }),
        node("exit", "EXIT", { reason: "done" })
      ],
      [{ id: "broken", source: "trigger", target: "missing" }],
      { name: "Edge quebrada" }
    );

    expect(result.runtimeGraph).toBeNull();
    expect(result.errors.map((entry) => entry.code)).toContain("invalid_edge");
  });

  it("blocks runtime generation when a branch is missing a destination", () => {
    const result = compileJourneyGraphToAutomationDefinition(
      [
        node("trigger", "TRIGGER", { event: "manual" }),
        node("branch", "CONDITION", {
          logic: "AND",
          rules: [{ field: "contact.score", operator: "gte", value: 80 }]
        }),
        node("send", "ACTION", { type: "send_campaign", campaignId })
      ],
      [
        { id: "e1", source: "trigger", target: "branch" },
        { id: "e2", source: "branch", target: "send", sourceHandle: "yes", data: { branchType: "yes" } }
      ],
      { name: "Branch incompleta" }
    );

    expect(result.runtimeGraph).toBeNull();
    expect(result.errors.map((entry) => entry.code)).toContain("branch_no_target_required");
  });

  it("blocks runtime generation when a supported action is incomplete", () => {
    const result = compileJourneyGraphToAutomationDefinition(
      [
        node("trigger", "TRIGGER", { event: "manual" }),
        node("send", "ACTION", { type: "send_campaign" }),
        node("exit", "EXIT", { reason: "done" })
      ],
      [
        { id: "e1", source: "trigger", target: "send" },
        { id: "e2", source: "send", target: "exit" }
      ],
      { name: "Action incompleta" }
    );

    expect(result.runtimeGraph).toBeNull();
    expect(result.errors.map((entry) => entry.code)).toContain("send_campaign_requires_campaign");
  });

  it("blocks runtime generation for actions not supported by the backend runtime", () => {
    const result = compileJourneyGraphToAutomationDefinition(
      [
        node("trigger", "TRIGGER", { event: "manual" }),
        node("score", "ACTION", { type: "update_score", scoreChange: 10 }),
        node("exit", "EXIT", { reason: "done" })
      ],
      [
        { id: "e1", source: "trigger", target: "score" },
        { id: "e2", source: "score", target: "exit" }
      ],
      { name: "Action pendente" }
    );

    expect(result.runtimeGraph).toBeNull();
    expect(result.errors.map((entry) => entry.code)).toContain("action_not_supported");
  });
});
