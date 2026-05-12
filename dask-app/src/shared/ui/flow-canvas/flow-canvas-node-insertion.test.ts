import { describe, expect, it } from "vitest";
import { createFlowCanvasNode, type FlowCanvasPaletteItem } from "./flow-canvas-node-insertion";

interface TestNodeData extends Record<string, unknown> {
  label: string;
  config: { enabled: boolean };
}

describe("FlowCanvas node insertion", () => {
  it("creates a node at the projected drop position with palette data", () => {
    const item: FlowCanvasPaletteItem<"email", TestNodeData> = {
      kind: "email",
      label: "Enviar email",
      description: "Dispara uma mensagem",
      color: "#2563eb",
      buildData: () => ({ label: "Enviar email", config: { enabled: true } })
    };

    const node = createFlowCanvasNode(item, { x: 120, y: 240 }, "email-test");

    expect(node).toMatchObject({
      id: "email-test",
      type: "email",
      position: { x: 120, y: 240 },
      data: { label: "Enviar email", config: { enabled: true } },
      deletable: true
    });
  });

  it("keeps non-deletable palette nodes blocked from deletion", () => {
    const item: FlowCanvasPaletteItem<"trigger", TestNodeData> = {
      kind: "trigger",
      label: "Gatilho",
      description: "Inicia o fluxo",
      color: "#64748b",
      deletable: false,
      buildData: () => ({ label: "Gatilho", config: { enabled: true } })
    };

    const node = createFlowCanvasNode(item, { x: 0, y: 0 }, "trigger-test");

    expect(node.deletable).toBe(false);
  });
});
