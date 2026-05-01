import type { NodeProps } from '@xyflow/react';
import { FlowNodeCard } from '@/shared/ui';
import type { DelayConfig, JourneyNodeData } from '../types';

const UNIT_LABELS: Record<string, string> = {
  minutes: 'min',
  hours: 'h',
  days: 'd',
  weeks: 'sem',
};

const ClockIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function DelayNode(props: NodeProps) {
  const data = props.data as unknown as JourneyNodeData;
  const cfg = data.config as DelayConfig;
  const unitLabel = UNIT_LABELS[cfg.unit] ?? cfg.unit;
  const desc = cfg.duration > 0 ? `Aguardar ${cfg.duration} ${unitLabel}` : 'Duracao nao definida';

  return (
    <FlowNodeCard
      kind="delay"
      typeLabel="Espera"
      label={data.label}
      meta={desc}
      icon={ClockIcon}
      selected={props.selected}
    />
  );
}
