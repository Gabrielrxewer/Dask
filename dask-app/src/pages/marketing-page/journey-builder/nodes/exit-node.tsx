import type { NodeProps } from '@xyflow/react';
import { FlowNodeCard } from '@/shared/ui';
import type { ExitConfig, JourneyNodeData } from '../types';

const StopIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" />
  </svg>
);

export function ExitNode(props: NodeProps) {
  const data = props.data as unknown as JourneyNodeData;
  const cfg = data.config as ExitConfig;
  const desc = cfg.reason || 'Fim da jornada';

  return (
    <FlowNodeCard
      kind="exit"
      typeLabel="Saida"
      label={data.label}
      meta={desc}
      icon={StopIcon}
      selected={props.selected}
      source={false}
    />
  );
}
