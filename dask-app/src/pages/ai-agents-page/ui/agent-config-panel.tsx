import type { CSSProperties, ReactNode } from "react";
import type { AiCapabilities } from "@/modules/workspace/model";
import { SidePanel } from "@/shared/ui";
import type {
  AgentFlowNode,
  AgentNodeData,
  AgentNodeKind,
  ConditionNodeData,
  LlmNodeData,
  OutputNodeData,
  OutputType,
  RagNodeData,
  RagSource,
  ToolId,
  ToolNodeData,
  TriggerNodeData
} from "./agent-flow-types";
import { getNodeColor, NODE_KIND_META } from "./agent-flow-types";
import "./agent-config-panel.css";

export interface AgentMetaForm {
  name: string;
  key: string;
  description: string;
  isActive: boolean;
  isCreateMode: boolean;
}

interface ConfigPanelProps {
  node: AgentFlowNode | null;
  agent: AgentMetaForm | null;
  capabilities: AiCapabilities;
  onClose: () => void;
  onNodeDataChange: (nodeId: string, data: AgentNodeData) => void;
  onAgentMetaChange: (patch: Partial<Omit<AgentMetaForm, "isCreateMode">>) => void;
}

export function AgentConfigPanel({
  node,
  agent,
  capabilities,
  onClose,
  onNodeDataChange,
  onAgentMetaChange
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
        <AgentMetaConfig data={agent} patch={onAgentMetaChange} />
      </SidePanel>
    );
  }

  if (!node) return null;
  const meta = NODE_KIND_META.find((item) => item.kind === node.type);
  const color = getNodeColor(node.type as AgentNodeKind);

  function patch<T extends AgentNodeData>(partial: Partial<T>) {
    onNodeDataChange(node!.id, { ...node!.data, ...partial } as AgentNodeData);
  }

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
      {node.type === "trigger" ? <TriggerConfig data={node.data as TriggerNodeData} patch={patch} /> : null}
      {node.type === "llm" ? <LlmConfig data={node.data as LlmNodeData} patch={patch} capabilities={capabilities} /> : null}
      {node.type === "rag" ? <RagConfig data={node.data as RagNodeData} patch={patch} capabilities={capabilities} /> : null}
      {node.type === "tool" ? <ToolConfig data={node.data as ToolNodeData} patch={patch} capabilities={capabilities} /> : null}
      {node.type === "condition" ? <ConditionConfig data={node.data as ConditionNodeData} patch={patch} /> : null}
      {node.type === "output" ? <OutputConfig data={node.data as OutputNodeData} patch={patch} /> : null}
    </SidePanel>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="acp__field">
      <label className="acp__field-label">{label}</label>
      {children}
      {hint ? <span className="acp__field-hint">{hint}</span> : null}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  step,
  min,
  max,
  disabled
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <input
      className="acp__input"
      type={type}
      step={step}
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      className="acp__textarea"
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

function SelectField({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select className="acp__select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`acp__toggle${disabled ? " acp__toggle--disabled" : ""}`}>
      <div
        className={`acp__toggle-track${checked ? " acp__toggle-track--on" : ""}`}
        onClick={() => !disabled && onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(event) => event.key === "Enter" && !disabled && onChange(!checked)}
      >
        <div className="acp__toggle-thumb" />
      </div>
      <span>{label}</span>
    </label>
  );
}

function AgentMetaConfig({
  data,
  patch
}: {
  data: AgentMetaForm;
  patch: (patch: Partial<Omit<AgentMetaForm, "isCreateMode">>) => void;
}) {
  return (
    <div className="acp__form">
      <Field label="Nome do agente">
        <Input value={data.name} onChange={(value) => patch({ name: value })} placeholder="Ex.: Assistente Revenue Ops" />
      </Field>
      <Field label="Chave do agente" hint={data.isCreateMode ? "Gerada a partir do nome, mas pode ser ajustada antes de salvar." : "A chave fica fixa depois da criacao."}>
        <Input value={data.key} onChange={(value) => patch({ key: value })} placeholder="assistente-revenue-ops" disabled={!data.isCreateMode} />
      </Field>
      <Field label="Descricao">
        <Textarea rows={5} value={data.description} onChange={(value) => patch({ description: value })} placeholder="Descreva quando este agente deve ser usado..." />
      </Field>
      <Toggle checked={data.isActive} onChange={(value) => patch({ isActive: value })} label={data.isActive ? "Agente ativo" : "Agente inativo"} />
    </div>
  );
}

function TriggerConfig({ data, patch }: { data: TriggerNodeData; patch: (patch: Partial<TriggerNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do no">
        <Input value={data.label} onChange={(value) => patch({ label: value })} placeholder="Disparador" />
      </Field>
      <Field label="Tipo de disparo">
        <SelectField
          value={data.triggerType}
          onChange={(value) => patch({ triggerType: value as TriggerNodeData["triggerType"] })}
          options={[
            { value: "manual", label: "Manual" },
            { value: "card_created", label: "Card criado" },
            { value: "card_updated", label: "Card atualizado" },
            { value: "card_status_changed", label: "Status alterado" }
          ]}
        />
      </Field>
      <InfoBox>O no Trigger e o ponto de entrada do fluxo. Apenas um e permitido.</InfoBox>
    </div>
  );
}

function LlmConfig({
  data,
  patch,
  capabilities
}: {
  data: LlmNodeData;
  patch: (patch: Partial<LlmNodeData>) => void;
  capabilities: AiCapabilities;
}) {
  return (
    <div className="acp__form">
      <Field label="Nome do no">
        <Input value={data.label} onChange={(value) => patch({ label: value })} placeholder="LLM" />
      </Field>
      <Field label="Modelo">
        <SelectField value={data.model || capabilities.defaults.model} onChange={(value) => patch({ model: value })} options={capabilities.models} />
      </Field>
      <Field label="Temperatura" hint="0 = deterministico; 2 = criativo">
        <Input
          type="number"
          step="0.1"
          min={0}
          max={2}
          value={data.temperature}
          onChange={(value) => patch({ temperature: parseFloat(value) || 0.2 })}
        />
      </Field>
      <Field label="System Prompt">
        <Textarea rows={8} value={data.systemPrompt} onChange={(value) => patch({ systemPrompt: value })} placeholder="Descreva o comportamento do agente..." />
      </Field>
    </div>
  );
}

function RagConfig({
  data,
  patch,
  capabilities
}: {
  data: RagNodeData;
  patch: (patch: Partial<RagNodeData>) => void;
  capabilities: AiCapabilities;
}) {
  const usesCards = data.source === "card" || data.source === "card_and_documentation";
  const ragEnabled = data.source !== "none";
  const topKOptions = capabilities.topKContextDocsOptions.map((value) => ({
    value: String(value),
    label: `${value} documentos`
  }));

  return (
    <div className="acp__form">
      <Field label="Nome do no">
        <Input value={data.label} onChange={(value) => patch({ label: value })} placeholder="Contexto" />
      </Field>
      <Field label="Fonte de contexto">
        <SelectField value={data.source} onChange={(value) => patch({ source: value as RagSource })} options={capabilities.ragSources} />
      </Field>
      <Field label="Documentos recuperados">
        <SelectField value={String(data.topK)} onChange={(value) => patch({ topK: parseInt(value, 10) })} options={topKOptions} />
      </Field>
      <Toggle checked={data.includeSemanticContext} onChange={(value) => patch({ includeSemanticContext: value })} label="Contexto semantico" disabled={!usesCards} />
      <Toggle checked={data.includeLinkedDocuments} onChange={(value) => patch({ includeLinkedDocuments: value })} label="Docs vinculadas ao card" disabled={!usesCards} />
      <Field label="Instrucao de contexto">
        <Textarea
          rows={4}
          value={data.contextInstruction}
          onChange={(value) => patch({ contextInstruction: value })}
          placeholder="Ex.: Priorize documentacao oficial..."
          disabled={!ragEnabled}
        />
      </Field>
    </div>
  );
}

function ToolConfig({
  data,
  patch,
  capabilities
}: {
  data: ToolNodeData;
  patch: (patch: Partial<ToolNodeData>) => void;
  capabilities: AiCapabilities;
}) {
  return (
    <div className="acp__form">
      <Field label="Nome do no">
        <Input value={data.label} onChange={(value) => patch({ label: value })} placeholder="Tool" />
      </Field>
      <Field label="Ferramenta">
        <div className="acp__tool-list">
          {capabilities.tools.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`acp__tool-item${data.toolId === option.value ? " acp__tool-item--active" : ""}`}
              onClick={() => patch({ toolId: option.value as ToolId })}
            >
              <span className="acp__tool-label">{option.label}</span>
              <span className="acp__tool-group">{option.group ?? "Tool"}</span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function ConditionConfig({ data, patch }: { data: ConditionNodeData; patch: (patch: Partial<ConditionNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do no">
        <Input value={data.label} onChange={(value) => patch({ label: value })} placeholder="Condicao" />
      </Field>
      <Field label="Expressao de condicao" hint="Descreva a condicao em linguagem natural.">
        <Textarea rows={4} value={data.condition} onChange={(value) => patch({ condition: value })} placeholder="Se o resultado contiver alta prioridade..." />
      </Field>
      <InfoBox>O no Condicao tem duas saidas: Verdadeiro e Falso.</InfoBox>
    </div>
  );
}

const OUTPUT_TYPE_OPTIONS = [
  { value: "text_response", label: "Texto ao usuario" },
  { value: "update_card", label: "Atualizar card" }
];

function OutputConfig({ data, patch }: { data: OutputNodeData; patch: (patch: Partial<OutputNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do no">
        <Input value={data.label} onChange={(value) => patch({ label: value })} placeholder="Resposta" />
      </Field>
      <Field label="Tipo de saida">
        <SelectField value={data.outputType} onChange={(value) => patch({ outputType: value as OutputType })} options={OUTPUT_TYPE_OPTIONS} />
      </Field>
      <InfoBox>O no Resposta e o ponto de saida do fluxo. Apenas um e permitido.</InfoBox>
    </div>
  );
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="acp__info-box">
      <svg viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
