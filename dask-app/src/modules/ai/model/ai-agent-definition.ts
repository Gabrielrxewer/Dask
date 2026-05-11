import type { AiAgentConfig } from "@/modules/workspace/model";
import type { AiAgentGraph } from "./ai-agent-graph";

export interface AiAgentRagPipeline {
  enabled: boolean;
  source: "none" | "documentation" | "card" | "card_and_documentation";
  topKContextDocs: number;
  contextInstruction?: string;
  includeSemanticContext?: boolean;
  includeLinkedDocuments?: boolean;
}

export interface AiAgentToolBinding {
  toolId: string;
  group?: string;
}

export interface AiAgentPromptConfig {
  systemPrompt: string;
  instructionPath?: string;
}

export interface AiAgentModelConfig {
  model?: string;
  temperature?: number;
}

export interface AiAgentOutputConfig {
  outputType: "text_response" | "update_card";
}

export interface AiAgentDefinition {
  id?: string;
  key: string;
  name: string;
  description?: string | null;
  graph: AiAgentGraph;
  model: AiAgentModelConfig;
  prompt: AiAgentPromptConfig;
  rag?: AiAgentRagPipeline;
  tools?: AiAgentToolBinding[];
  output?: AiAgentOutputConfig;
  config?: AiAgentConfig;
}
