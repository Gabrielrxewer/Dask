import type { NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { FlowNodeCard } from '@/shared/ui';
import type { ActionConfig, JourneyNodeData } from '../types';
import { ACTION_TYPE_LABELS } from '../types';

const icons: Record<string, ReactElement> = {
  send_campaign: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M13.5 2.5L7 8.5M13.5 2.5L9 13.5l-2-5-5-2 11.5-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  update_score: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M8 2v12M4 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  move_work_item: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  create_task: (
    <svg viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8l2 2 4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  notify_user: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M8 2a4 4 0 0 1 4 4v2.5l1 2H3l1-2V6a4 4 0 0 1 4-4ZM6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5.5v3l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

export function ActionNode(props: NodeProps) {
  const data = props.data as unknown as JourneyNodeData;
  const cfg = data.config as ActionConfig;
  const typeLabel = ACTION_TYPE_LABELS[cfg.type] ?? cfg.type;
  const icon = icons[cfg.type] ?? icons.default;

  return (
    <FlowNodeCard
      kind="action"
      typeLabel="Acao"
      label={data.label}
      meta={typeLabel}
      icon={icon}
      selected={props.selected}
    />
  );
}
