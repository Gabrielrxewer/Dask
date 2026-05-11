import { describe, expect, it } from "vitest";
import {
  aiAgentCompiledConfigSchema,
  aiAgentLlmNodeDataSchema,
  aiAgentMetaFormSchema,
  aiAgentNodeDataSchema,
  normalizeAiAgentKey,
  validateAiAgentNodeConfigs
} from "./ai-agent-config.schema";

describe("AI agent config schemas", () => {
  it("normalizes human-readable agent keys before validation", () => {
    expect(normalizeAiAgentKey(" Atendimento Premium!! ")).toBe("atendimento-premium");

    const parsed = aiAgentMetaFormSchema.parse({
      name: "Atendimento Premium",
      key: "Atendimento Premium!!",
      isActive: true
    });

    expect(parsed).toMatchObject({
      name: "Atendimento Premium",
      key: "atendimento-premium",
      description: "",
      isActive: true
    });
  });

  it("rejects invalid LLM node model configuration", () => {
    expect(aiAgentLlmNodeDataSchema.safeParse({
      kind: "llm",
      label: "LLM",
      model: "",
      temperature: 0.2,
      systemPrompt: "Responda com contexto."
    }).success).toBe(false);

    expect(aiAgentLlmNodeDataSchema.safeParse({
      kind: "llm",
      label: "LLM",
      model: "gpt-4.1-mini",
      temperature: 3,
      systemPrompt: "Responda com contexto."
    }).success).toBe(false);

    expect(aiAgentLlmNodeDataSchema.safeParse({
      kind: "llm",
      label: "LLM",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      systemPrompt: "Responda com contexto."
    }).success).toBe(true);
  });

  it("keeps compiled runtime config constrained to automation executor payloads", () => {
    expect(aiAgentCompiledConfigSchema.safeParse({
      automationRuntime: {
        executor: "automation",
        compilerVersion: 1,
        validationIssues: [],
        definition: { definitionType: "automation_workflow" }
      }
    }).success).toBe(true);

    expect(aiAgentCompiledConfigSchema.safeParse({
      automationRuntime: {
        executor: "browser",
        compilerVersion: 1,
        validationIssues: [],
        definition: {}
      }
    }).success).toBe(false);
  });

  it("reports invalid node config messages once per invalid field", () => {
    const issues = validateAiAgentNodeConfigs([
      {
        id: "tool-1",
        type: "tool",
        data: { kind: "tool", label: "Tool", toolId: "" }
      }
    ]);

    expect(issues).toContain("Selecione uma ferramenta para o node Tool.");
    expect(aiAgentNodeDataSchema.safeParse({ kind: "output", label: "Saida", outputType: "text_response" }).success).toBe(true);
  });
});
