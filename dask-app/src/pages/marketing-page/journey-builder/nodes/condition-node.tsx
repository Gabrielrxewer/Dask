import type { NodeProps } from '@xyflow/react';
import { FlowNodeCard } from '@/shared/ui';
import type { ConditionConfig, JourneyNodeData } from '../types';

const ForkIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M8 3v4M5 13V9l-3-2M11 13V9l3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="5" cy="13" r="1.5" fill="currentColor" />
    <circle cx="11" cy="13" r="1.5" fill="currentColor" />
    <circle cx="8" cy="3" r="1.5" fill="currentColor" />
  </svg>
);

function rulesSummary(rules: ConditionConfig['rules']): string {
  if (!rules || rules.length === 0) return 'Sem regras';
  const first = rules[0];
  const rest = rules.length > 1 ? ` +${rules.length - 1}` : '';
  return `${first.field} ${first.operator} ${first.value ?? ''}${rest}`;
}

export function ConditionNode(props: NodeProps) {
  const data = props.data as unknown as JourneyNodeData;
  const cfg = data.config as ConditionConfig;

  return (
    <FlowNodeCard
      kind="condition"
      typeLabel="Condicao"
      label={data.label}
      meta={rulesSummary(cfg.rules)}
      branches={[
        { id: 'yes', label: cfg.yesLabel || 'Sim', tone: 'true' },
        { id: 'no', label: cfg.noLabel || 'Nao', tone: 'false' },
      ]}
      icon={ForkIcon}
      selected={props.selected}
    />
  );
}
