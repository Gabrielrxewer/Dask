import type {
  AgentFlowNode,
  AgentNodeKind,
  TriggerNodeData,
  LlmNodeData,
  RagNodeData,
  ToolNodeData,
  ConditionNodeData,
  OutputNodeData,
  AgentNodeData,
  RagSource,
  ToolId,
  OutputType,
} from './agent-flow-types';
import { getNodeColor, NODE_KIND_META } from './agent-flow-types';
import './agent-config-panel.css';

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
  onClose: () => void;
  onNodeDataChange: (nodeId: string, data: AgentNodeData) => void;
  onAgentMetaChange: (patch: Partial<Omit<AgentMetaForm, 'isCreateMode'>>) => void;
}

export function AgentConfigPanel({
  node,
  agent,
  onClose,
  onNodeDataChange,
  onAgentMetaChange,
}: ConfigPanelProps) {
  if (!node && !agent) return null;

  if (agent) {
    return (
      <aside className="acp" style={{ '--acp-color': '#2563eb' } as React.CSSProperties}>
        <header className="acp__header">
          <div className="acp__header-left">
            <span className="acp__type-dot" />
            <div className="acp__title-group">
              <span className="acp__type-label">{agent.isCreateMode ? 'Novo agente' : 'Agente'}</span>
              <span className="acp__description">Identidade e disponibilidade do agente</span>
            </div>
          </div>
          <button type="button" className="acp__close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="acp__body">
          <AgentMetaConfig data={agent} patch={onAgentMetaChange} />
        </div>
      </aside>
    );
  }

  if (!node) return null;
  const activeNode = node;
  const meta = NODE_KIND_META.find((m) => m.kind === activeNode.type);
  const color = getNodeColor(activeNode.type as AgentNodeKind);

  function patch<T extends AgentNodeData>(partial: Partial<T>) {
    onNodeDataChange(activeNode.id, { ...activeNode.data, ...partial } as AgentNodeData);
  }

  return (
    <aside className="acp" style={{ '--acp-color': color } as React.CSSProperties}>
      <header className="acp__header">
        <div className="acp__header-left">
          <span className="acp__type-dot" />
          <div className="acp__title-group">
            <span className="acp__type-label">{meta?.label ?? node.type}</span>
            <span className="acp__description">{meta?.description ?? ''}</span>
          </div>
        </div>
        <button type="button" className="acp__close" onClick={onClose} aria-label="Fechar">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="acp__body">
        {activeNode.type === 'trigger' && (
          <TriggerConfig data={activeNode.data as TriggerNodeData} patch={patch} />
        )}
        {activeNode.type === 'llm' && (
          <LlmConfig data={activeNode.data as LlmNodeData} patch={patch} />
        )}
        {activeNode.type === 'rag' && (
          <RagConfig data={activeNode.data as RagNodeData} patch={patch} />
        )}
        {activeNode.type === 'tool' && (
          <ToolConfig data={activeNode.data as ToolNodeData} patch={patch} />
        )}
        {activeNode.type === 'condition' && (
          <ConditionConfig data={activeNode.data as ConditionNodeData} patch={patch} />
        )}
        {activeNode.type === 'output' && (
          <OutputConfig data={activeNode.data as OutputNodeData} patch={patch} />
        )}
      </div>
    </aside>
  );
}

// ── Field components ──────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
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
  type = 'text',
  step,
  min,
  max,
  disabled,
}: {
  value: string | number;
  onChange: (v: string) => void;
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
      onChange={(e) => onChange(e.target.value)}
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="acp__textarea"
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select className="acp__select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`acp__toggle${disabled ? ' acp__toggle--disabled' : ''}`}>
      <div
        className={`acp__toggle-track${checked ? ' acp__toggle-track--on' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && onChange(!checked)}
      >
        <div className="acp__toggle-thumb" />
      </div>
      <span>{label}</span>
    </label>
  );
}

function AgentMetaConfig({
  data,
  patch,
}: {
  data: AgentMetaForm;
  patch: (p: Partial<Omit<AgentMetaForm, 'isCreateMode'>>) => void;
}) {
  return (
    <div className="acp__form">
      <Field label="Nome do agente">
        <Input value={data.name} onChange={(v) => patch({ name: v })} placeholder="Ex.: Assistente Revenue Ops" />
      </Field>
      <Field label="Chave do agente" hint={data.isCreateMode ? 'Gerada a partir do nome, mas pode ser ajustada antes de salvar.' : 'A chave fica fixa depois da criacao.'}>
        <Input value={data.key} onChange={(v) => patch({ key: v })} placeholder="assistente-revenue-ops" disabled={!data.isCreateMode} />
      </Field>
      <Field label="Descricao">
        <Textarea
          rows={5}
          value={data.description}
          onChange={(v) => patch({ description: v })}
          placeholder="Descreva quando este agente deve ser usado..."
        />
      </Field>
      <Toggle
        checked={data.isActive}
        onChange={(v) => patch({ isActive: v })}
        label={data.isActive ? 'Agente ativo' : 'Agente inativo'}
      />
    </div>
  );
}

// ── Node configs ──────────────────────────────────────────────────────────────

function TriggerConfig({ data, patch }: { data: TriggerNodeData; patch: (p: Partial<TriggerNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do nó">
        <Input value={data.label} onChange={(v) => patch({ label: v })} placeholder="Disparador" />
      </Field>
      <Field label="Tipo de disparo">
        <SelectField
          value={data.triggerType}
          onChange={(v) => patch({ triggerType: v as TriggerNodeData['triggerType'] })}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'card_created', label: 'Card criado' },
            { value: 'card_updated', label: 'Card atualizado' },
            { value: 'card_status_changed', label: 'Status alterado' },
          ]}
        />
      </Field>
      <div className="acp__info-box">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>O nó Trigger é o ponto de entrada do fluxo. Apenas um é permitido.</span>
      </div>
    </div>
  );
}

const MODEL_OPTIONS = [
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini (padrão)' },
  { value: 'gpt-4.1', label: 'gpt-4.1' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { value: 'gpt-4o', label: 'gpt-4o' },
];

function LlmConfig({ data, patch }: { data: LlmNodeData; patch: (p: Partial<LlmNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do nó">
        <Input value={data.label} onChange={(v) => patch({ label: v })} placeholder="LLM" />
      </Field>
      <Field label="Modelo">
        <SelectField
          value={data.model || 'gpt-4.1-mini'}
          onChange={(v) => patch({ model: v })}
          options={MODEL_OPTIONS}
        />
      </Field>
      <Field label="Temperatura" hint="0 = determinístico · 2 = criativo">
        <Input
          type="number"
          step="0.1"
          min={0}
          max={2}
          value={data.temperature}
          onChange={(v) => patch({ temperature: parseFloat(v) || 0.2 })}
        />
      </Field>
      <Field label="System Prompt">
        <Textarea
          rows={8}
          value={data.systemPrompt}
          onChange={(v) => patch({ systemPrompt: v })}
          placeholder="Descreva o comportamento do agente..."
        />
      </Field>
    </div>
  );
}

const RAG_SOURCE_OPTIONS = [
  { value: 'none', label: 'Sem RAG' },
  { value: 'documentation', label: 'Só documentação' },
  { value: 'card', label: 'Só cards' },
  { value: 'card_and_documentation', label: 'Doc + Cards' },
];

const TOP_K_OPTIONS = ['3', '5', '7', '10'].map((v) => ({ value: v, label: `${v} documentos` }));

function RagConfig({ data, patch }: { data: RagNodeData; patch: (p: Partial<RagNodeData>) => void }) {
  const usesCards = data.source === 'card' || data.source === 'card_and_documentation';
  const ragEnabled = data.source !== 'none';

  return (
    <div className="acp__form">
      <Field label="Nome do nó">
        <Input value={data.label} onChange={(v) => patch({ label: v })} placeholder="Contexto" />
      </Field>
      <Field label="Fonte de contexto">
        <SelectField
          value={data.source}
          onChange={(v) => patch({ source: v as RagSource })}
          options={RAG_SOURCE_OPTIONS}
        />
      </Field>
      <Field label="Documentos recuperados">
        <SelectField
          value={String(data.topK)}
          onChange={(v) => patch({ topK: parseInt(v, 10) })}
          options={TOP_K_OPTIONS}
        />
      </Field>
      <Toggle
        checked={data.includeSemanticContext}
        onChange={(v) => patch({ includeSemanticContext: v })}
        label="Contexto semântico"
        disabled={!usesCards}
      />
      <Toggle
        checked={data.includeLinkedDocuments}
        onChange={(v) => patch({ includeLinkedDocuments: v })}
        label="Docs vinculadas ao card"
        disabled={!usesCards}
      />
      <Field label="Instrução de contexto">
        <Textarea
          rows={4}
          value={data.contextInstruction}
          onChange={(v) => patch({ contextInstruction: v })}
          placeholder="Ex.: Priorize documentação oficial..."
          // @ts-expect-error - disabled prop on textarea
          disabled={!ragEnabled}
        />
      </Field>
    </div>
  );
}

const TOOL_OPTIONS = [
  { value: 'web_search', label: '🔍 Web Search', group: 'GPT Tools' },
  { value: 'update_item_description', label: '✏️ Atualizar descrição', group: 'Tools nativas' },
  { value: 'set_item_status', label: '🔄 Alterar status', group: 'Tools nativas' },
  { value: 'set_item_priority', label: '⚡ Alterar prioridade', group: 'Tools nativas' },
];

function ToolConfig({ data, patch }: { data: ToolNodeData; patch: (p: Partial<ToolNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do nó">
        <Input value={data.label} onChange={(v) => patch({ label: v })} placeholder="Tool" />
      </Field>
      <Field label="Ferramenta">
        <div className="acp__tool-list">
          {TOOL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`acp__tool-item${data.toolId === opt.value ? ' acp__tool-item--active' : ''}`}
              onClick={() => patch({ toolId: opt.value as ToolId })}
            >
              <span className="acp__tool-label">{opt.label}</span>
              <span className="acp__tool-group">{opt.group}</span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function ConditionConfig({ data, patch }: { data: ConditionNodeData; patch: (p: Partial<ConditionNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do nó">
        <Input value={data.label} onChange={(v) => patch({ label: v })} placeholder="Condição" />
      </Field>
      <Field
        label="Expressão de condição"
        hint="Descreva a condição em linguagem natural. Ex.: Se a pontuação de risco for maior que 7"
      >
        <Textarea
          rows={4}
          value={data.condition}
          onChange={(v) => patch({ condition: v })}
          placeholder="Se o resultado contiver alta prioridade..."
        />
      </Field>
      <div className="acp__info-box">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>
          O nó Condição tem duas saídas: <strong>Verdadeiro</strong> (esquerda) e{' '}
          <strong>Falso</strong> (direita).
        </span>
      </div>
    </div>
  );
}

const OUTPUT_TYPE_OPTIONS = [
  { value: 'text_response', label: 'Texto ao usuário' },
  { value: 'update_card', label: 'Atualizar card' },
];

function OutputConfig({ data, patch }: { data: OutputNodeData; patch: (p: Partial<OutputNodeData>) => void }) {
  return (
    <div className="acp__form">
      <Field label="Nome do nó">
        <Input value={data.label} onChange={(v) => patch({ label: v })} placeholder="Resposta" />
      </Field>
      <Field label="Tipo de saída">
        <SelectField
          value={data.outputType}
          onChange={(v) => patch({ outputType: v as OutputType })}
          options={OUTPUT_TYPE_OPTIONS}
        />
      </Field>
      <div className="acp__info-box">
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>O nó Resposta é o ponto de saída do fluxo. Apenas um é permitido.</span>
      </div>
    </div>
  );
}
