import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { applyLayeredFlowLayout } from "./flow-layout";

describe("applyLayeredFlowLayout", () => {
  it("keeps manual data and positions connected nodes by graph depth", () => {
    const nodes: Node[] = [
      { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: { label: "Trigger" } },
      { id: "branch", type: "condition", position: { x: 0, y: 0 }, data: { label: "Branch" } },
      { id: "end", type: "end", position: { x: 0, y: 0 }, data: { label: "End" } }
    ];
    const edges: Edge[] = [
      { id: "e1", source: "trigger", target: "branch" },
      { id: "e2", source: "branch", target: "end" }
    ];

    const laidOut = applyLayeredFlowLayout(nodes, edges, {
      origin: { x: 10, y: 20 },
      columnGap: 100,
      rowGap: 80
    });

    expect(laidOut.find((node) => node.id === "trigger")?.position.x).toBe(10);
    expect(laidOut.find((node) => node.id === "branch")?.position.x).toBe(110);
    expect(laidOut.find((node) => node.id === "end")?.position.x).toBe(210);
    expect(laidOut.find((node) => node.id === "branch")?.data).toEqual({ label: "Branch" });
  });
});
