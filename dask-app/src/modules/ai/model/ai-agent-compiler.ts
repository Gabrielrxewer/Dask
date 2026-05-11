import type { Edge } from "@xyflow/react";
import type {
  AutomationWorkflowGraph,
  AutomationWorkflowGraphEdge,
  AutomationWorkflowGraphNode
} from "@/modules/workspace/model";
import { automationGraphToWorkflowDefinition, type AutomationWorkflowDefinition } from "@/modules/automation/model";
import type { AiAgentDefinition } from "./ai-agent-definition";
import type { AiAgentGraph, AiAgentNode } from "./ai-agent-graph";

export interface CompiledAiAgentAutomation {
  definition: AutomationWorkflowDefinition;
  issues: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compileNode(node: AiAgentNode, definition: AiAgentDefinition): AutomationWorkflowGraphNode {
  const data: Record<string, unknown> = isRecord(node.data) ? node.data : {};
  const label = typeof data.label === "string" ? data.label : node.type ?? "AI node";

  if (node.type === "trigger") {
    return {
      id: node.id,
      type: "trigger",
      label,
      config: {
        triggerType: data.triggerType ?? "manual",
        source: "ai-agent",
        agentKey: definition.key
      },
      position: node.position
    };
  }

  if (node.type === "rag") {
    return {
      id: node.id,
      type: "ai_summarize_context",
      label,
      config: {
        workItemId: "{{event.payload.itemId}}",
        include: [data.source ?? definition.rag?.source ?? "documentation"],
        topKContextDocs: data.topK ?? definition.rag?.topKContextDocs,
        contextInstruction: data.contextInstruction ?? definition.rag?.contextInstruction,
        includeSemanticContext: data.includeSemanticContext ?? definition.rag?.includeSemanticContext,
        includeLinkedDocuments: data.includeLinkedDocuments ?? definition.rag?.includeLinkedDocuments
      },
      position: node.position
    };
  }

  if (node.type === "llm") {
    return {
      id: node.id,
      type: "ai_generate_message_draft",
      label,
      config: {
        model: data.model ?? definition.model.model,
        temperature: data.temperature ?? definition.model.temperature,
        systemPrompt: data.systemPrompt ?? definition.prompt.systemPrompt,
        goal: "{{event.payload.instruction}}",
        contextSummary: "{{previousOutput.summary}}",
        channel: "internal"
      },
      position: node.position
    };
  }

  if (node.type === "condition") {
    return {
      id: node.id,
      type: "condition",
      label,
      config: {
        expression: data.condition ?? "true"
      },
      position: node.position
    };
  }

  if (node.type === "output") {
    return {
      id: node.id,
      type: "end",
      label,
      config: {
        outputType: data.outputType ?? definition.output?.outputType ?? "text_response"
      },
      position: node.position
    };
  }

  if (node.type === "tool") {
    return {
      id: node.id,
      type: "noop",
      label,
      config: {
        source: "ai-agent-tool",
        toolId: data.toolId,
        note: "Tool binding preserved for runtime adapter."
      },
      position: node.position
    };
  }

  return {
    id: node.id,
    type: "noop",
    label,
    config: {
      source: "ai-agent",
      originalKind: node.type,
      data
    },
    position: node.position
  };
}

function compileEdge(edge: Edge, index: number): AutomationWorkflowGraphEdge {
  return {
    id: edge.id || `ai-agent-edge-${index + 1}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null
  };
}

export function validateAiAgentGraph(graph: AiAgentGraph): string[] {
  const issues: string[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const triggers = graph.nodes.filter((node) => node.type === "trigger");
  const outputs = graph.nodes.filter((node) => node.type === "output");

  if (triggers.length === 0) issues.push("Adicione um trigger ao agente.");
  if (triggers.length > 1) issues.push("Use apenas um trigger por agente nesta versao.");
  if (outputs.length === 0) issues.push("Adicione um node de saida ao agente.");

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push(`Conexao ${edge.id} aponta para node inexistente.`);
    }
  }

  return issues;
}

export function compileAiAgentToAutomation(definition: AiAgentDefinition): CompiledAiAgentAutomation {
  const issues = validateAiAgentGraph(definition.graph);
  const graph: AutomationWorkflowGraph = {
    version: 1,
    nodes: definition.graph.nodes.map((node) => compileNode(node, definition)),
    edges: definition.graph.edges.map(compileEdge),
    metadata: {
      source: "ai-agent",
      agentKey: definition.key,
      compilerVersion: 1
    }
  };

  return {
    definition: automationGraphToWorkflowDefinition({
      graph,
      source: {
        kind: "ai-agent",
        key: definition.key,
        name: definition.name
      },
      trigger: {
        type: "ai-agent",
        config: {
          agentKey: definition.key
        }
      },
      settings: {
        executionMode: "automation-runtime",
        supportsParallelBranches: true
      },
      metadata: {
        agentKey: definition.key,
        agentName: definition.name,
        compilerVersion: 1
      }
    }),
    issues
  };
}

export const aiAgentGraphToAutomationDefinition = compileAiAgentToAutomation;
export const compileAiAgentToAutomationDefinition = compileAiAgentToAutomation;
