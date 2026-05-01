import { Handle, Position, type NodeProps } from '@xyflow/react';
import type {
  TriggerNodeData,
  LlmNodeData,
  RagNodeData,
  ToolNodeData,
  ConditionNodeData,
  OutputNodeData,
} from './agent-flow-types';
import './agent-flow-nodes.css';

// ── Icons ─────────────────────────────────────────────────────────────────────

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
      <path
        d="M8 2a1 1 0 0 1 1 1v.5c1.5.3 2.5 1.6 2.5 3.2 0 .8-.3 1.6-.8 2.1l.5 1.2H4.8l.5-1.2A3.2 3.2 0 0 1 4.5 6.7c0-1.6 1-2.9 2.5-3.2V3a1 1 0 0 1 1-1z"
        fill="currentColor"
        opacity=".9"
      />
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
      <path
        d="M10.5 2a3.5 3.5 0 0 0-3.3 4.6L2 11.8l.2 2 2 .2 5.2-5.2A3.5 3.5 0 0 0 14 5.5a3.5 3.5 0 0 0-.7-2.1l-2 2-1.3-.1-.1-1.3 2-2A3.5 3.5 0 0 0 10.5 2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
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
      <path
        d="M3 8h10M9.5 4.5 13 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── shared sub-components ─────────────────────────────────────────────────────

interface NodeHeaderProps {
  kind: string;
  label: string;
  icon: React.ReactNode;
  selected?: boolean;
}

function NodeHeader({ kind, label, icon }: NodeHeaderProps) {
  return (
    <div className={`anode__header anode__header--${kind}`}>
      <span className="anode__icon">{icon}</span>
      <span className="anode__type">{label}</span>
      <div className="anode__grip">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function NodeBody({ children }: { children: React.ReactNode }) {
  return <div className="anode__body">{children}</div>;
}

function NodeMeta({ text }: { text: string }) {
  return <span className="anode__meta">{text}</span>;
}

function NodeLabel({ text }: { text: string }) {
  return <span className="anode__label">{text}</span>;
}

// ── Trigger ───────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  card_created: 'Card criado',
  card_updated: 'Card atualizado',
  card_status_changed: 'Status alterado',
};

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  return (
    <div className={`anode anode--trigger${selected ? ' anode--selected' : ''}`}>
      <NodeHeader kind="trigger" label="Trigger" icon={<IconTrigger />} />
      <NodeBody>
        <NodeLabel text={d.label} />
        <NodeMeta text={TRIGGER_LABELS[d.triggerType] ?? d.triggerType} />
      </NodeBody>
      <Handle type="source" position={Position.Bottom} className="anode__handle anode__handle--source anode__handle--trigger" />
    </div>
  );
}

// ── LLM ───────────────────────────────────────────────────────────────────────

export function LlmNode({ data, selected }: NodeProps) {
  const d = data as LlmNodeData;
  const preview = d.systemPrompt?.trim().slice(0, 48);
  const modelDisplay = d.model || 'padrão';

  return (
    <div className={`anode anode--llm${selected ? ' anode--selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="anode__handle anode__handle--target anode__handle--llm" />
      <NodeHeader kind="llm" label="LLM" icon={<IconLlm />} />
      <NodeBody>
        <NodeLabel text={d.label} />
        <NodeMeta text={`${modelDisplay} · temp ${d.temperature}`} />
        {preview ? (
          <span className="anode__prompt-preview">
            {preview}
            {d.systemPrompt.length > 48 ? '…' : ''}
          </span>
        ) : (
          <span className="anode__prompt-empty">Sem prompt configurado</span>
        )}
      </NodeBody>
      <Handle type="source" position={Position.Bottom} className="anode__handle anode__handle--source anode__handle--llm" />
    </div>
  );
}

// ── RAG ───────────────────────────────────────────────────────────────────────

const RAG_SOURCE_LABELS: Record<string, string> = {
  none: 'Sem RAG',
  documentation: 'Documentação',
  card: 'Cards',
  card_and_documentation: 'Doc + Cards',
};

export function RagNode({ data, selected }: NodeProps) {
  const d = data as RagNodeData;
  return (
    <div className={`anode anode--rag${selected ? ' anode--selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="anode__handle anode__handle--target anode__handle--rag" />
      <NodeHeader kind="rag" label="Contexto" icon={<IconRag />} />
      <NodeBody>
        <NodeLabel text={d.label} />
        <NodeMeta text={`${RAG_SOURCE_LABELS[d.source] ?? d.source} · Top ${d.topK}`} />
      </NodeBody>
      <Handle type="source" position={Position.Bottom} className="anode__handle anode__handle--source anode__handle--rag" />
    </div>
  );
}

// ── Tool ──────────────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Web Search',
  update_item_description: 'Atualizar descrição',
  set_item_status: 'Alterar status',
  set_item_priority: 'Alterar prioridade',
};

export function ToolNode({ data, selected }: NodeProps) {
  const d = data as ToolNodeData;
  return (
    <div className={`anode anode--tool${selected ? ' anode--selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="anode__handle anode__handle--target anode__handle--tool" />
      <NodeHeader kind="tool" label="Tool" icon={<IconTool />} />
      <NodeBody>
        <NodeLabel text={d.label} />
        <NodeMeta text={TOOL_LABELS[d.toolId] ?? d.toolId} />
      </NodeBody>
      <Handle type="source" position={Position.Bottom} className="anode__handle anode__handle--source anode__handle--tool" />
    </div>
  );
}

// ── Condition ─────────────────────────────────────────────────────────────────

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <div className={`anode anode--condition${selected ? ' anode--selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="anode__handle anode__handle--target anode__handle--condition" />
      <NodeHeader kind="condition" label="Condição" icon={<IconCondition />} />
      <NodeBody>
        <NodeLabel text={d.label} />
        {d.condition ? (
          <NodeMeta text={d.condition.slice(0, 40)} />
        ) : (
          <span className="anode__prompt-empty">Condição não definida</span>
        )}
        <div className="anode__condition-branches">
          <span className="anode__branch anode__branch--true">Verdadeiro</span>
          <span className="anode__branch anode__branch--false">Falso</span>
        </div>
      </NodeBody>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="anode__handle anode__handle--source anode__handle--condition anode__handle--left"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="anode__handle anode__handle--source anode__handle--condition anode__handle--right"
      />
    </div>
  );
}

// ── Output ────────────────────────────────────────────────────────────────────

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  text_response: 'Texto ao usuário',
  update_card: 'Atualizar card',
};

export function OutputNode({ data, selected }: NodeProps) {
  const d = data as OutputNodeData;
  return (
    <div className={`anode anode--output${selected ? ' anode--selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="anode__handle anode__handle--target anode__handle--output" />
      <NodeHeader kind="output" label="Resposta" icon={<IconOutput />} />
      <NodeBody>
        <NodeLabel text={d.label} />
        <NodeMeta text={OUTPUT_TYPE_LABELS[d.outputType] ?? d.outputType} />
      </NodeBody>
    </div>
  );
}
