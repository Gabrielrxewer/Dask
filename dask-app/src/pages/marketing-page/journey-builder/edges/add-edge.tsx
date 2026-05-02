import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import './add-edge.css';

export function AddEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
    style,
  } = props;

  const edgeData = data as { label?: string; branchType?: 'yes' | 'no' | 'default'; onInsert?: (id: string) => void } | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const branchType = edgeData?.branchType;
  const edgeColor =
    branchType === 'yes'
      ? 'var(--success)'
      : branchType === 'no'
        ? 'var(--danger)'
        : 'var(--line-contrast)';

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: edgeColor, strokeWidth: 2, ...style }}
      />
      <EdgeLabelRenderer>
        {edgeData?.label && (
          <div
            className={`add-edge__branch-label add-edge__branch-label--${branchType ?? 'default'}`}
            style={{
              transform: `translate(-50%, -50%) translate(${sourceX}px,${sourceY + 20}px)`,
            }}
          >
            {edgeData.label}
          </div>
        )}
        <div
          className="add-edge__btn-wrapper"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <button
            type="button"
            className="add-edge__btn nodrag nopan"
            title="Adicionar bloco"
            onClick={() => edgeData?.onInsert?.(id)}
          >
            <svg viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
