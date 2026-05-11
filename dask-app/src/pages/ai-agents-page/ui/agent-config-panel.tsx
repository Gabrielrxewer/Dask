import type { CSSProperties } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  normalizeAiAgentKey,
  type AiAgentMetaFormInput,
  type AiAgentMetaFormValues
} from "@/modules/ai";
import type { AiCapabilities } from "@/modules/workspace/model";
import { AppForm, AppSwitchField, AppTextField, AppTextareaField, SidePanel } from "@/shared/ui";
import {
  createConditionExpressionNodeConfigDescriptor,
  createNodeLabelField,
  createOutputNodeConfigDescriptor,
  createTriggerNodeConfigDescriptor,
  NodeConfigForm,
  type NodeConfigDescriptor
} from "@/shared/flow-node-config";
import type {
  AgentFlowNode,
  AgentNodeData,
  AgentNodeKind,
  LlmNodeData,
  RagNodeData,
} from "./agent-flow-types";
import { getNodeColor, NODE_KIND_META } from "./agent-flow-types";
import "./agent-config-panel.css";

export interface AgentMetaForm {
  form: UseFormReturn<AiAgentMetaFormInput, unknown, AiAgentMetaFormValues>;
  isCreateMode: boolean;
}

interface ConfigPanelProps {
  node: AgentFlowNode | null;
  agent: AgentMetaForm | null;
  capabilities: AiCapabilities;
  onClose: () => void;
  onNodeDataChange: (nodeId: string, data: AgentNodeData) => void;
}

function buildNodeConfigDescriptor(node: AgentFlowNode, capabilities: AiCapabilities): NodeConfigDescriptor {
  if (node.type === "trigger") {
    return createTriggerNodeConfigDescriptor({
      type: "trigger",
      label: "Trigger",
      includeLabelField: true,
      eventFieldName: "triggerType",
      eventLabel: "Tipo de disparo",
      triggerOptions: [
        { value: "manual", label: "Manual" },
        { value: "card_created", label: "Card criado" },
        { value: "card_updated", label: "Card atualizado" },
        { value: "card_status_changed", label: "Status alterado" }
      ]
    });
  }

  if (node.type === "llm") {
    return {
      type: "llm",
      label: "LLM",
      fields: [
        createNodeLabelField(),
        { name: "model", label: "Modelo", type: "model-selector", required: true, options: capabilities.models },
        { name: "temperature", label: "Temperatura", type: "number", min: 0, max: 2, step: 0.1 },
        { name: "systemPrompt", label: "System Prompt", type: "textarea", rows: 8 }
      ]
    };
  }

  if (node.type === "rag") {
    const data = node.data as RagNodeData;
    const usesCards = data.source === "card" || data.source === "card_and_documentation";
    return {
      type: "rag",
      label: "Contexto",
      fields: [
        createNodeLabelField(),
        { name: "source", label: "Fonte de contexto", type: "select", required: true, options: capabilities.ragSources },
        {
          name: "topK",
          label: "Documentos recuperados",
          type: "select",
          required: true,
          options: capabilities.topKContextDocsOptions.map((value) => ({ value: String(value), label: `${value} documentos` }))
        },
        { name: "includeSemanticContext", label: "Contexto semantico", type: "boolean", disabled: !usesCards },
        { name: "includeLinkedDocuments", label: "Docs vinculadas ao card", type: "boolean", disabled: !usesCards },
        { name: "contextInstruction", label: "Instrucao de contexto", type: "textarea", rows: 4, disabled: data.source === "none" }
      ]
    };
  }

  if (node.type === "tool") {
    return {
      type: "tool",
      label: "Tool",
      fields: [
        createNodeLabelField(),
        { name: "toolId", label: "Ferramenta", type: "tool-selector", required: true, options: capabilities.tools }
      ]
    };
  }

  if (node.type === "condition") {
    return createConditionExpressionNodeConfigDescriptor({
      type: "condition",
      label: "Condicao",
      includeLabelField: true,
      expressionFieldName: "condition",
      expressionLabel: "Expressao de condicao"
    });
  }

  return createOutputNodeConfigDescriptor({
    type: "output",
    label: "Resposta",
    includeLabelField: true
  });
}

function normalizeNodeConfigValue(node: AgentFlowNode, value: Record<string, unknown>): AgentNodeData {
  if (node.type === "rag") {
    return {
      ...value,
      kind: "rag",
      topK: Number(value.topK) || 1
    } as RagNodeData;
  }
  if (node.type === "llm") {
    return {
      ...value,
      kind: "llm",
      temperature: Number(value.temperature) || 0
    } as LlmNodeData;
  }
  return { ...value, kind: node.type } as AgentNodeData;
}

export function AgentConfigPanel({
  node,
  agent,
  capabilities,
  onClose,
  onNodeDataChange
}: ConfigPanelProps) {
  if (!node && !agent) return null;

  if (agent) {
    return (
      <SidePanel
        className="acp"
        bodyClassName="acp__body"
        variant="config"
        titleId="ai-agent-meta-config"
        title={agent.isCreateMode ? "Novo agente" : "Agente"}
        description="Identidade e disponibilidade do agente"
        leading={<span className="acp__type-dot" aria-hidden="true" />}
        onClose={onClose}
        style={{ "--acp-color": "var(--primary)" } as CSSProperties}
      >
        <AgentMetaConfig form={agent.form} isCreateMode={agent.isCreateMode} />
      </SidePanel>
    );
  }

  if (!node) return null;
  const meta = NODE_KIND_META.find((item) => item.kind === node.type);
  const color = getNodeColor(node.type as AgentNodeKind);
  const descriptor = buildNodeConfigDescriptor(node, capabilities);

  return (
    <SidePanel
      className="acp"
      bodyClassName="acp__body"
      variant="config"
      titleId={`ai-agent-node-config-${node.id}`}
      title={meta?.label ?? node.type}
      description={meta?.description ?? ""}
      leading={<span className="acp__type-dot" aria-hidden="true" />}
      onClose={onClose}
      style={{ "--acp-color": color } as CSSProperties}
    >
      <NodeConfigForm
        descriptor={descriptor}
        value={node.data as Record<string, unknown>}
        onChange={(value) => onNodeDataChange(node.id, normalizeNodeConfigValue(node, value))}
        submitLabel="Aplicar"
      />
    </SidePanel>
  );
}

function AgentMetaConfig({
  form,
  isCreateMode
}: {
  form: UseFormReturn<AiAgentMetaFormInput, unknown, AiAgentMetaFormValues>;
  isCreateMode: boolean;
}) {
  const { setValue } = form;
  const isActive = form.watch("isActive");

  return (
    <AppForm<AiAgentMetaFormInput, AiAgentMetaFormValues>
      form={form}
      className="acp__form"
      onRawSubmit={(event) => event.preventDefault()}
    >
      <AppTextField
        name="name"
        label="Nome do agente"
        className="acp__field"
        placeholder="Ex.: Assistente Revenue Ops"
        autoFocus
        onValueChange={(value) => {
          if (isCreateMode) {
            setValue("key", normalizeAiAgentKey(value), {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true
            });
          }
        }}
      />

      <AppTextField
        name="key"
        label="Chave do agente"
        description={isCreateMode ? "Gerada a partir do nome, mas pode ser ajustada antes de salvar." : "A chave fica fixa depois da criacao."}
        className="acp__field"
        placeholder="assistente-revenue-ops"
        disabled={!isCreateMode}
        parseValue={normalizeAiAgentKey}
      />

      <AppTextareaField
        name="description"
        label="Descricao"
        className="acp__field"
        rows={5}
        placeholder="Descreva quando este agente deve ser usado..."
      />

      <AppSwitchField
        name="isActive"
        label={isActive ? "Agente ativo" : "Agente inativo"}
        className="acp__field"
      />
    </AppForm>
  );
}
