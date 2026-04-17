import { useState } from "react";
import type { BoardConfig, TaskStatusId, TaskStatus } from "@/entities/task";
import type { MembersById } from "@/entities/member";
import type { CreateTaskInput } from "@/modules/workspace";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui";
import { TaskDetailsModal } from "@/widgets/task-details";

interface CreateTaskButtonProps {
  onCreate: (input: CreateTaskInput) => void | Promise<void>;
  initialStatusId: TaskStatusId;
  statuses: TaskStatus[];
  boardConfig: BoardConfig;
  membersById: MembersById;
  availableTags?: Array<{ id: string; name: string; color: string }>;
  className?: string;
}

export function CreateTaskButton({
  onCreate,
  initialStatusId,
  statuses,
  boardConfig,
  membersById,
  availableTags = [],
  className
}: CreateTaskButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button className={cn("create-task-button", className)} variant="primary" onClick={() => setIsOpen(true)}>
        + Nova tarefa
      </Button>
      {isOpen ? (
        <TaskDetailsModal
          mode="create"
          statuses={statuses}
          initialStatusId={initialStatusId}
          membersById={membersById}
          boardConfig={boardConfig}
          availableTags={availableTags}
          onCreateTask={onCreate}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
