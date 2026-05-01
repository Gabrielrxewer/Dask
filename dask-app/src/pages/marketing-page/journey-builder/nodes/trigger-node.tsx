import type { NodeProps } from '@xyflow/react';
import { FlowNodeCard } from '@/shared/ui';
import type { JourneyNodeData, TriggerConfig } from '../types';
import { TRIGGER_EVENT_LABELS } from '../types';

const LightningIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M9.5 2L4 9h4.5L6.5 14l6-7H8L9.5 2Z" fill="currentColor" />
  </svg>
);

export function TriggerNode(props: NodeProps) {
  const data = props.data as unknown as JourneyNodeData;
  const cfg = data.config as TriggerConfig;
  const eventLabel = TRIGGER_EVENT_LABELS[cfg.event] ?? cfg.event;

  return (
    <FlowNodeCard
        kind="trigger"
        typeLabel="Gatilho"
        label={data.label}
        meta={eventLabel}
        icon={LightningIcon}
        selected={props.selected}
        target={false}
      />
  );
}
