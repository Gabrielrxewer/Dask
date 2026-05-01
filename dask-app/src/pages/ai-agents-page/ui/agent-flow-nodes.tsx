import { type NodeProps } from '@xyflow/react';
import { FlowNodeCard } from '@/shared/ui';
import type {
  TriggerNodeData,
  LlmNodeData,
  RagNodeData,
  ToolNodeData,
  ConditionNodeData,
  OutputNodeData,
} from './agent-flow-types';

function IconTrigger() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 1.5 4 8.5h4l-1.5 6L14 7.5h-4l1.5-6z" fill="currentColor" />
    </svg>
  );
}

function IconLlm() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2a1 1 0 0 1 1 1v.5c1.5.3 2.5 1.6 2.5 3.2 0 .8-.3 1.6-.8 2.1l.5 1.2H4.8l.5-1.2A3.2 3.2 0 0 1 4.5 6.7c0-1.6 1-2.9 2.5-3.2V3a1 1 0 0 1 1-1z" fill="currentColor" opacity=".9" />
      <rect x="5.5" y="11" width="5" height="1.2" rx=".6" fill="currentColor" opacity=".6" />
      <rect x="6.5" y="12.8" width="3" height="1.2" rx=".6" fill="currentColor" opacity=".4" />
    </svg>
  );
}

function IconRag() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <ellipse cx="8" cy="4.5" rx="5" ry="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 4.5v3c0 1.1 2.24 2 5 2s5-.9 5-2v-3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 7.5v3c0 1.1 2.24 2 5 2s5-.9 5-2v-3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconTool() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2a3.5 3.5 0 0 0-3.3 4.6L2 11.8l.2 2 2 .2 5.2-5.2A3.5 3.5 0 0 0 14 5.5a3.5 3.5 0 0 0-.7-2.1l-2 2-1.3-.1-.1-1.3 2-2A3.5 3.5 0 0 0 10.5 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconCondition() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5 14.5 8 8 14.5 1.5 8 8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 5v3m0 0 2 2M8 8l-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconOutput() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  card_created: 'Card criado',
  card_updated: 'Card atualizado',
  card_status_changed: 'Status alterado',
};

const RAG_SOURCE_LABELS: Record<string, string> = {
  none: 'Sem RAG',
  documentation: 'Documentacao',
  card: 'Cards',
  card_and_documentation: 'Doc + Cards',
};

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Web Search',
  update_item_description: 'Atualizar descricao',
  set_item_status: 'Alterar status',
  set_item_priority: 'Alterar prioridade',
};

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  text_response: 'Texto ao usuario',
  update_card: 'Atualizar card',
};

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  return (
    <FlowNodeCard
      kind="trigger"
      typeLabel="Trigger"
      label={d.label}
      meta={TRIGGER_LABELS[d.triggerType] ?? d.triggerType}
      icon={<IconTrigger />}
      selected={selected}
      target={false}
    />
  );
}

export function LlmNode({ data, selected }: NodeProps) {
  const d = data as LlmNodeData;
  const preview = d.systemPrompt?.trim().slice(0, 48);
  const modelDisplay = d.model || 'padrao';

  return (
    <FlowNodeCard
      kind="llm"
      typeLabel="LLM"
      label={d.label}
      meta={`${modelDisplay} · temp ${d.temperature}`}
      preview={preview ? `${preview}${d.systemPrompt.length > 48 ? '...' : ''}` : undefined}
      emptyText={preview ? undefined : 'Sem prompt configurado'}
      icon={<IconLlm />}
      selected={selected}
    />
  );
}

export function RagNode({ data, selected }: NodeProps) {
  const d = data as RagNodeData;
  return (
    <FlowNodeCard
      kind="rag"
      typeLabel="Contexto"
      label={d.label}
      meta={`${RAG_SOURCE_LABELS[d.source] ?? d.source} · Top ${d.topK}`}
      icon={<IconRag />}
      selected={selected}
    />
  );
}

export function ToolNode({ data, selected }: NodeProps) {
  const d = data as ToolNodeData;
  return (
    <FlowNodeCard
      kind="tool"
      typeLabel="Tool"
      label={d.label}
      meta={TOOL_LABELS[d.toolId] ?? d.toolId}
      icon={<IconTool />}
      selected={selected}
    />
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <FlowNodeCard
      kind="condition"
      typeLabel="Condicao"
      label={d.label}
      meta={d.condition ? d.condition.slice(0, 40) : undefined}
      emptyText={d.condition ? undefined : 'Condicao nao definida'}
      branches={[
        { id: 'true', label: 'Verdadeiro', tone: 'true' },
        { id: 'false', label: 'Falso', tone: 'false' },
      ]}
      icon={<IconCondition />}
      selected={selected}
    />
  );
}

export function OutputNode({ data, selected }: NodeProps) {
  const d = data as OutputNodeData;
  return (
    <FlowNodeCard
      kind="output"
      typeLabel="Resposta"
      label={d.label}
      meta={OUTPUT_TYPE_LABELS[d.outputType] ?? d.outputType}
      icon={<IconOutput />}
      selected={selected}
      source={false}
    />
  );
}
