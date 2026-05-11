import type { CSSProperties } from "react";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type BoardConfig, type Task } from "@/entities/task";
import { StatusBadge } from "@/shared/ui";

interface WorkItemTypeCellProps {
  task: Task;
  boardConfig: BoardConfig;
}

export function WorkItemTypeCell({ task, boardConfig }: WorkItemTypeCellProps) {
  const type = getTaskTypeDisplayMeta(buildTaskTypeMetaMap(boardConfig.taskTypes), task.type);

  if (!type) {
    return <span className="work-item-cell-empty">-</span>;
  }

  return (
    <StatusBadge
      size="sm"
      kind="tag"
      className="work-item-cell-type"
      style={{
        "--list-type-background": type.background ?? "var(--info-bg)",
        "--list-type-border": type.border ?? "var(--info-border)",
        "--list-type-text": type.text ?? "var(--text-primary)"
      } as CSSProperties}
    >
      {type.label}
    </StatusBadge>
  );
}
