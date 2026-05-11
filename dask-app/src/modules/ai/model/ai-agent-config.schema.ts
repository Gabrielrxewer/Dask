import { z } from "zod";

export function normalizeAiAgentKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

const agentKeySchema = z
  .string()
  .trim()
  .transform(normalizeAiAgentKey)
  .pipe(
    z
      .string()
      .min(2, "A chave precisa ter pelo menos 2 caracteres.")
      .max(80, "A chave pode ter no maximo 80 caracteres.")
      .regex(/^[a-z0-9-_]+$/, "Use apenas letras minusculas, numeros, hifen ou underline.")
  );

const nodeLabelSchema = z.string().trim().min(1, "Todo node precisa de nome.");

export const aiAgentMetaFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(120, "O nome pode ter no maximo 120 caracteres."),
  key: agentKeySchema,
  description: z.string().trim().max(500, "A descricao pode ter no maximo 500 caracteres.").default(""),
  isActive: z.boolean().default(true)
});

export const aiAgentModelConfigSchema = z.object({
  model: z.string().trim().min(1, "Selecione um modelo para o node LLM."),
  temperature: z.coerce
    .number()
    .min(0, "Temperatura do LLM deve ficar entre 0 e 2.")
    .max(2, "Temperatura do LLM deve ficar entre 0 e 2.")
});

export const aiAgentPromptConfigSchema = z.object({
  systemPrompt: z.string().default("")
});

export const aiAgentToolBindingSchema = z.object({
  toolId: z.string().trim().min(1, "Selecione uma ferramenta para o node Tool.")
});

export const aiAgentOutputConfigSchema = z.object({
  outputType: z.enum(["text_response", "update_card"], {
    error: "Selecione o tipo de saida."
  })
});

export const aiAgentTriggerNodeDataSchema = z.object({
  kind: z.literal("trigger"),
  label: nodeLabelSchema,
  triggerType: z.enum(["manual", "card_created", "card_updated", "card_status_changed"])
});

export const aiAgentLlmNodeDataSchema = z.object({
  kind: z.literal("llm"),
  label: nodeLabelSchema,
  model: aiAgentModelConfigSchema.shape.model,
  temperature: aiAgentModelConfigSchema.shape.temperature,
  systemPrompt: aiAgentPromptConfigSchema.shape.systemPrompt
});

export const aiAgentRagNodeDataSchema = z.object({
  kind: z.literal("rag"),
  label: nodeLabelSchema,
  source: z.enum(["none", "documentation", "card", "card_and_documentation"], {
    error: "Selecione a fonte de contexto do node RAG."
  }),
  topK: z.coerce.number().int().min(1, "Documentos recuperados deve ser maior que zero."),
  contextInstruction: z.string().default(""),
  includeSemanticContext: z.boolean().default(true),
  includeLinkedDocuments: z.boolean().default(true)
});

export const aiAgentToolNodeDataSchema = z.object({
  kind: z.literal("tool"),
  label: nodeLabelSchema,
  toolId: aiAgentToolBindingSchema.shape.toolId
});

export const aiAgentConditionNodeDataSchema = z.object({
  kind: z.literal("condition"),
  label: nodeLabelSchema,
  condition: z.string().trim().min(1, "Informe a condicao do node Condicao.")
});

export const aiAgentOutputNodeDataSchema = z.object({
  kind: z.literal("output"),
  label: nodeLabelSchema,
  outputType: aiAgentOutputConfigSchema.shape.outputType
});

export const aiAgentNodeDataSchema = z.discriminatedUnion("kind", [
  aiAgentTriggerNodeDataSchema,
  aiAgentLlmNodeDataSchema,
  aiAgentRagNodeDataSchema,
  aiAgentToolNodeDataSchema,
  aiAgentConditionNodeDataSchema,
  aiAgentOutputNodeDataSchema
]);

export const aiAgentRagConfigSchema = z.object({
  enabled: z.boolean().optional(),
  source: z.enum(["none", "documentation", "card", "card_and_documentation"]).optional(),
  contextInstruction: z.string().optional(),
  includeSemanticContext: z.boolean().optional(),
  includeLinkedDocuments: z.boolean().optional(),
  topKContextDocs: z.coerce.number().int().min(1).optional()
}).passthrough();

export const aiAgentToolsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  allowed: z.array(z.string()).optional(),
  nativeEnabled: z.boolean().optional(),
  nativeAllowed: z.array(z.string()).optional(),
  gptEnabled: z.boolean().optional(),
  gptAllowed: z.array(z.string()).optional()
}).passthrough();

export const aiAgentAutomationRuntimeConfigSchema = z.object({
  executor: z.literal("automation"),
  compilerVersion: z.coerce.number().int().min(1),
  validationIssues: z.array(z.string()),
  definition: z.unknown()
}).passthrough();

export const aiAgentCompiledConfigSchema = z.object({
  rag: aiAgentRagConfigSchema.optional(),
  tools: aiAgentToolsConfigSchema.optional(),
  flow: z.unknown().optional(),
  automationRuntime: aiAgentAutomationRuntimeConfigSchema.optional()
}).passthrough();

export type AiAgentMetaFormInput = z.input<typeof aiAgentMetaFormSchema>;
export type AiAgentMetaFormValues = z.infer<typeof aiAgentMetaFormSchema>;
export type AiAgentNodeDataFormValues = z.infer<typeof aiAgentNodeDataSchema>;
export type AiAgentCompiledConfigValues = z.infer<typeof aiAgentCompiledConfigSchema>;

export function validateAiAgentNodeConfigs(nodes: Array<{ data: unknown; id?: string; type?: string }>): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const result = aiAgentNodeDataSchema.safeParse(node.data);
    if (result.success) continue;

    for (const issue of result.error.issues) {
      const message = issue.message || `Configuracao invalida no node ${node.type ?? node.id ?? ""}.`.trim();
      if (seen.has(message)) continue;
      seen.add(message);
      issues.push(message);
    }
  }

  return issues;
}
