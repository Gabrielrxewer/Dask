import { Handle, Position } from '@xyflow/react';
import './flow-node-card.css';

export interface FlowNodeBranch {
  id: string;
  label: string;
  tone: 'true' | 'false' | 'neutral';
}

export interface FlowNodeCardProps {
  kind: string;
  typeLabel: string;
  label: string;
  meta?: string;
  icon: React.ReactNode;
  selected?: boolean;
  source?: boolean;
  target?: boolean;
  preview?: string;
  emptyText?: string;
  branches?: FlowNodeBranch[];
}

export function FlowNodeCard({
  kind,
  typeLabel,
  label,
  meta,
  icon,
  selected = false,
  source = true,
  target = true,
  preview,
  emptyText,
  branches,
}: FlowNodeCardProps) {
  return (
    <div className={`flow-node-card flow-node-card--${kind}${selected ? ' flow-node-card--selected' : ''}`}>
      {target && <Handle type="target" position={Position.Top} className={`flow-node-card__handle flow-node-card__handle--target flow-node-card__handle--${kind}`} />}
      <div className={`flow-node-card__header flow-node-card__header--${kind}`}>
        <span className="flow-node-card__icon">{icon}</span>
        <span className="flow-node-card__type">{typeLabel}</span>
        <div className="flow-node-card__grip">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="flow-node-card__body">
        <span className="flow-node-card__label">{label}</span>
        {meta ? <span className="flow-node-card__meta">{meta}</span> : null}
        {preview ? (
          <span className="flow-node-card__preview">{preview}</span>
        ) : emptyText ? (
          <span className="flow-node-card__empty">{emptyText}</span>
        ) : null}
        {branches?.length ? (
          <div className="flow-node-card__branches">
            {branches.map((branch) => (
              <span key={branch.id} className={`flow-node-card__branch flow-node-card__branch--${branch.tone}`}>
                {branch.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {branches?.length ? (
        branches.map((branch, index) => (
          <Handle
            key={branch.id}
            type="source"
            position={Position.Bottom}
            id={branch.id}
            className={`flow-node-card__handle flow-node-card__handle--source flow-node-card__handle--${kind} flow-node-card__handle--branch-${index}`}
          />
        ))
      ) : source ? (
        <Handle type="source" position={Position.Bottom} className={`flow-node-card__handle flow-node-card__handle--source flow-node-card__handle--${kind}`} />
      ) : null}
    </div>
  );
}
