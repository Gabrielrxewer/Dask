import { describe, expect, it } from "vitest";
import { compileAiAgentToAutomation, validateAiAgentGraph } from "./ai-agent-compiler";
import type { AiAgentDefinition } from "./ai-agent-definition";

function buildAgentDefinition(): AiAgentDefinition {
  return {
    key: "support-agent",
    name: "Support agent",
    graph: {
      nodes: [
        {
          id: "input",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { kind: "trigger", label: "Input", triggerType: "manual" }
        },
        {
          id: "rag",
          type: "rag",
          position: { x: 180, y: 0 },
          data: { kind: "rag", label: "RAG", source: "documentation", topK: 3 }
        },
        {
          id: "llm",
          type: "llm",
          position: { x: 360, y: 0 },
          data: { kind: "llm", label: "LLM", model: "gpt-4o-mini" }
        },
        {
          id: "output",
          type: "output",
          position: { x: 540, y: 0 },
          data: { kind: "output", label: "Output", outputType: "text_response" }
        }
      ],
      edges: [
        { id: "e1", source: "input", target: "rag" },
        { id: "e2", source: "rag", target: "llm" },
        { id: "e3", source: "llm", target: "output" }
      ]
    },
    model: { model: "gpt-4o-mini", temperature: 0.2 },
    prompt: { systemPrompt: "Answer with workspace context." },
    rag: {
      enabled: true,
      source: "documentation",
      topKContextDocs: 5
    },
    output: { outputType: "text_response" }
  };
}

describe("compileAiAgentToAutomation", () => {
  it("compiles specialized AI graph nodes into automation runtime nodes", () => {
    const compiled = compileAiAgentToAutomation(buildAgentDefinition());

    expect(compiled.issues).toEqual([]);
    expect(compiled.definition.source).toEqual({
      kind: "ai-agent",
      key: "support-agent",
      name: "Support agent"
    });
    expect(compiled.definition.schemaVersion).toBe(1);
    expect(compiled.definition.definitionType).toBe("automation_workflow");
    expect(compiled.definition.graph.nodes.map((node) => node.type)).toEqual([
      "trigger",
      "ai_summarize_context",
      "ai_generate_message_draft",
      "end"
    ]);
    expect(compiled.definition.settings?.supportsParallelBranches).toBe(true);
  });

  it("reports invalid edges before publish/run", () => {
    const agent = buildAgentDefinition();
    agent.graph.edges = [{ id: "broken", source: "input", target: "missing" }];

    expect(validateAiAgentGraph(agent.graph)).toContain("Conexao broken aponta para node inexistente.");
  });
});
