import type { MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskPriority, TaskStatus } from "@/entities/task";
import { TaskDetailsModal } from "@/widgets/task-details";

interface SelectedTaskDetailsModalProps {
  selectedTask: Task | null;
  selectedStatus: TaskStatus | null;
  activeMembers: MembersById;
  boardConfig: BoardConfig;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => void;
  onToggleChecklistItem: (taskId: string, itemId: string) => void;
  onClose: () => void;
}

export function SelectedTaskDetailsModal({
  selectedTask,
  selectedStatus,
  activeMembers,
  boardConfig,
  onUpdatePriority,
  onToggleChecklistItem,
  onClose
}: SelectedTaskDetailsModalProps) {
  if (!selectedTask || !selectedStatus) {
    return null;
  }

  return (
    <TaskDetailsModal
      task={selectedTask}
      status={selectedStatus}
      assignee={activeMembers[selectedTask.assignee]}
      boardConfig={boardConfig}
      onUpdatePriority={onUpdatePriority}
      onToggleChecklistItem={onToggleChecklistItem}
      onClose={onClose}
    />
  );
}
